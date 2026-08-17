import { BRAND } from './brand'
import { t } from './i18n'

/** Mac：快速双击右 Command（不走 Electron globalShortcut） */
export const DOUBLE_COMMAND_HOTKEY = 'DoubleCommand'

/** Windows：快速双击 Alt */
export const DOUBLE_ALT_HOTKEY = 'DoubleAlt'

/** 即刻对话点按触发键（Mac）；Windows 固定 Alt */
export type VoiceTriggerId = 'rightCommand' | 'rightOption' | 'fn'

export const DEFAULT_VOICE_TRIGGER: VoiceTriggerId = 'rightCommand'

export const VOICE_TRIGGER_IDS: VoiceTriggerId[] = [
  'rightCommand',
  'rightOption',
  'fn'
]

export function isVoiceTriggerId(value: unknown): value is VoiceTriggerId {
  return value === 'rightCommand' || value === 'rightOption' || value === 'fn'
}

export function normalizeVoiceTrigger(value: unknown): VoiceTriggerId {
  return isVoiceTriggerId(value) ? value : DEFAULT_VOICE_TRIGGER
}

/**
 * 蓝牙硬件专用快捷键
 * Mac: 右 Command+8（语音）/ 右 Command+0（帮我对话）；配置串仍写 Command+…
 * Win: Win+8 / Win+0
 */
export function hardwareVoiceAccelerator(
  platform: NodeJS.Platform = process.platform
): string {
  return platform === 'win32' ? 'Super+8' : 'Command+8'
}

export function hardwareReplyAccelerator(
  platform: NodeJS.Platform = process.platform
): string {
  return platform === 'win32' ? 'Super+0' : 'Command+0'
}

/** 旧版「连点两次 0 键」看屏幕（已废弃，迁移到 Command+1） */
export const DOUBLE_HARDWARE_REPLY_HOTKEY = 'DoubleHardwareReply'

export function isDoubleHardwareReplyHotkey(hotkey: string): boolean {
  const h = hotkey.trim()
  return (
    h === DOUBLE_HARDWARE_REPLY_HOTKEY ||
    h === 'DoubleCommand+0' ||
    h === 'DoubleSuper+0' ||
    /双击.*(Command|Win|Super)\+?0/i.test(h) ||
    /连续.*两次.*(Command|Win|Super)?\+?0/i.test(h)
  )
}

/**
 * 看屏幕默认：Mac 右 Command+Shift+1 / Win Super+Shift+1
 * （不用 Command+1：浏览器切「第 1 个标签」会误触发）
 */
export function defaultScreenAskHotkey(
  platform: NodeJS.Platform = process.platform
): string {
  return platform === 'win32' ? 'Super+Shift+1' : 'Command+Shift+1'
}

/**
 * 看屏幕答题默认：Mac 右 Command+Shift+2 / Win Super+Shift+2
 * （不用 Command+2：同理会误触浏览器第 2 个标签）
 */
export function defaultScreenQuizHotkey(
  platform: NodeJS.Platform = process.platform
): string {
  return platform === 'win32' ? 'Super+Shift+2' : 'Command+Shift+2'
}

export function isDoubleCommandHotkey(hotkey: string): boolean {
  const h = hotkey.trim()
  return (
    h === DOUBLE_COMMAND_HOTKEY ||
    h === 'DoubleCommand' ||
    h === 'Command×2' ||
    h === 'Commandx2' ||
    /双击.*Command/i.test(h)
  )
}

export function isDoubleAltHotkey(hotkey: string): boolean {
  const h = hotkey.trim()
  return (
    h === DOUBLE_ALT_HOTKEY ||
    h === 'DoubleAlt' ||
    h === 'Alt×2' ||
    h === 'Altx2' ||
    /双击.*Alt/i.test(h)
  )
}

/** 是否由修饰键点按监听处理（非 globalShortcut） */
export function isModifierDoubleHotkey(hotkey: string): boolean {
  return isDoubleCommandHotkey(hotkey) || isDoubleAltHotkey(hotkey)
}

