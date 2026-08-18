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
  /**
   * 语音键按住 ≥ HOLD_MS 且仍空闲时进入增强。
   * 返回 false：不进入按住（点按录音中 / 看屏幕听音等），抬起仍走单击。
   */
  onVoiceHoldStart?: () => boolean
  /** 按住后抬起 → 转写并增强提示词 */
  onVoiceHoldEnd?: () => void
  /** 按住过程中变成组合键 → 丢弃本次增强 */
  onVoiceHoldCancel?: () => void
  /** 右 Command + Shift + 1 → 看屏幕 */
  onScreenAsk?: () => void
  /** 右 Command + 8 → 语音（硬件备用） */
  onHardwareVoice?: () => void
  /** 右 Command + 0 → 帮我对话（硬件备用） */
  onHardwareReply?: () => void
}

const DOUBLE_MS = 380
/** 按住增强：keydown 起算，满此时长且键仍按下才进入 */
const HOLD_MS = 400
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
  holdTimer: ReturnType<typeof setTimeout> | null
  /** 本会已进入按住增强，抬起不再走单击/双击 */
  holding: boolean
}

function emptyLane(): TapLane {
  return {
    down: false,
    chorded: false,
    lastAloneTapAt: 0,
    singleTimer: null,
    holdTimer: null,
    holding: false
  }
}

const voiceLane: TapLane = emptyLane()
const replyLane: TapLane = emptyLane()

let shiftDown = false
/** 右 Command 是否按下（组合键 / 硬件备用，与语音触发解耦） */
let chordModDown = false

function clearLaneTimer(lane: TapLane): void {
  if (lane.singleTimer) {
    clearTimeout(lane.singleTimer)
    lane.singleTimer = null
  }
}

function clearHoldTimer(lane: TapLane): void {
  if (lane.holdTimer) {
    clearTimeout(lane.holdTimer)
    lane.holdTimer = null
  }
}

function resetLane(lane: TapLane): void {
  clearLaneTimer(lane)
  clearHoldTimer(lane)
  lane.down = false
  lane.chorded = false
  lane.lastAloneTapAt = 0
  lane.holding = false
}

function cancelPendingTaps(): void {
  clearLaneTimer(voiceLane)
  voiceLane.lastAloneTapAt = 0
  if (voiceSharesReplyKey()) {
    clearLaneTimer(replyLane)
    replyLane.lastAloneTapAt = 0
  }
}

function startVoiceHoldTimer(): void {
  clearHoldTimer(voiceLane)
  voiceLane.holdTimer = setTimeout(() => {
    voiceLane.holdTimer = null
    if (!voiceLane.down || voiceLane.chorded || voiceLane.holding) return
    const ok = handlers.onVoiceHoldStart?.()
    if (ok === false) return
    voiceLane.holding = true
    cancelPendingTaps()
  }, HOLD_MS)
}

function cancelActiveHold(): void {
  clearHoldTimer(voiceLane)
  if (!voiceLane.holding) return
  voiceLane.holding = false
  handlers.onVoiceHoldCancel?.()
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

/** 语音键第一次按下：暂停待触发单击（保留 lastAloneTapAt 以便短按仍能双击），并开始按住计时 */
function armVoicePress(): void {
  if (voiceLane.down) return
  voiceLane.down = true
  voiceLane.chorded = false
  voiceLane.holding = false
  clearLaneTimer(voiceLane)
  startVoiceHoldTimer()
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
      if (!voiceLane.down) {
        armVoicePress()
        replyLane.down = true
        replyLane.chorded = false
        clearLaneTimer(replyLane)
      }
    } else {
      if (asVoice) armVoicePress()
      if (asReply && !replyLane.down) {
        replyLane.down = true
        replyLane.chorded = false
      }
    }

    // Mac：右 Command 组合键（分得出左右；globalShortcut 做不到）
    if (process.platform === 'darwin' && chordModDown) {
      const fireChord = (fn?: () => void): void => {
        markChorded()
        clearHoldTimer(voiceLane)
        if (voiceLane.holding) {
          cancelActiveHold()
          return
        }
        clearLaneTimer(voiceLane)
        clearLaneTimer(replyLane)
        fn?.()
      }
      if (shiftDown && e.keycode === UiohookKey[1]) {
        fireChord(() => handlers.onScreenAsk?.())
        return
      }
      if (e.keycode === UiohookKey[8]) {
        fireChord(() => handlers.onHardwareVoice?.())
        return
      }
      if (e.keycode === UiohookKey[0]) {
        fireChord(() => handlers.onHardwareReply?.())
        return
      }
    }

    // 其它键按下：若某修饰键正按着，记为组合，不触发单击/双击；已按住则取消增强
    if (!asVoice && !asReply && !asChord && !isShiftKey(e.keycode)) {
      if (voiceLane.down) {
        voiceLane.chorded = true
        clearHoldTimer(voiceLane)
        if (voiceLane.holding) cancelActiveHold()
      }
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
      const wasHolding = voiceLane.holding
      const wasChorded = voiceLane.chorded || replyLane.chorded
      clearHoldTimer(voiceLane)
      voiceLane.down = false
      replyLane.down = false
      voiceLane.chorded = false
      replyLane.chorded = false
      voiceLane.holding = false
      if (wasHolding) {
        if (!wasChorded) handlers.onVoiceHoldEnd?.()
        return
      }
      if (wasChorded) return
      handleAloneKeyUp(voiceLane, 'shared')
      return
    }

    if (asVoice) {
      const wasHolding = voiceLane.holding
      const wasChorded = voiceLane.chorded
      clearHoldTimer(voiceLane)
      voiceLane.down = false
      voiceLane.chorded = false
      voiceLane.holding = false
      if (wasHolding) {
        if (!wasChorded) handlers.onVoiceHoldEnd?.()
      } else if (!wasChorded) {
        handleAloneKeyUp(voiceLane, 'voiceOnly')
      }
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
