import { formatRecordingHudText } from '../shared/hotkey'
import { getSettings } from './db'
import { showHud } from './hud'
import { pasteIntoFrontApp } from './paste'
import { startMicRecording, stopMicRecording } from './voice-recorder'
import { resolveSttConfig, transcribeAudio } from './stt'

let recording = false
let busy = false
let requestId = ''

export function isVoiceRecording(): boolean {
  return recording
}

export async function toggleVoiceInput(): Promise<void> {
  const settings = getSettings()
  if (!settings.voiceInputEnabled) {
    showHud({ kind: 'error', text: '我来口喷已关闭，可在设置中开启' })
    return
  }

  if (busy && !recording) {
    showHud({ kind: 'error', text: '我来口喷：正在处理上一段…' })
    return
  }

  if (!recording) {
    try {
      // fail fast if STT not configured
      resolveSttConfig(settings)
      showHud({ kind: 'recording', text: formatRecordingHudText() })
      requestId = await startMicRecording()
      recording = true
    } catch (err) {
      recording = false
      const message = err instanceof Error ? err.message : String(err)
      showHud({ kind: 'error', text: message.slice(0, 80) })
    }
    return
  }

  // stop + transcribe
  recording = false
  busy = true
  try {
    showHud({ kind: 'transcribing', text: '我来口喷：正在转成字…' })
    const { buffer, mime } = await stopMicRecording(requestId)
    if (!buffer.length) throw new Error('没有录到声音，请重试')

    const text = await transcribeAudio(settings, buffer, mime)
    const result = await pasteIntoFrontApp(text, 'keep-clipboard')
    if (result === 'pasted') {
      showHud({ kind: 'done', text: '我来口喷：已填入输入框，并已复制到剪贴板' })
    } else {
      showHud({ kind: 'done', text: '我来口喷：粘贴失败，文字已留在剪贴板' })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    showHud({ kind: 'error', text: message.slice(0, 80) })
  } finally {
    busy = false
    requestId = ''
  }
}
