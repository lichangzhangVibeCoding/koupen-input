import { clipboard } from 'electron'
import { BRAND } from '../shared/brand'
import { t } from '../shared/i18n'
import { isScreenQuizIntent } from '../shared/screen-quiz-intent'
import { AppSettings, HudStatus, LOCAL_DEFAULTS } from '../shared/types'
import { notifyActivityChanged } from './activity-notify'
import { captureFullScreen } from './capture'
import { getSettings } from './db'
import { showHud } from './hud'
import { getExamKnowledgeBase } from './exam-knowledge'
import { answerScreenQuestion, answerScreenQuiz, isLocalMode } from './llm'
import { getOllamaStatus } from './ollama'
import { assertMacScreenCaptureAllowed } from './permissions'
import {
  appendScreenAskTurn,
  createScreenAskSession,
  recentScreenAskTextHistory
} from './screen-ask-store'
import { isSpeaking, prefetchSpeakText, speakText, stopSpeaking } from './speak'
import { resolveSttConfig, transcribeAudio } from './stt'
import {
  abortNetworkWork,
  beginNetworkWork,
  isTaskCancelled,
  TaskCancelledError
} from './task-cancel'
import { discardMicRecording, startMicRecording, stopMicRecording } from './voice-recorder'
import { notifySkillGuideStep } from './skill-guide'

type Phase = 'idle' | 'capturing' | 'speaking' | 'listening' | 'transcribing' | 'thinking'

let phase: Phase = 'idle'
let requestId = ''
let pendingImage: { base64: string; mime: string } | null = null
/** 当前继续写入的会话；null = 下次问答新建 */
let activeSessionId: number | null = null
let onSessionUpdated: ((sessionId: number) => void) | null = null
let lastHud: HudStatus | null = null
let thinkPulseTimer: ReturnType<typeof setInterval> | null = null
let runId = 0
let screenAskFromUi = false

export function setScreenAskUpdateHandler(fn: ((sessionId: number) => void) | null): void {
  onSessionUpdated = fn
}

export function getActiveScreenAskSessionId(): number | null {
  return activeSessionId
}

export function setActiveScreenAskSessionId(id: number | null): void {
  activeSessionId = id
}

/** 新开对话：下次快捷键写入新会话 */
export function startNewScreenAskSession(): number {
  const session = createScreenAskSession(t('screenAsk.newTitle'))
  activeSessionId = session.id
  onSessionUpdated?.(session.id)
  return session.id
}

export function isScreenAskListening(): boolean {
  return phase === 'listening'
}

export function isScreenAskBusy(): boolean {
  return phase !== 'idle'
}

/** Esc：立刻停下看屏幕全链路（含答案朗读） */
export function cancelScreenAsk(): boolean {
  const wasSpeaking = isSpeaking()
  stopSpeaking()
  if (phase === 'idle') {
    if (wasSpeaking) notifyActivityChanged()
    return wasSpeaking
  }
  runId += 1
  clearThinkPulse()
  abortNetworkWork()
  if (requestId || phase === 'listening' || phase === 'transcribing') {
    discardMicRecording()
  }
  pendingImage = null
  requestId = ''
  phase = 'idle'
  lastHud = null
  notifyActivityChanged()
  return true
}

function clearThinkPulse(): void {
  if (thinkPulseTimer) {
    clearInterval(thinkPulseTimer)
    thinkPulseTimer = null
  }
}

function setPhaseHud(status: Exclude<HudStatus, { kind: 'hidden' }>): void {
  lastHud = status
  showHud(status)
}

/** 其它能力撞车时：重亮当前进度，而不是干瘪「还在忙」 */
export function showScreenAskProgressHud(): void {
  if (phase === 'idle') return
  if (lastHud && lastHud.kind !== 'hidden') {
    showHud(lastHud)
    return
  }
  showHud({
    kind: 'generating',
    text: t('screenAsk.busy'),
    detail: t('screenAsk.busyDetail'),
    icon: 'think'
  })
}

function archiveQuizQuestion(userQuestion: string, questionText: string): string {
  const spoken = userQuestion.trim()
  if (questionText.trim()) {
    return `${spoken}\n\n（看屏幕答题·读题）\n${questionText.trim().slice(0, 2000)}`
  }
  return spoken || t('screenQuiz.autoQuestion')
}

