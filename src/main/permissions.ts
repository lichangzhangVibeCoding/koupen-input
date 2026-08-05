import { app, shell, systemPreferences } from 'electron'
import { t } from '../shared/i18n'

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

export function getMacPermissionSnapshot(): MacPermissionSnapshot {
  return {
    screen: systemPreferences.getMediaAccessStatus('screen'),
    microphone: systemPreferences.getMediaAccessStatus('microphone'),
    // 展示用：系统是否勾选；不等于我们会去调 AX API
    accessibility: hasMacAccessibility()
  }
}

export function assertMacScreenCaptureAllowed(): void {
  if (process.platform !== 'darwin') return
  const status = systemPreferences.getMediaAccessStatus('screen')
  if (status === 'denied' || status === 'restricted') {
    throw new Error(t('error.screenCapture', { name: t('brand.name') }))
  }
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
