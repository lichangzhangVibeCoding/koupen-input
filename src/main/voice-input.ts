import { BRAND } from '../shared/brand'
import { formatHoldRecordingHudText, formatRecordingHudText } from '../shared/hotkey'
import { t } from '../shared/i18n'
import { captureForEnhance } from './capture'
import { getSettings } from './db'
import { showHud } from './hud'
import {
  cleanVoiceTranscript,
  EMPTY_SCREEN_CONTEXT,
  extractPromptScreenContext,
  rewriteSpokenAsAiPrompt,
  stripSpokenFillers
} from './llm'
import { pasteIntoFrontApp, replaceLastPastedText } from './paste'
import {
  isScreenAskBusy,
  isScreenAskListening,
  showScreenAskProgressHud,
  stopScreenAskIfListening
} from './screen-ask'
import {
  discardMicRecording,
  setVoicePartialTranscriptHandler,
  startMicRecording,
  stopMicRecording
} from './voice-recorder'
import { resolveSttConfig, transcribeAudio, transcribeUtterance, prefersLocalStreamAsr } from './stt'
import { ensureStreamAsr, isStreamAsrInstalled } from './local-asr-stream'
import {
  abortNetworkWork,
  beginNetworkWork,
  isTaskCancelled,
  raceDeadline,
  TaskCancelledError
} from './task-cancel'
import { notifyActivityChanged } from './activity-notify'
import { notifySkillGuideStep } from './skill-guide'

let recording = false
let busy = false
/** 当前录音来自按住增强（点按路径完全不走此标记） */
let holdMode = false
/** 麦已开；松手只等这个，不等截图 */
let holdMicReady: Promise<void> = Promise.resolve()
/** 按住期间已开始的读屏；失败/超时则为「无相关上下文」 */
let holdScreenNotes: Promise<string> | null = null
let holdVisionAbort: AbortController | null = null
/** 首页「与AI对话」点按开关（HUD 写再点一次结束，而非松手） */
let holdFromUi = false
let tapFromUi = false
let requestId = ''
let runId = 0

export function isVoiceRecording(): boolean {
  return recording
}

export function isVoiceBusy(): boolean {
  return recording || busy || holdMode
}

export function isVoiceHoldActive(): boolean {
  return holdMode
}

function resetHoldState(): void {
  holdMode = false
  holdFromUi = false
  holdScreenNotes = null
  if (holdVisionAbort && !holdVisionAbort.signal.aborted) {
    holdVisionAbort.abort()
  }
  holdVisionAbort = null
}

function kickStreamAsr(settings: ReturnType<typeof getSettings>): string {
  if (!prefersLocalStreamAsr(settings)) return ''
  if (!isStreamAsrInstalled()) {
    void ensureStreamAsr().catch(() => undefined)
    return t('voice.hud.downloadingAsr')
  }
  return ''
}

function logEnhance(t0: number, stage: string, extra = ''): void {
  console.warn(`[enhance] ${stage} +${Date.now() - t0}ms${extra ? ` ${extra}` : ''}`)
}

function startEnhancePulse(
  myRun: number,
  getHud: (sec: number) => {
    kind: 'transcribing' | 'generating'
    text: string
    detail?: string
    icon?: 'write' | 'look' | 'think'
  }
): () => void {
  const t0 = Date.now()
  const tick = (): void => {
    if (myRun !== runId) return
    const sec = Math.floor((Date.now() - t0) / 1000)
    const hud = getHud(sec)
    const wait = sec >= 2 ? t('voice.hud.waitSec', { n: sec }) : ''
    showHud({
      ...hud,
      detail: [hud.detail, wait].filter(Boolean).join(' · ')
    })
  }
  tick()
  const id = setInterval(tick, 2000)
  return () => clearInterval(id)
}

