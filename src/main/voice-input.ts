import { BRAND } from '../shared/brand'
import { formatRecordingHudText } from '../shared/hotkey'
import { t } from '../shared/i18n'
import { getSettings } from './db'
import { showHud } from './hud'
import { pasteIntoFrontApp } from './paste'
import {
  isScreenAskBusy,
  isScreenAskListening,
  showScreenAskProgressHud,
  stopScreenAskIfListening
} from './screen-ask'
import { discardMicRecording, startMicRecording, stopMicRecording } from './voice-recorder'
import { resolveSttConfig, transcribeAudio } from './stt'
import {
  abortNetworkWork,
  beginNetworkWork,
  isTaskCancelled,
  TaskCancelledError
} from './task-cancel'
import { notifyActivityChanged } from './activity-notify'

let recording = false
let busy = false
let requestId = ''
let runId = 0

export function isVoiceRecording(): boolean {
  return recording
}

export function isVoiceBusy(): boolean {
  return recording || busy
}

/** Esc：立刻停下语音链路 */
export function cancelVoiceInput(): boolean {
  if (!recording && !busy) return false
  runId += 1
  abortNetworkWork()
  if (recording || requestId) {
    discardMicRecording()
  }
  recording = false
  busy = false
  requestId = ''
  notifyActivityChanged()
  return true
}

export async function toggleVoiceInput(): Promise<void> {
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
      resolveSttConfig(settings)
      showHud({
        kind: 'recording',
        text: formatRecordingHudText(process.platform, settings.voiceTrigger)
      })
      requestId = await startMicRecording()
      recording = true
      notifyActivityChanged()
    } catch (err) {
      recording = false
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
  try {
    showHud({
      kind: 'transcribing',
      text: t('voice.hud.transcribing'),
      detail: t('voice.hud.busyDetail'),
      icon: 'write'
    })
    const { buffer, mime } = await stopMicRecording(requestId)
    if (myRun !== runId) throw new TaskCancelledError()
    if (!buffer.length) throw new Error(t('screenAsk.errNoAudio'))

    const signal = beginNetworkWork()
    const text = await transcribeAudio(settings, buffer, mime, signal)
    if (myRun !== runId) throw new TaskCancelledError()
    const result = await pasteIntoFrontApp(text, 'keep-clipboard')
    if (myRun !== runId) throw new TaskCancelledError()
    if (result === 'pasted') {
      showHud({ kind: 'done', text: t('voice.hud.pasted') })
    } else {
      showHud({ kind: 'done', text: t('voice.hud.pasteFail') })
    }
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
  }
}
