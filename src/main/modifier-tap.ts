import { uIOhook, UiohookKey } from 'uiohook-napi'
import {
  DEFAULT_VOICE_TRIGGER,
  normalizeVoiceTrigger,
  type VoiceTriggerId
} from '../shared/hotkey'
import { hasMacAccessibility, macAccessibilityApisAllowed } from './permissions'

export type ModifierTapHandlers = {
  /** 单击语音触发键（未与其它键组合）→ 即刻对话 */
  onSingleTap?: () => void
  /** 快速双击回复修饰键 → 帮我对话 */
  onDoubleTap?: () => void
  /** 右 Command + Shift + 1 → 看屏幕 */
  onScreenAsk?: () => void
  /** 右 Command + Shift + 2 → 看屏幕答题 */
  onScreenQuiz?: () => void
  /** 右 Command + 8 → 语音（硬件备用） */
  onHardwareVoice?: () => void
  /** 右 Command + 0 → 帮我对话（硬件备用） */
  onHardwareReply?: () => void
}

const DOUBLE_MS = 380
/** libuiohook VC_FUNCTION（macOS only） */
const FN_KEYCODE = 0x020e
/** Apple kVK_Function，部分环境可能直接报这个 */
const FN_KEYCODE_APPLE = 63

let hookRunning = false
let listenersAttached = false
let voiceTrigger: VoiceTriggerId = DEFAULT_VOICE_TRIGGER
let handlers: ModifierTapHandlers = {}

type TapLane = {
  down: boolean
  chorded: boolean
  lastAloneTapAt: number
  singleTimer: ReturnType<typeof setTimeout> | null
}

const voiceLane: TapLane = {
  down: false,
  chorded: false,
  lastAloneTapAt: 0,
  singleTimer: null
}
const replyLane: TapLane = {
  down: false,
  chorded: false,
  lastAloneTapAt: 0,
  singleTimer: null
}

let shiftDown = false
/** 右 Command 是否按下（组合键 / 硬件备用，与语音触发解耦） */
let chordModDown = false

function clearLaneTimer(lane: TapLane): void {
  if (lane.singleTimer) {
    clearTimeout(lane.singleTimer)
    lane.singleTimer = null
  }
}

function resetLane(lane: TapLane): void {
  clearLaneTimer(lane)
  lane.down = false
  lane.chorded = false
  lane.lastAloneTapAt = 0
}

function isShiftKey(keycode: number): boolean {
  return keycode === UiohookKey.Shift || keycode === UiohookKey.ShiftRight
}

function isFnKey(keycode: number): boolean {
  return keycode === FN_KEYCODE || keycode === FN_KEYCODE_APPLE
}

/** 语音单击监听的键 */
function isVoiceKey(keycode: number): boolean {
  if (process.platform === 'win32') {
    return keycode === UiohookKey.Alt || keycode === UiohookKey.AltRight
  }
  switch (voiceTrigger) {
    case 'rightOption':
      return keycode === UiohookKey.AltRight
    case 'fn':
      return isFnKey(keycode)
    default:
      return keycode === UiohookKey.MetaRight
  }
}

/**
 * 帮我对话双击监听的键（与语音可分离）
 * Mac：始终右 Command；Win：Alt
 */
function isReplyDoubleKey(keycode: number): boolean {
  if (process.platform === 'win32') {
    return keycode === UiohookKey.Alt || keycode === UiohookKey.AltRight
  }
  return keycode === UiohookKey.MetaRight
}

/** 看屏幕组合 / 硬件备用的修饰基键：Mac 右 Command */
function isChordBaseKey(keycode: number): boolean {
  if (process.platform !== 'darwin') return false
  return keycode === UiohookKey.MetaRight
}

function voiceSharesReplyKey(): boolean {
  if (process.platform === 'win32') return true
  return voiceTrigger === 'rightCommand'
}

function handleAloneKeyUp(lane: TapLane, mode: 'voiceOnly' | 'replyDouble' | 'shared'): void {
  const now = Date.now()
  const gap = now - lane.lastAloneTapAt

  if (
    (mode === 'replyDouble' || mode === 'shared') &&
    lane.lastAloneTapAt > 0 &&
    gap > 0 &&
    gap <= DOUBLE_MS
  ) {
    clearLaneTimer(lane)
    lane.lastAloneTapAt = 0
    handlers.onDoubleTap?.()
    return
  }

  if (mode === 'replyDouble') {
    // 单独单击回复键：不触发语音；只等待可能的双击
    lane.lastAloneTapAt = now
    clearLaneTimer(lane)
    lane.singleTimer = setTimeout(() => {
      lane.singleTimer = null
      lane.lastAloneTapAt = 0
    }, DOUBLE_MS)
    return
  }

  if (mode === 'voiceOnly') {
    // 与回复键分离：抬起即切换录音，无需等双击窗口
    lane.lastAloneTapAt = 0
    clearLaneTimer(lane)
    handlers.onSingleTap?.()
    return
  }

  // shared：单击延迟触发语音，窗口内第二次 = 双击回复
  lane.lastAloneTapAt = now
  clearLaneTimer(lane)
  lane.singleTimer = setTimeout(() => {
    lane.singleTimer = null
    lane.lastAloneTapAt = 0
    handlers.onSingleTap?.()
  }, DOUBLE_MS)
}