async function flashAsrCorrection(
  liveText: string,
  finalText: string,
  title: string,
  myRun: number
): Promise<void> {
  const live = liveText.trim()
  const final = finalText.trim()
  if (!final) return
  const changed = Boolean(live && live !== final)
  showHud({
    kind: changed ? 'transcribing' : 'recording',
    text: changed ? t('voice.hud.corrected') : title,
    detail: final,
    icon: changed ? 'write' : 'listen'
  })
  if (!changed) return
  await new Promise<void>((resolve) => setTimeout(resolve, 340))
  if (myRun !== runId) throw new TaskCancelledError()
}

function maybeCloudProofread(
  settings: ReturnType<typeof getSettings>,
  audio: Buffer,
  mime: string,
  usedLocal: boolean,
  pasted: string,
  firstPaste: 'pasted' | 'clipboard',
  myRun: number
): void {
  if (!settings.voiceCloudProofread || !usedLocal) return
  void transcribeAudio(settings, audio, mime)
    .then(async (cloud) => {
      if (myRun !== runId) return
      const cleaned = await cleanVoiceTranscript(settings, cloud)
      if (!cleaned || cleaned === pasted) return
      if (myRun !== runId) return
      // 第一次没进输入框就别再 Cmd/Ctrl+V，否则会叠成两段
      if (firstPaste !== 'pasted') return
      const result = await replaceLastPastedText(cleaned, 'keep-clipboard')
      if (myRun !== runId) return
      if (result === 'pasted') {
        showHud({ kind: 'done', text: t('voice.hud.cloudProofread') })
      }
    })
    .catch(() => undefined)
}

/** Esc：立刻停下语音链路（点按与按住共用） */
export function cancelVoiceInput(): boolean {
  if (!recording && !busy && !holdMode) return false
  runId += 1
  abortNetworkWork()
  if (recording || requestId || holdMode) {
    discardMicRecording()
  }
  recording = false
  busy = false
  requestId = ''
  resetHoldState()
  setVoicePartialTranscriptHandler(null)
  notifyActivityChanged()
  return true
}

/** 按住过程中变成组合键：丢弃增强，不贴字 */
export function cancelHoldVoiceInput(): boolean {
  if (!holdMode) return false
  const stopped = cancelVoiceInput()
  if (stopped) {
    showHud({ kind: 'done', text: t('voice.hud.holdCancelled') })
  }
  return stopped
}

/**
 * 语音键按住满 400ms 且仍空闲时进入增强。
 * 返回 false：不进入按住，抬起仍走点按（含点按录音中结束、看屏幕听音结束）。
 */
export function beginVoiceHold(opts?: { fromUi?: boolean }): boolean {
  if (isScreenAskListening() || isScreenAskBusy()) return false
  if (recording || busy || holdMode) return false
  const settings = getSettings()
  if (!settings.voiceInputEnabled) return false

  holdMode = true
  holdFromUi = Boolean(opts?.fromUi)
  holdScreenNotes = null
  holdVisionAbort = null
  notifyActivityChanged()
  const myRun = ++runId
  if (settings.enhanceScreenCaptureEnabled === true) {
    holdVisionAbort = new AbortController()
    const visionAbort = holdVisionAbort
    holdScreenNotes = captureForEnhance()
      .then((shot) => {
        if (myRun !== runId || visionAbort.signal.aborted) return EMPTY_SCREEN_CONTEXT
        return extractPromptScreenContext(settings, shot.visionImage, visionAbort.signal, {
          appName: shot.appName,
          windowTitle: shot.windowTitle
        })
      })
      .catch(() => EMPTY_SCREEN_CONTEXT)
  } else {
    holdScreenNotes = Promise.resolve(EMPTY_SCREEN_CONTEXT)
  }
  holdMicReady = (async () => {
    try {
      if (!prefersLocalStreamAsr(settings)) {
        resolveSttConfig(settings)
      }
      const asrHint = kickStreamAsr(settings)
      showHud({
        kind: 'recording',
        text: holdFromUi
          ? t('hotkey.holdRecordingUi')
          : formatHoldRecordingHudText(process.platform, settings.voiceTrigger),
        ...(asrHint ? { detail: asrHint } : {})
      })
      setVoicePartialTranscriptHandler((partial) => {
        if (myRun !== runId || !holdMode) return
        showHud({
          kind: 'recording',
          text: holdFromUi
            ? t('hotkey.holdRecordingUi')
            : formatHoldRecordingHudText(process.platform, settings.voiceTrigger),
          detail: partial
        })
      })
      requestId = await raceDeadline(
        startMicRecording({ stream: prefersLocalStreamAsr(settings) }),
        12_000,
        '麦克风迟迟没打开，请再试一次'
      )
      if (myRun !== runId) {
        discardMicRecording()
        return
      }
      recording = true
      notifyActivityChanged()
    } catch (err) {
      if (myRun !== runId) return
      recording = false
      resetHoldState()
      requestId = ''
      setVoicePartialTranscriptHandler(null)
      const message = err instanceof Error ? err.message : String(err)
      showHud({ kind: 'error', text: message.slice(0, 80) })
      notifyActivityChanged()
    }
  })()
  return true
}

