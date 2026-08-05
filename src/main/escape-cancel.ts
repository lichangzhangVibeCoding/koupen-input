import { globalShortcut } from 'electron'
import { uIOhook, UiohookKey } from 'uiohook-napi'
import { t } from '../shared/i18n'
import { onActivityChanged } from './activity-notify'
import { showHud } from './hud'
import { cancelCapturePipeline, isReplyBusy } from './pipeline'
import { cancelScreenAsk, isScreenAskBusy } from './screen-ask'
import { isSpeaking, stopSpeaking } from './speak'
import { cancelVoiceInput, isVoiceBusy } from './voice-input'

let escShortcutOn = false
let uioAttached = false

function anyBusy(): boolean {
  return isVoiceBusy() || isReplyBusy() || isScreenAskBusy() || isSpeaking()
}

/** 停下所有进行中的能力；有取消则提示 HUD */
export function cancelAllActiveTasks(): boolean {
  const speaking = isSpeaking()
  if (speaking) stopSpeaking()
  const a = cancelVoiceInput()
  const b = cancelCapturePipeline()
  const c = cancelScreenAsk()
  const cancelled = a || b || c || speaking
  if (cancelled) {
    showHud({
      kind: 'done',
      text: t('hud.cancelled'),
      detail: t('hud.cancelledDetail')
    })
  }
  syncEscapeShortcut()
  return cancelled
}

function syncEscapeShortcut(): void {
  const busy = anyBusy()
  if (busy && !escShortcutOn) {
    try {
      escShortcutOn = globalShortcut.register('Escape', () => {
        cancelAllActiveTasks()
      })
      if (!escShortcutOn) {
        console.warn('[esc] Failed to register Escape shortcut')
      }
    } catch (err) {
      console.warn('[esc] register Escape failed', err)
      escShortcutOn = false
    }
  } else if (!busy && escShortcutOn) {
    try {
      globalShortcut.unregister('Escape')
    } catch {
      // ignore
    }
    escShortcutOn = false
  }
}

function attachUioEscape(): void {
  if (uioAttached) return
  uioAttached = true
  uIOhook.on('keydown', (e) => {
    if (e.keycode !== UiohookKey.Escape) return
    if (!anyBusy()) return
    cancelAllActiveTasks()
  })
}

/** 在 app ready 后调用一次 */
export function initEscapeCancel(): void {
  onActivityChanged(() => syncEscapeShortcut())
  attachUioEscape()
  syncEscapeShortcut()
}

export function disposeEscapeCancel(): void {
  onActivityChanged(null)
  if (escShortcutOn) {
    try {
      globalShortcut.unregister('Escape')
    } catch {
      // ignore
    }
    escShortcutOn = false
  }
}
