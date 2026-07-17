/** Mac：快速双击左 Command（不走 Electron globalShortcut） */
export const DOUBLE_COMMAND_HOTKEY = 'DoubleCommand'

/** Windows：快速双击 Alt */
export const DOUBLE_ALT_HOTKEY = 'DoubleAlt'

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

/** 当前平台推荐的「帮你口喷」默认热键 */
export function defaultReplyHotkey(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? DOUBLE_ALT_HOTKEY : DOUBLE_COMMAND_HOTKEY
}

/** 界面展示用 */
export function formatHotkeyLabel(
  hotkey: string,
  platform: NodeJS.Platform = process.platform
): string {
  if (isDoubleCommandHotkey(hotkey)) {
    return platform === 'win32' ? '快速双击 Alt' : '快速双击左 Command'
  }
  if (isDoubleAltHotkey(hotkey)) {
    return '快速双击 Alt'
  }
  return hotkey
}

/** 我来口喷触发说明 */
export function formatVoiceTriggerLabel(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32'
    ? '单击 Alt 开始，再单击一次结束'
    : '单击空格键左侧 Command 开始，再单击一次结束'
}

/** 录音中 HUD 提示 */
export function formatRecordingHudText(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32'
    ? '我来口喷：正在听…再按 Alt 结束'
    : '我来口喷：正在听…再按左 Command 结束'
}

export type AppPlatform = 'darwin' | 'win32' | 'linux' | string
