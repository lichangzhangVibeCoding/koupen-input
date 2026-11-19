import { app, shell, systemPreferences } from 'electron'

export type MacPermissionSnapshot = {
  screen: string
  microphone: string
  accessibility: boolean
}

/**
 * 是否允许启动 uIOhook（右 Command 快捷键依赖它）。
 * - 开发版：允许（需系统已勾选辅助功能才会真正 start）
 * - 安装包：仅在已勾选辅助功能时允许，避免未勾选时反复弹窗
 * Electron globalShortcut 分不出左右 Command，右 Command 只能走事件监听。
 */
export function macAccessibilityApisAllowed(): boolean {
  if (process.platform !== 'darwin') return true
  if (!app.isPackaged) return true
  return systemPreferences.isTrustedAccessibilityClient(false)
}

/** 只读检查，不会弹出系统授权框 */
export function hasMacAccessibility(): boolean {
  if (process.platform !== 'darwin') return true
  return systemPreferences.isTrustedAccessibilityClient(false)
}

/** 实际截到过图则视为已授权（macOS 26 上 getMediaAccessStatus('screen') 常误报 denied）。 */
let screenCaptureVerified = false

export function markMacScreenCaptureVerified(): void {
  screenCaptureVerified = true
}

export function getMacPermissionSnapshot(): MacPermissionSnapshot {
  const api = systemPreferences.getMediaAccessStatus('screen')
  return {
    screen: screenCaptureVerified ? 'granted' : api,
    microphone: systemPreferences.getMediaAccessStatus('microphone'),
    accessibility: hasMacAccessibility()
  }
}

/** 已不再拦截；保留给看屏幕等旧调用。 */
export function assertMacScreenCaptureAllowed(): void {
  return
}

export async function openMacPrivacyPane(
  pane: 'screen' | 'accessibility' | 'microphone'
): Promise<void> {
  if (process.platform !== 'darwin') return
  const urls: Record<typeof pane, string> = {
    screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    accessibility:
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
  }
  await shell.openExternal(urls[pane])
}

/** 触发系统麦克风授权弹窗（不会反复弹辅助功能） */
export async function requestMacMicrophoneAccess(): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  try {
    return await systemPreferences.askForMediaAccess('microphone')
  } catch {
    return false
  }
}

/**
 * 录音前确保已向系统申请过麦克风。
 * macOS 只有申请过才会出现在「麦克风」列表里；仅打开设置页不会登记。
 */
export async function ensureMacMicrophoneAccess(): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  const status = systemPreferences.getMediaAccessStatus('microphone')
  if (status === 'granted') return true
  if (status === 'denied' || status === 'restricted') return false
  return requestMacMicrophoneAccess()
}

/** 核心能力就绪：Mac 不强制辅助功能（避免未签名包弹窗环） */
export function macPermissionsReady(snap = getMacPermissionSnapshot()): boolean {
  return snap.screen === 'granted' && snap.microphone === 'granted'
}