/** 按住抬起：立刻停麦；转写与读屏并行 → 写提示词 → 粘贴，不发送 */
export async function endVoiceHold(): Promise<void> {
  if (!holdMode) return
  const settings = getSettings()
  const myRun = runId
  const notesP = holdScreenNotes
  const t0 = Date.now()
  busy = true
  notifyActivityChanged()
  let stopPulse: (() => void) | null = null
  let pulsePhase: 'stt' | 'notes' | 'write' = 'stt'
  try {
    showHud({
      kind: 'transcribing',
      text: t('voice.hud.stopping'),
      detail: t('voice.hud.busyDetail'),
      icon: 'write'
    })
    logEnhance(t0, 'end')
    await raceDeadline(holdMicReady, 12_000, t('screenAsk.errNoAudio'))
    if (myRun !== runId) throw new TaskCancelledError()
    if (!holdMode) return
    recording = false
    if (!requestId) throw new Error(t('screenAsk.errNoAudio'))

    setVoicePartialTranscriptHandler(null)
    const { buffer, mime, streamedText, liveText } = await stopMicRecording(requestId)
    logEnhance(t0, 'mic-stopped', `${buffer.length}b`)
    if (myRun !== runId) throw new TaskCancelledError()
    if (!buffer.length) throw new Error(t('screenAsk.errNoAudio'))

    const usedLocal = prefersLocalStreamAsr(settings) && Boolean(streamedText.trim())
    if (usedLocal) {
      await flashAsrCorrection(
        liveText,
        streamedText,
        holdFromUi
          ? t('hotkey.holdRecordingUi')
          : formatHoldRecordingHudText(process.platform, settings.voiceTrigger),
        myRun
      )
    }

    stopPulse = startEnhancePulse(myRun, (sec) => {
      if (pulsePhase === 'notes') {
        return {
          kind: 'generating',
          text: t('voice.hud.enhanceReading'),
          detail: t('voice.hud.enhanceReadingDetail'),
          icon: 'look'
        }
      }
      if (pulsePhase === 'write') {
        return {
          kind: 'generating',
          text: t('voice.hud.enhancing'),
          detail: sec >= 12 ? t('voice.hud.enhancingSlow') : t('voice.hud.enhancingDetail'),
          icon: 'think'
        }
      }
      return {
        kind: 'transcribing',
        text: t('voice.hud.transcribing'),
        detail: t('voice.hud.busyDetail'),
        icon: 'write'
      }
    })

    const signal = beginNetworkWork()
    const notesTracked = (notesP ?? Promise.resolve(EMPTY_SCREEN_CONTEXT)).then(
      (v) => v || EMPTY_SCREEN_CONTEXT
    )

    const spokenRaw = await transcribeUtterance(
      settings,
      buffer,
      mime,
      streamedText,
      signal,
      prefersLocalStreamAsr(settings) ? { preferLocalFallback: true } : undefined
    )
    logEnhance(t0, 'stt', `${spokenRaw.length}c ${spokenRaw.slice(0, 40)}`)
    if (myRun !== runId) throw new TaskCancelledError()
    const spoken =
      settings.voiceStripFillersEnabled !== false ? stripSpokenFillers(spokenRaw) || spokenRaw : spokenRaw

    let notes = EMPTY_SCREEN_CONTEXT
    if (settings.enhanceScreenCaptureEnabled === true) {
      pulsePhase = 'notes'
      try {
        notes = await raceDeadline(notesTracked, 1600, 'VISION_WAIT')
        logEnhance(t0, 'notes-ready', notes.slice(0, 40))
      } catch {
        logEnhance(t0, 'notes-skip')
        showHud({
          kind: 'generating',
          text: t('voice.hud.enhanceReading'),
          detail: t('voice.hud.enhanceReadingSlow'),
          icon: 'look'
        })
        notes = EMPTY_SCREEN_CONTEXT
      }
    } else {
      logEnhance(t0, 'notes-off')
    }

    if (holdVisionAbort && !holdVisionAbort.signal.aborted) {
      holdVisionAbort.abort()
    }
    if (myRun !== runId) throw new TaskCancelledError()
    pulsePhase = 'write'
    const rewritten = await rewriteSpokenAsAiPrompt(settings, spoken, notes, signal)
    logEnhance(t0, 'rewritten', `${rewritten.length}c`)
    if (myRun !== runId) throw new TaskCancelledError()

    stopPulse()
    stopPulse = null
    const result = await pasteIntoFrontApp(rewritten, 'keep-clipboard')
    if (myRun !== runId) throw new TaskCancelledError()
    if (result === 'pasted') {
      showHud({
        kind: 'done',
        text: t('voice.hud.enhancedPasted')
      })
    } else {
      showHud({ kind: 'done', text: t('voice.hud.pasteFail') })
    }
    if (!holdFromUi) notifySkillGuideStep('aiTalk', true)
  } catch (err) {
    if (isTaskCancelled(err) || myRun !== runId) {
      return
    }
    logEnhance(t0, 'error', err instanceof Error ? err.message : String(err))
    const message = err instanceof Error ? err.message : String(err)
    showHud({ kind: 'error', text: message.slice(0, 80) })
  } finally {
    stopPulse?.()
    if (myRun === runId) {
      recording = false
      busy = false
      requestId = ''
      resetHoldState()
      notifyActivityChanged()
    }
    setVoicePartialTranscriptHandler(null)
  }
}