/** 当前平台推荐的「帮我对话」默认热键 */
export function defaultReplyHotkey(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? DOUBLE_ALT_HOTKEY : DOUBLE_COMMAND_HOTKEY
}

/** 仅快捷键相关默认值（不含人设/语言/模型等） */
export function defaultHotkeySettings(platform: NodeJS.Platform = process.platform): {
  hotkey: string
  screenAskHotkey: string
  screenQuizHotkey: string
  voiceTrigger: VoiceTriggerId
} {
  return {
    hotkey: defaultReplyHotkey(platform),
    screenAskHotkey: defaultScreenAskHotkey(platform),
    screenQuizHotkey: defaultScreenQuizHotkey(platform),
    voiceTrigger: DEFAULT_VOICE_TRIGGER
  }
}

/** 把展示文案拆成芯片；无加号则整段一枚 */
export function hotkeyLabelChips(label: string): string[] {
  const t = label.trim()
  if (!t) return []
  if (!t.includes('+')) return [t]
  return t
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
}

/** Mac：把 Command 展示成「右 Command」，强调只认右侧键 */
export function formatMacCommandLabel(accel: string): string {
  return accel
    .replace(/^Command\+/i, '右 Command+')
    .replace(/\bCommand\+/gi, '右 Command+')
}

/** 界面展示用 */
export function formatHotkeyLabel(
  hotkey: string,
  platform: NodeJS.Platform = process.platform
): string {
  if (isDoubleCommandHotkey(hotkey)) {
    return platform === 'darwin' ? t('hotkey.doubleCommand') : t('hotkey.doubleAlt')
  }
  if (isDoubleAltHotkey(hotkey)) {
    return t('hotkey.doubleAlt')
  }
  if (isDoubleHardwareReplyHotkey(hotkey)) {
    return platform === 'win32' ? 'Win+Shift+1' : t('hotkey.screenAskMac')
  }
  if (platform === 'darwin' && /Command/i.test(hotkey)) {
    return formatMacCommandLabel(hotkey)
  }
  return hotkey
}

/** 触发键短名（设置下拉 / 芯片） */
export function formatVoiceTriggerShortLabel(
  trigger: VoiceTriggerId = DEFAULT_VOICE_TRIGGER,
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === 'win32') return t('hotkey.voiceTrigger.alt')
  switch (normalizeVoiceTrigger(trigger)) {
    case 'rightOption':
      return t('hotkey.voiceTrigger.rightOption')
    case 'fn':
      return t('hotkey.voiceTrigger.fn')
    default:
      return t('hotkey.voiceTrigger.rightCommand')
  }
}

/** 语音触发说明（开始/结束） */
export function formatVoiceTriggerLabel(
  platform: NodeJS.Platform = process.platform,
  trigger: VoiceTriggerId = DEFAULT_VOICE_TRIGGER
): string {
  if (platform === 'win32') return t('hotkey.voiceWin')
  const key = formatVoiceTriggerShortLabel(trigger, platform)
  return t('hotkey.voiceMacNamed', { key })
}

/** 录音中 HUD 提示 */
export function formatRecordingHudText(
  platform: NodeJS.Platform = process.platform,
  trigger: VoiceTriggerId = DEFAULT_VOICE_TRIGGER
): string {
  const name = BRAND.voice.name
  if (platform === 'win32') {
    return t('hotkey.recordingWin', { name })
  }
  const key = formatVoiceTriggerShortLabel(trigger, platform)
  return t('hotkey.recordingMacNamed', { name, key })
}

/** 按住增强录音中 HUD */
export function formatHoldRecordingHudText(
  platform: NodeJS.Platform = process.platform,
  trigger: VoiceTriggerId = DEFAULT_VOICE_TRIGGER
): string {
  if (platform === 'win32') {
    return t('hotkey.holdRecordingWin')
  }
  const key = formatVoiceTriggerShortLabel(trigger, platform)
  return t('hotkey.holdRecordingMacNamed', { key })
}

export type AppPlatform = 'darwin' | 'win32' | 'linux' | string
