import { BRAND } from '../shared/brand'
import { formatHoldRecordingHudText, formatRecordingHudText } from '../shared/hotkey'
import { t } from '../shared/i18n'
import { captureFullScreen } from './capture'
import { getSettings } from './db'
import { showHud } from './hud'
import { cleanVoiceTranscript, enhancePromptForAi } from './llm'
import { pasteIntoFrontApp } from './paste'
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
  TaskCancelledError
} from './task-cancel'
import { notifyActivityChanged } from './activity-notify'
import { notifySkillGuideStep } from './skill-guide'

let recording = false
let busy = false
/** 当前录音来自按住增强（点按路径完全不走此标记） */
let holdMode = false
let holdImage: { base64: string; mime: string } | null = null
let holdReady: Promise<void> = Promise.resolve()
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
  holdImage = null
  holdFromUi = false
}

function kickStreamAsr(settings: ReturnType<typeof getSettings>): string {
  if (!prefersLocalStreamAsr(settings)) return ''
  if (!isStreamAsrInstalled()) {
    void ensureStreamAsr().catch(() => undefined)
    return t('voice.hud.downloadingAsr')
  }
  return ''
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
  pasted: string
): void {
  if (!settings.voiceCloudProofread || !usedLocal) return
  void transcribeAudio(settings, audio, mime)
    .then(async (cloud) => {
      const cleaned = await cleanVoiceTranscript(settings, cloud)
      if (cleaned && cleaned !== pasted) await pasteIntoFrontApp(cleaned, 'keep-clipboard')
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
  holdImage = null
  notifyActivityChanged()
  const myRun = ++runId
  holdReady = (async () => {
    try {
      if (!prefersLocalStreamAsr(settings)) {
        resolveSttConfig(settings)
      }
      const asrHint = kickStreamAsr(settings)
      const shotP = captureFullScreen()
        .then((shot) => {
          if (myRun === runId) holdImage = shot.visionImage
        })
        .catch(() => {
          /* 静默失败：仍凭口述增强 */
        })
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
      requestId = await startMicRecording({ stream: prefersLocalStreamAsr(settings) })
      if (myRun !== runId) {
        discardMicRecording()
        return
      }
      recording = true
      notifyActivityChanged()
      await shotP
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

/** 按住抬起：转写 → 增强 → 粘贴，不发送 */
export async function endVoiceHold(): Promise<void> {
  if (!holdMode) return
  const settings = getSettings()
  const myRun = runId
  busy = true
  notifyActivityChanged()
  try {
    await holdReady
    if (myRun !== runId) throw new TaskCancelledError()
    if (!holdMode) return
    recording = false
    if (!requestId) throw new Error(t('screenAsk.errNoAudio'))

    setVoicePartialTranscriptHandler(null)
    const { buffer, mime, streamedText, liveText } = await stopMicRecording(requestId)
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
    } else {
      showHud({
        kind: 'transcribing',
        text: t('voice.hud.transcribing'),
        detail: t('voice.hud.busyDetail'),
        icon: 'write'
      })
    }
    const signal = beginNetworkWork()
    const spokenRaw = await transcribeUtterance(settings, buffer, mime, streamedText, signal)
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
    const spoken = await cleanVoiceTranscript(settings, spokenRaw, signal)
    if (myRun !== runId) throw new TaskCancelledError()

    showHud({
      kind: 'generating',
      text: t('voice.hud.enhancing'),
      detail: t('voice.hud.enhancingDetail'),
      icon: 'think'
    })
    const enhanced = await enhancePromptForAi(
      settings,
      holdImage,
      spoken,
      signal,
      (phase) => {
        if (myRun !== runId) return
        if (phase === 'reading') {
          showHud({
            kind: 'generating',
            text: t('voice.hud.enhanceReading'),
            detail: t('voice.hud.enhanceReadingDetail'),
            icon: 'look'
          })
          return
        }
        showHud({
          kind: 'generating',
          text: t('voice.hud.enhancing'),
          detail: t('voice.hud.enhancingDetail'),
          icon: 'think'
        })
      }
    )
    if (myRun !== runId) throw new TaskCancelledError()

    const result = await pasteIntoFrontApp(enhanced, 'keep-clipboard')
    if (myRun !== runId) throw new TaskCancelledError()
    if (result === 'pasted') {
      showHud({ kind: 'done', text: t('voice.hud.enhancedPasted') })
    } else {
      showHud({ kind: 'done', text: t('voice.hud.pasteFail') })
    }
    if (!holdFromUi) notifySkillGuideStep('aiTalk', true)
  } catch (err) {
    if (isTaskCancelled(err) || myRun !== runId) {
      return
    }
    const message = err instanceof Error ? err.message : String(err)
    showHud({ kind: 'error', text: message.slice(0, 80) })
  } finally {
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
      requestId = await startMicRecording({ stream: prefersLocalStreamAsr(settings) })
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
    maybeCloudProofread(settings, buffer, mime, usedLocal, text)
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