/** 首页「与AI对话」：点按开始增强录音，再点结束（等价按住松手） */
export async function toggleVoiceHold(): Promise<'started' | 'finished'> {
  if (isScreenAskListening() || isScreenAskBusy()) {
    if (isScreenAskBusy()) showScreenAskProgressHud()
    throw new Error(t('voice.hud.busy'))
  }
  if (recording && !holdMode) {
    showHud({
      kind: 'transcribing',
      text: t('voice.hud.busy'),
      detail: t('voice.hud.busyDetail'),
      icon: 'write'
    })
    throw new Error(t('voice.hud.busy'))
  }
  if (holdMode) {
    if (busy && !recording) {
      showHud({
        kind: 'transcribing',
        text: t('voice.hud.busy'),
        detail: t('voice.hud.busyDetail'),
        icon: 'write'
      })
      throw new Error(t('voice.hud.busy'))
    }
    await endVoiceHold()
    return 'finished'
  }
  const settings = getSettings()
  if (!settings.voiceInputEnabled) {
    throw new Error(t('voice.hud.disabled', { name: BRAND.voice.name }))
  }
  const ok = beginVoiceHold({ fromUi: true })
  if (!ok) throw new Error(t('voice.hud.busy'))
  return 'started'
}

export async function toggleVoiceInput(opts?: { fromUi?: boolean }): Promise<void> {
  // 看屏幕听音中：单击修饰键 = 结束提问
  if (isScreenAskListening()) {
    await stopScreenAskIfListening()
    return
  }

  // 看屏幕其它阶段（截屏/播报/转写/思考）：重亮进度，不抢流程
  if (isScreenAskBusy()) {
    showScreenAskProgressHud()
    return
  }

  if (holdMode) {
    showHud({
      kind: 'transcribing',
      text: t('voice.hud.busy'),
      detail: t('voice.hud.busyDetail'),
      icon: 'write'
    })
    return
  }

  const settings = getSettings()
  if (!settings.voiceInputEnabled) {
    showHud({ kind: 'error', text: t('voice.hud.disabled', { name: BRAND.voice.name }) })
    return
  }

  if (busy && !recording) {
    showHud({
      kind: 'transcribing',
      text: t('voice.hud.busy'),
      detail: t('voice.hud.busyDetail'),
      icon: 'write'
    })
    return
  }

  if (!recording) {
    try {
      tapFromUi = Boolean(opts?.fromUi)
      if (!prefersLocalStreamAsr(settings)) {
        resolveSttConfig(settings)
      }
      const asrHint = kickStreamAsr(settings)
      showHud({
        kind: 'recording',
        text: formatRecordingHudText(process.platform, settings.voiceTrigger),
        ...(asrHint ? { detail: asrHint } : {})
      })
      setVoicePartialTranscriptHandler((partial) => {
        if (!recording) return
        showHud({
          kind: 'recording',
          text: formatRecordingHudText(process.platform, getSettings().voiceTrigger),
          detail: partial
        })
      })
      requestId = await raceDeadline(
        startMicRecording({ stream: prefersLocalStreamAsr(settings) }),
        12_000,
        '麦克风迟迟没打开，请再试一次'
      )
      recording = true
      notifyActivityChanged()
    } catch (err) {
      recording = false
      setVoicePartialTranscriptHandler(null)
      const message = err instanceof Error ? err.message : String(err)
      showHud({ kind: 'error', text: message.slice(0, 80) })
      notifyActivityChanged()
    }
    return
  }

  recording = false
  busy = true
  notifyActivityChanged()
  const myRun = ++runId
  setVoicePartialTranscriptHandler(null)
  try {
    const { buffer, mime, streamedText, liveText } = await stopMicRecording(requestId)
    if (myRun !== runId) throw new TaskCancelledError()
    if (!buffer.length) throw new Error(t('screenAsk.errNoAudio'))

    const usedLocal = prefersLocalStreamAsr(settings) && Boolean(streamedText.trim())
    if (usedLocal) {
      await flashAsrCorrection(
        liveText,
        streamedText,
        formatRecordingHudText(process.platform, settings.voiceTrigger),
        myRun
      )
    } else {
      showHud({
        kind: 'transcribing',
        text: t('voice.hud.transcribing'),
        detail: t('voice.hud.busyDetail'),
        icon: 'write'
      })
    }
    const signal = beginNetworkWork()
    const textRaw = await transcribeUtterance(settings, buffer, mime, streamedText, signal)
    if (myRun !== runId) throw new TaskCancelledError()
    const needsCleanup =
      settings.voiceStripFillersEnabled !== false || settings.voiceFixSttTyposEnabled === true
    if (needsCleanup) {
      showHud({
        kind: 'transcribing',
        text: t('voice.hud.cleaning'),
        detail: t('voice.hud.cleaningDetail'),
        icon: 'write'
      })
    }
    const text = await cleanVoiceTranscript(settings, textRaw, signal)
    if (myRun !== runId) throw new TaskCancelledError()
    const result = await pasteIntoFrontApp(text, 'keep-clipboard')
    if (myRun !== runId) throw new TaskCancelledError()
    if (result === 'pasted') {
      showHud({ kind: 'done', text: t('voice.hud.pasted') })
    } else {
      showHud({ kind: 'done', text: t('voice.hud.pasteFail') })
    }
    maybeCloudProofread(settings, buffer, mime, usedLocal, text, result, myRun)
    if (!tapFromUi) notifySkillGuideStep('voice', true)
  } catch (err) {
    if (isTaskCancelled(err) || myRun !== runId) {
      // HUD 由 cancelAll 统一提示
      return
    }
    const message = err instanceof Error ? err.message : String(err)
    showHud({ kind: 'error', text: message.slice(0, 80) })
  } finally {
    if (myRun === runId) {
      busy = false
      requestId = ''
      notifyActivityChanged()
    }
    setVoicePartialTranscriptHandler(null)
  }
}