async function completeQuizFromImage(
  settings: AppSettings,
  image: { base64: string; mime: string },
  userQuestion: string,
  myRun: number
): Promise<{ answer: string; archivedQuestion: string }> {
  let quizPhase: 'reading' | 'answering' = 'reading'
  const showQuizHud = (wait = false) => {
    if (quizPhase === 'reading') {
      setPhaseHud({
        kind: 'recognizing',
        text: wait ? t('screenQuiz.readingWait') : t('screenQuiz.reading'),
        detail: t('screenQuiz.readingDetail'),
        icon: 'look'
      })
    } else {
      setPhaseHud({
        kind: 'generating',
        text: wait ? t('screenQuiz.thinkingWait') : t('screenQuiz.thinking'),
        detail: t('screenQuiz.thinkingDetail'),
        icon: 'think'
      })
    }
  }
  showQuizHud()
  let tick = 0
  clearThinkPulse()
  thinkPulseTimer = setInterval(() => {
    if (myRun !== runId) {
      clearThinkPulse()
      return
    }
    tick += 1
    showQuizHud(tick % 2 === 1)
  }, 2800)

  const signal = beginNetworkWork()
  const knowledge = getExamKnowledgeBase()
  const { answer, questionText } = await answerScreenQuiz(
    settings,
    image,
    signal,
    knowledge,
    (p) => {
      quizPhase = p
      showQuizHud()
    }
  )
  return {
    answer,
    archivedQuestion: archiveQuizQuestion(userQuestion, questionText)
  }
}

async function resolveScreenAskAnswer(
  settings: AppSettings,
  image: { base64: string; mime: string },
  question: string,
  myRun: number
): Promise<{ answer: string; archivedQuestion: string }> {
  if (isScreenQuizIntent(question)) {
    return completeQuizFromImage(settings, image, question, myRun)
  }
  const history = activeSessionId ? recentScreenAskTextHistory(activeSessionId, 12) : []
  const signal = beginNetworkWork()
  const answer = await answerScreenQuestion(settings, image, question, history, signal)
  return { answer, archivedQuestion: question }
}

async function assertModelsReady(): Promise<void> {
  const settings = getSettings()
  if (isLocalMode(settings)) {
    const textModel = settings.localModelName || LOCAL_DEFAULTS.textModel
    const visionModel = settings.localVisionModelName || LOCAL_DEFAULTS.visionModel
    const status = await getOllamaStatus(textModel, visionModel)
    if (!status.running) {
      throw new Error(t('screenAsk.errLocalNotReady'))
    }
    if (!status.visionModelReady) {
      throw new Error(t('screenAsk.errLocalVision'))
    }
  } else if (!settings.apiKey.trim()) {
    throw new Error(t('screenAsk.errApiKey'))
  }
  resolveSttConfig(settings)
}

async function finishListening(): Promise<void> {
  if (phase !== 'listening' || !pendingImage) return
  stopSpeaking()
  phase = 'transcribing'
  notifyActivityChanged()
  const image = pendingImage
  pendingImage = null
  const rid = requestId
  requestId = ''
  const myRun = runId

  try {
    setPhaseHud({
      kind: 'transcribing',
      text: t('screenAsk.transcribing'),
      detail: t('screenAsk.transcribingDetail'),
      icon: 'write'
    })
    const { buffer, mime } = await stopMicRecording(rid)
    if (myRun !== runId) throw new TaskCancelledError()
    if (!buffer.length) throw new Error(t('screenAsk.errNoAudio'))

    const settings = getSettings()
    const signal = beginNetworkWork()
    const question = await transcribeAudio(settings, buffer, mime, signal)
    if (myRun !== runId) throw new TaskCancelledError()

    phase = 'thinking'
    notifyActivityChanged()
    setPhaseHud({
      kind: 'generating',
      text: t('screenAsk.thinking'),
      detail: t('screenAsk.thinkingDetail'),
      icon: 'think'
    })
    let tick = 0
    clearThinkPulse()
    thinkPulseTimer = setInterval(() => {
      if (myRun !== runId) {
        clearThinkPulse()
        return
      }
      tick += 1
      setPhaseHud({
        kind: 'generating',
        text: tick % 2 === 0 ? t('screenAsk.thinking') : t('screenAsk.thinkingWait'),
        detail: t('screenAsk.thinkingDetail'),
        icon: 'think'
      })
    }, 2800)

    const { answer, archivedQuestion } = await resolveScreenAskAnswer(
      settings,
      image,
      question,
      myRun
    )
    if (myRun !== runId) throw new TaskCancelledError()
    clearThinkPulse()

    const saved = appendScreenAskTurn({
      sessionId: activeSessionId,
      question: archivedQuestion,
      answer,
      image
    })
    activeSessionId = saved.session.id
    onSessionUpdated?.(saved.session.id)

    clipboard.writeText(answer)
    lastHud = { kind: 'answer', text: answer }
    showHud({ kind: 'answer', text: answer })
    void speakText(`${t('screenAsk.answerSpeakPrefix')}${answer}`, { maxLen: 280 })
    if (!screenAskFromUi) notifySkillGuideStep('screenAsk', true)
  } catch (err) {
    clearThinkPulse()
    if (isTaskCancelled(err) || myRun !== runId) return
    const message = err instanceof Error ? err.message : String(err)
    lastHud = { kind: 'error', text: message.slice(0, 120) }
    showHud({ kind: 'error', text: message.slice(0, 120) })
  } finally {
    clearThinkPulse()
    if (myRun === runId) {
      phase = 'idle'
      notifyActivityChanged()
    }
  }
}

