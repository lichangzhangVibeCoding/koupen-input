/**
 * 设置页「按下录制」：把 KeyboardEvent 转成 Electron accelerator / 语音触发键。
 * Mac 组合键统一写成 Command（运行时只认右 Command，与现网一致）。
 */

import {
  DEFAULT_VOICE_TRIGGER,
  type VoiceTriggerId
} from '../../../shared/hotkey'

const MODIFIER_CODES = new Set([
  'MetaLeft',
  'MetaRight',
  'AltLeft',
  'AltRight',
  'ControlLeft',
  'ControlRight',
  'ShiftLeft',
  'ShiftRight',
  'CapsLock',
  'Fn',
  'FnLock'
])

/** Electron accelerator 主键 */
function codeToAccelKey(code: string, key: string): string | null {
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Key')) return code.slice(3).toUpperCase()
  if (code.startsWith('Numpad') && code.length === 7) return `num${code.slice(6)}`

  const byCode: Record<string, string> = {
    Space: 'Space',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backquote: '`'
  }
  if (byCode[code]) return byCode[code]

  for (let i = 1; i <= 24; i++) {
    if (code === `F${i}`) return `F${i}`
  }

  // 兜底：单字符
  if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) return key.toUpperCase()
  return null
}

export function isModifierOnlyEvent(e: KeyboardEvent): boolean {
  return MODIFIER_CODES.has(e.code) || e.key === 'Process'
}

/**
 * 组合快捷键 → Electron accelerator。
 * 纯修饰键返回 null（继续等）；Escape 返回 '__cancel__'。
 */
export function eventToAccelerator(
  e: KeyboardEvent,
  platform: NodeJS.Platform | string
): string | null | '__cancel__' {
  if (e.code === 'Escape' || e.key === 'Escape') return '__cancel__'
  if (isModifierOnlyEvent(e)) return null

  const parts: string[] = []
  const isWin = platform === 'win32'

  // Win 键：meta → Super；Mac：meta → Command
  if (e.metaKey) parts.push(isWin ? 'Super' : 'Command')
  if (e.ctrlKey) parts.push('Control')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  const key = codeToAccelKey(e.code, e.key)
  if (!key) return null

  // 避免 Meta+Meta 这类
  if (parts.includes(key)) return null
  parts.push(key)

  if (parts.length < 1) return null
  // 至少要有一个非空结果；单独字母通常太容易误触，但允许（用户明确在录制）
  return parts.join('+')
}

/**
 * 即刻对话触发键：抬起/按下单独的右侧修饰或 Fn。
 * 左 Command / 左 Option → '__wrong_side__'
 */
export function eventToVoiceTrigger(
  e: KeyboardEvent
): VoiceTriggerId | null | '__cancel__' | '__wrong_side__' {
  if (e.code === 'Escape' || e.key === 'Escape') return '__cancel__'

  // 带其它修饰的组合不算语音触发
  const extras =
    (e.ctrlKey ? 1 : 0) +
    (e.shiftKey ? 1 : 0) +
    // meta/alt 本身可能是目标键，下面按 code 判断
    0

  if (e.code === 'MetaRight') {
    if (e.ctrlKey || e.shiftKey || e.altKey) return null
    return 'rightCommand'
  }
  if (e.code === 'MetaLeft') {
    if (e.ctrlKey || e.shiftKey || e.altKey) return null
    return '__wrong_side__'
  }
  if (e.code === 'AltRight') {
    if (e.ctrlKey || e.shiftKey || e.metaKey) return null
    return 'rightOption'
  }
  if (e.code === 'AltLeft') {
    if (e.ctrlKey || e.shiftKey || e.metaKey) return null
    return '__wrong_side__'
  }
  // Fn / 地球键：各环境 code 不一
  if (
    e.code === 'Fn' ||
    e.key === 'Fn' ||
    e.code === 'Lang1' ||
    e.code === 'Lang2' ||
    (e as KeyboardEvent & { keyCode?: number }).keyCode === 63
  ) {
    if (e.ctrlKey || e.shiftKey || e.metaKey || e.altKey) return null
    return 'fn'
  }

  void extras
  void DEFAULT_VOICE_TRIGGER
  return null
}