function attachListeners(): void {
  if (listenersAttached) return
  listenersAttached = true

  uIOhook.on('keydown', (e) => {
    if (isShiftKey(e.keycode)) {
      shiftDown = true
    }

    const asVoice = isVoiceKey(e.keycode)
    const asReply = isReplyDoubleKey(e.keycode)
    const asChord = isChordBaseKey(e.keycode)

    if (asChord) {
      chordModDown = true
    }

    if (voiceSharesReplyKey() && asVoice) {
      voiceLane.down = true
      voiceLane.chorded = false
      replyLane.down = true
      replyLane.chorded = false
    } else {
      if (asVoice) {
        voiceLane.down = true
        voiceLane.chorded = false
      }
      if (asReply) {
        replyLane.down = true
        replyLane.chorded = false
      }
    }

    // Mac：右 Command 组合键（分得出左右；globalShortcut 做不到）
    if (process.platform === 'darwin' && chordModDown) {
      if (shiftDown && e.keycode === UiohookKey[1]) {
        markChorded()
        clearLaneTimer(voiceLane)
        clearLaneTimer(replyLane)
        handlers.onScreenAsk?.()
        return
      }
      if (shiftDown && e.keycode === UiohookKey[2]) {
        markChorded()
        clearLaneTimer(voiceLane)
        clearLaneTimer(replyLane)
        handlers.onScreenQuiz?.()
        return
      }
      if (e.keycode === UiohookKey[8]) {
        markChorded()
        clearLaneTimer(voiceLane)
        clearLaneTimer(replyLane)
        handlers.onHardwareVoice?.()
        return
      }
      if (e.keycode === UiohookKey[0]) {
        markChorded()
        clearLaneTimer(voiceLane)
        clearLaneTimer(replyLane)
        handlers.onHardwareReply?.()
        return
      }
    }

    // 其它键按下：若某修饰键正按着，记为组合，不触发单击/双击
    if (!asVoice && !asReply && !asChord && !isShiftKey(e.keycode)) {
      if (voiceLane.down) voiceLane.chorded = true
      if (replyLane.down) replyLane.chorded = true
    }
  })

  uIOhook.on('keyup', (e) => {
    if (isShiftKey(e.keycode)) {
      shiftDown = false
    }
    if (isChordBaseKey(e.keycode)) {
      chordModDown = false
    }

    const asVoice = isVoiceKey(e.keycode)
    const asReply = isReplyDoubleKey(e.keycode)

    if (voiceSharesReplyKey() && asVoice) {
      const wasChorded = voiceLane.chorded || replyLane.chorded
      voiceLane.down = false
      replyLane.down = false
      voiceLane.chorded = false
      replyLane.chorded = false
      if (wasChorded) return
      handleAloneKeyUp(voiceLane, 'shared')
      return
    }

    if (asVoice) {
      const wasChorded = voiceLane.chorded
      voiceLane.down = false
      voiceLane.chorded = false
      if (!wasChorded) handleAloneKeyUp(voiceLane, 'voiceOnly')
    }

    if (asReply) {
      const wasChorded = replyLane.chorded
      replyLane.down = false
      replyLane.chorded = false
      if (!wasChorded) handleAloneKeyUp(replyLane, 'replyDouble')
    }
  })
}

function markChorded(): void {
  voiceLane.chorded = true
  replyLane.chorded = true
}

/** 未授权辅助功能时不启动 uIOhook，避免反复弹系统窗 */
export function tryStartModifierTapHook(): boolean {
  if (hookRunning) return true
  if (!macAccessibilityApisAllowed()) {
    return false
  }
  if (process.platform === 'darwin' && !hasMacAccessibility()) {
    return false
  }
  attachListeners()
  try {
    uIOhook.start()
    hookRunning = true
    return true
  } catch (err) {
    console.error('Failed to start modifier tap listener', err)
    return false
  }
}

export type ModifierTapConfig = {
  voiceTrigger?: VoiceTriggerId
}

/**
 * Mac：语音触发键单击 / 右 Command 双击与组合键
 * Windows：Alt 单击 / 双击
 */
export function startModifierTapListener(
  next: ModifierTapHandlers,
  config?: ModifierTapConfig
): boolean {
  handlers = next
  if (config?.voiceTrigger != null) {
    voiceTrigger = normalizeVoiceTrigger(config.voiceTrigger)
  }
  return tryStartModifierTapHook()
}

/** 运行中切换语音触发键（保存设置后调用） */
export function setModifierTapVoiceTrigger(next: VoiceTriggerId): void {
  voiceTrigger = normalizeVoiceTrigger(next)
  resetLane(voiceLane)
  resetLane(replyLane)
  chordModDown = false
  shiftDown = false
}

export function getModifierTapVoiceTrigger(): VoiceTriggerId {
  return voiceTrigger
}

export function stopModifierTapListener(): void {
  if (!hookRunning && !listenersAttached) return
  resetLane(voiceLane)
  resetLane(replyLane)
  chordModDown = false
  shiftDown = false
  if (hookRunning) {
    try {
      uIOhook.stop()
    } catch {
      // ignore
    }
    hookRunning = false
  }
  handlers = {}
}

export function isModifierTapHookRunning(): boolean {
  return hookRunning
}

/** Mac 上 Command 系快捷键是否改由右 Command 监听（不再走 globalShortcut） */
export function usesRightCommandHotkeys(): boolean {
  return process.platform === 'darwin' && hookRunning
}

/** @deprecated 使用 startModifierTapListener */
export const startLeftCommandTapListener = startModifierTapListener
/** @deprecated 使用 stopModifierTapListener */
export const stopLeftCommandTapListener = stopModifierTapListener