/** 快捷键：第一次截屏并开听；第二次结束并回答。听的过程中也可由语音单击结束。 */
export async function toggleScreenAsk(opts?: { fromUi?: boolean }): Promise<void> {
  const settings = getSettings()
  if (settings.screenAskEnabled === false) {
    showHud({ kind: 'error', text: t('screenAsk.disabled', { name: BRAND.screenAsk.name }) })
    return
  }

  if (phase === 'capturing' || phase === 'speaking' || phase === 'transcribing' || phase === 'thinking') {
    showScreenAskProgressHud()
    return
  }

  if (phase === 'listening') {
    await finishListening()
    return
  }

  screenAskFromUi = Boolean(opts?.fromUi)
  phase = 'capturing'
  const myRun = ++runId
  notifyActivityChanged()
  try {
    if (process.platform === 'darwin') {
      assertMacScreenCaptureAllowed()
    }
    await assertModelsReady()
    if (myRun !== runId) throw new TaskCancelledError()

    setPhaseHud({
      kind: 'recognizing',
      text: t('screenAsk.capturing'),
      detail: t('screenAsk.capturingDetail'),
      icon: 'look'
    })
    // 截屏同时预取固定提示语，截完常可直接播缓存
    const promptSpeak = t('screenAsk.promptSpeak')
    prefetchSpeakText(promptSpeak)
    const shot = await captureFullScreen()
    if (myRun !== runId) throw new TaskCancelledError()
    pendingImage = shot.visionImage

    phase = 'speaking'
    notifyActivityChanged()
    setPhaseHud({
      kind: 'generating',
      text: t('screenAsk.speaking'),
      detail: t('screenAsk.speakingDetail'),
      icon: 'speak'
    })
    await speakText(promptSpeak)
    if (myRun !== runId) throw new TaskCancelledError()

    setPhaseHud({
      kind: 'recording',
      text: t('screenAsk.prompt'),
      detail: t('screenAsk.listeningDetail'),
      icon: 'listen'
    })
    requestId = await startMicRecording()
    if (myRun !== runId) {
      discardMicRecording()
      throw new TaskCancelledError()
    }
    phase = 'listening'
    notifyActivityChanged()
  } catch (err) {
    if (isTaskCancelled(err) || myRun !== runId) {
      if (myRun === runId) {
        stopSpeaking()
        clearThinkPulse()
        pendingImage = null
        requestId = ''
        phase = 'idle'
        notifyActivityChanged()
      }
      return
    }
    stopSpeaking()
    clearThinkPulse()
    pendingImage = null
    requestId = ''
    phase = 'idle'
    notifyActivityChanged()
    const message = err instanceof Error ? err.message : String(err)
    lastHud = { kind: 'error', text: message.slice(0, 120) }
    showHud({ kind: 'error', text: message.slice(0, 120) })
  }
}

/** 听音阶段被语音单击打断时调用 */
export async function stopScreenAskIfListening(): Promise<boolean> {
  if (phase !== 'listening') return false
  await finishListening()
  return true
}

/**
 * 内部：无口述的答题流水线（已并入看屏幕意图路由；不再作为独立技能入口）。
 */
