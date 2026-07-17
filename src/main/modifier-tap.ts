import { uIOhook, UiohookKey } from 'uiohook-napi'

export type ModifierTapHandlers = {
  /** 单击修饰键（未与其它键组合）→ 我来口喷 */
  onSingleTap?: () => void
  /** 快速双击修饰键 → 帮你口喷 */
  onDoubleTap?: () => void
}

const DOUBLE_MS = 380

let started = false
let modDown = false
let chorded = false
let lastAloneTapAt = 0
let singleTimer: ReturnType<typeof setTimeout> | null = null
let handlers: ModifierTapHandlers = {}

function clearSingleTimer(): void {
  if (singleTimer) {
    clearTimeout(singleTimer)
    singleTimer = null
  }
}

/** 监听的修饰键：Mac = 左 Command(Meta)；Windows = Alt / AltRight */
function isTargetModifier(keycode: number): boolean {
  if (process.platform === 'win32') {
    return keycode === UiohookKey.Alt || keycode === UiohookKey.AltRight
  }
  return keycode === UiohookKey.Meta
}

function isAnyTargetModifier(keycode: number): boolean {
  if (process.platform === 'win32') {
    return keycode === UiohookKey.Alt || keycode === UiohookKey.AltRight
  }
  return keycode === UiohookKey.Meta || keycode === UiohookKey.MetaRight
}

/**
 * Mac：左 Command 单击 / 双击  
 * Windows：Alt 单击 / 双击  
 */
export function startModifierTapListener(next: ModifierTapHandlers): void {
  handlers = next
  if (started) return
  started = true

  uIOhook.on('keydown', (e) => {
    if (isTargetModifier(e.keycode)) {
      modDown = true
      chorded = false
      return
    }
    if (modDown && !isAnyTargetModifier(e.keycode)) {
      chorded = true
    }
  })

  uIOhook.on('keyup', (e) => {
    if (!isTargetModifier(e.keycode)) return
    const wasChorded = chorded
    modDown = false
    chorded = false
    if (wasChorded) return

    const now = Date.now()
    const gap = now - lastAloneTapAt

    if (lastAloneTapAt > 0 && gap > 0 && gap <= DOUBLE_MS) {
      clearSingleTimer()
      lastAloneTapAt = 0
      handlers.onDoubleTap?.()
      return
    }

    lastAloneTapAt = now
    clearSingleTimer()
    singleTimer = setTimeout(() => {
      singleTimer = null
      lastAloneTapAt = 0
      handlers.onSingleTap?.()
    }, DOUBLE_MS)
  })

  try {
    uIOhook.start()
  } catch (err) {
    console.error('Failed to start modifier tap listener', err)
  }
}

export function stopModifierTapListener(): void {
  if (!started) return
  clearSingleTimer()
  try {
    uIOhook.stop()
  } catch {
    // ignore
  }
  started = false
  handlers = {}
  modDown = false
  chorded = false
  lastAloneTapAt = 0
}

/** @deprecated 使用 startModifierTapListener */
export const startLeftCommandTapListener = startModifierTapListener
/** @deprecated 使用 stopModifierTapListener */
export const stopLeftCommandTapListener = stopModifierTapListener