export async function runScreenQuiz(): Promise<void> {
  const settings = getSettings()
  if (settings.screenAskEnabled === false) {
    showHud({ kind: 'error', text: t('screenAsk.disabled', { name: BRAND.screenAsk.name }) })
    return
  }
  if (phase !== 'idle') {
    showScreenAskProgressHud()
    return
  }

  phase = 'capturing'
  const myRun = ++runId
  notifyActivityChanged()
  try {
    if (process.platform === 'darwin') {
      assertMacScreenCaptureAllowed()
    }
    await assertModelsReady()
    if (myRun !== runId) throw new TaskCancelledError()

    setPhaseHud({
      kind: 'recognizing',
      text: t('screenQuiz.capturing'),
      detail: t('screenQuiz.capturingDetail'),
      icon: 'look'
    })
    const shot = await captureFullScreen()
    if (myRun !== runId) throw new TaskCancelledError()

    phase = 'thinking'
    notifyActivityChanged()
    const { answer, archivedQuestion } = await completeQuizFromImage(
      settings,
      shot.visionImage,
      t('screenQuiz.autoQuestion'),
      myRun
    )
    if (myRun !== runId) throw new TaskCancelledError()
    clearThinkPulse()

    const saved = appendScreenAskTurn({
      sessionId: activeSessionId,
      question: archivedQuestion,
      answer,
      image: shot.visionImage
    })
    activeSessionId = saved.session.id
    onSessionUpdated?.(saved.session.id)

    clipboard.writeText(answer)
    lastHud = { kind: 'answer', text: answer }
    showHud({ kind: 'answer', text: answer })
    void speakText(answer, { maxLen: 200 })
    if (!screenAskFromUi) notifySkillGuideStep('screenAsk', true)
  } catch (err) {
    clearThinkPulse()
    if (isTaskCancelled(err) || myRun !== runId) return
    const message = err instanceof Error ? err.message : String(err)
    lastHud = { kind: 'error', text: message.slice(0, 120) }
    showHud({ kind: 'error', text: message.slice(0, 120) })
  } finally {
    clearThinkPulse()
    if (myRun === runId) {
      phase = 'idle'
      notifyActivityChanged()
    }
  }
}

/**
 * 对话页打字续问：截当前整屏 + 文字问题 → 回答并归档到当前会话。
 * 与快捷键语音链路互斥。
 */
export async function askScreenWithText(questionRaw: string): Promise<boolean> {
  const question = questionRaw.trim()
  if (!question) throw new Error(t('screenAsk.errEmptyQuestion'))

  const settings = getSettings()
  if (settings.screenAskEnabled === false) {
    throw new Error(t('screenAsk.disabled', { name: BRAND.screenAsk.name }))
  }
  if (phase !== 'idle') {
    showScreenAskProgressHud()
    return false
  }

  phase = 'capturing'
  const myRun = ++runId
  notifyActivityChanged()
  try {
    if (process.platform === 'darwin') {
      assertMacScreenCaptureAllowed()
    }
    await assertModelsReady()
    if (myRun !== runId) throw new TaskCancelledError()

    setPhaseHud({
      kind: 'recognizing',
      text: t('screenAsk.capturing'),
      detail: t('screenAsk.capturingDetail'),
      icon: 'look'
    })
    const shot = await captureFullScreen()
    if (myRun !== runId) throw new TaskCancelledError()

    phase = 'thinking'
    notifyActivityChanged()
    setPhaseHud({
      kind: 'generating',
      text: t('screenAsk.thinking'),
      detail: t('screenAsk.thinkingDetail'),
      icon: 'think'
    })
    let tick = 0
    clearThinkPulse()
    thinkPulseTimer = setInterval(() => {
      if (myRun !== runId) {
        clearThinkPulse()
        return
      }
      tick += 1
      setPhaseHud({
        kind: 'generating',
        text: tick % 2 === 0 ? t('screenAsk.thinking') : t('screenAsk.thinkingWait'),
        detail: t('screenAsk.thinkingDetail'),
        icon: 'think'
      })
    }, 2800)

    const { answer, archivedQuestion } = await resolveScreenAskAnswer(
      settings,
      shot.visionImage,
      question,
      myRun
    )
    if (myRun !== runId) throw new TaskCancelledError()
    clearThinkPulse()

    const saved = appendScreenAskTurn({
      sessionId: activeSessionId,
      question: archivedQuestion,
      answer,
      image: shot.visionImage
    })
    activeSessionId = saved.session.id
    onSessionUpdated?.(saved.session.id)

    clipboard.writeText(answer)
    lastHud = { kind: 'answer', text: answer }
    showHud({ kind: 'answer', text: answer })
    void speakText(`${t('screenAsk.answerSpeakPrefix')}${answer}`, { maxLen: 280 })
    return true
  } catch (err) {
    clearThinkPulse()
    if (isTaskCancelled(err) || myRun !== runId) {
      throw err instanceof Error ? err : new TaskCancelledError()
    }
    const message = err instanceof Error ? err.message : String(err)
    lastHud = { kind: 'error', text: message.slice(0, 120) }
    showHud({ kind: 'error', text: message.slice(0, 120) })
    throw err
  } finally {
    clearThinkPulse()
    if (myRun === runId) {
      phase = 'idle'
      notifyActivityChanged()
    }
  }
}
