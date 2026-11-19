import { app, dialog } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  defaultReplyHotkey,
  defaultScreenAskHotkey,
  defaultScreenQuizHotkey,
  isDoubleAltHotkey,
  isDoubleCommandHotkey,
  isDoubleHardwareReplyHotkey,
  normalizeVoiceTrigger
} from '../shared/hotkey'
import { isPersonaPackId } from '../shared/persona-packs'
import { t } from '../shared/i18n'
import { AppSettings, DEFAULT_SETTINGS } from '../shared/types'

const LEGACY_HOTKEYS = [
  'Alt+Space',
  'Option+Space',
  'Control+Alt+V',
  'Control+Option+V',
  // 旧默认组合键 → 平台修饰键双击
  'Command+8',
  'Command+Shift+8',
  'Alt+8',
  'Control+Alt+8'
]

function platformDefaultSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    hotkey: defaultReplyHotkey(),
    screenAskHotkey: defaultScreenAskHotkey(),
    screenQuizHotkey: defaultScreenQuizHotkey()
  }
}

export function configDir(): string {
  const dir = join(app.getPath('userData'), 'config')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function configPath(): string {
  return join(configDir(), 'settings.json')
}

function isPlaceholderKey(value: string): boolean {
  const v = value.trim()
  return !v || v === 'ollama' || v === 'local'
}

/** Remove real API keys; keep local placeholders. */
export function redactSecrets(settings: AppSettings): AppSettings {
  return {
    ...settings,
    apiKey: isPlaceholderKey(settings.apiKey) ? settings.apiKey || 'ollama' : '',
    sttApiKey: '',
    localSttApiKey: isPlaceholderKey(settings.localSttApiKey)
      ? settings.localSttApiKey || 'local'
      : '',
    membershipAccessToken: ''
  }
}

export function normalizeSettings(raw: Partial<AppSettings> | AppSettings): AppSettings {
  const base = platformDefaultSettings()
  const merged = { ...base, ...raw } as AppSettings
  // 已移除蓝牙遥控：丢掉旧配置里的残留字段
  delete (merged as AppSettings & { remoteButtonEnabled?: unknown }).remoteButtonEnabled
  delete (merged as AppSettings & { remoteLearnedKeycode?: unknown }).remoteLearnedKeycode
  if (LEGACY_HOTKEYS.includes(merged.hotkey)) {
    merged.hotkey = base.hotkey
  }
  // 跨平台配置文件：把另一侧默认双击热键纠正到本机
  if (process.platform === 'win32' && isDoubleCommandHotkey(merged.hotkey)) {
    merged.hotkey = defaultReplyHotkey('win32')
  } else if (process.platform === 'darwin' && isDoubleAltHotkey(merged.hotkey)) {
    merged.hotkey = defaultReplyHotkey('darwin')
  }
  if (typeof merged.deAiToneEnabled !== 'boolean') {
    merged.deAiToneEnabled = true
  }
  if (typeof merged.voiceStripFillersEnabled !== 'boolean') {
    merged.voiceStripFillersEnabled = true
  }
  if (typeof merged.voiceFixSttTyposEnabled !== 'boolean') {
    merged.voiceFixSttTyposEnabled = false
  }
  if (typeof merged.enhanceScreenCaptureEnabled !== 'boolean') {
    merged.enhanceScreenCaptureEnabled = false
  }
  if (merged.voiceAsrMode !== 'cloud' && merged.voiceAsrMode !== 'local-stream') {
    merged.voiceAsrMode = 'cloud'
  }
  if (typeof merged.voiceCloudProofread !== 'boolean') {
    merged.voiceCloudProofread = false
  }
  if (!isPersonaPackId(merged.personaPackId)) {
    merged.personaPackId = 'none'
  }
  if (typeof merged.permissionGuideCompleted !== 'boolean') {
    merged.permissionGuideCompleted = false
  }
  if (typeof merged.skillGuideCompleted !== 'boolean') {
    merged.skillGuideCompleted = false
  }
  if (merged.locale !== 'system' && merged.locale !== 'zh-CN' && merged.locale !== 'en-US') {
    merged.locale = 'system'
  }
  if (typeof merged.screenAskEnabled !== 'boolean') {
    merged.screenAskEnabled = true
  }
  if (typeof merged.screenAskHotkey !== 'string' || !merged.screenAskHotkey.trim()) {
    merged.screenAskHotkey = defaultScreenAskHotkey()
  } else if (
    // 旧默认易与浏览器「第 N 个标签」冲突 → 迁到 Command+Shift+N
    merged.screenAskHotkey === 'Command+Shift+A' ||
    merged.screenAskHotkey === 'Control+Shift+A' ||
    merged.screenAskHotkey === 'Command+1' ||
    merged.screenAskHotkey === 'Super+1' ||
    isDoubleHardwareReplyHotkey(merged.screenAskHotkey)
  ) {
    merged.screenAskHotkey = defaultScreenAskHotkey()
  } else if (process.platform === 'win32' && /^Command\+(Shift\+)?1$/i.test(merged.screenAskHotkey)) {
    merged.screenAskHotkey = defaultScreenAskHotkey('win32')
  } else if (process.platform === 'darwin' && /^(Super|Control)(\+Shift)?\+1$/i.test(merged.screenAskHotkey)) {
    merged.screenAskHotkey = defaultScreenAskHotkey('darwin')
  }
  if (typeof merged.screenQuizEnabled !== 'boolean') {
    merged.screenQuizEnabled = true
  }
  if (typeof merged.screenQuizHotkey !== 'string' || !merged.screenQuizHotkey.trim()) {
    merged.screenQuizHotkey = defaultScreenQuizHotkey()
  } else if (
    merged.screenQuizHotkey === 'Command+2' ||
    merged.screenQuizHotkey === 'Super+2'
  ) {
    merged.screenQuizHotkey = defaultScreenQuizHotkey()
  } else if (process.platform === 'win32' && /^Command\+(Shift\+)?2$/i.test(merged.screenQuizHotkey)) {
    merged.screenQuizHotkey = defaultScreenQuizHotkey('win32')
  } else if (process.platform === 'darwin' && /^(Super|Control)(\+Shift)?\+2$/i.test(merged.screenQuizHotkey)) {
    merged.screenQuizHotkey = defaultScreenQuizHotkey('darwin')
  }
  if (merged.modelRoutingMode !== 'byok' && merged.modelRoutingMode !== 'membership') {
    merged.modelRoutingMode = 'membership'
  }
  if (typeof merged.membershipServerUrl !== 'string' || !merged.membershipServerUrl.trim()) {
    merged.membershipServerUrl = 'https://www.lizhenning.com/other/typenow/talknowAPi/index.php'
  }
  if (typeof merged.membershipAccessToken !== 'string') {
    merged.membershipAccessToken = ''
  }
  merged.voiceTrigger = normalizeVoiceTrigger(merged.voiceTrigger)
  return merged
}

export function getSettings(): AppSettings {
  const path = configPath()
  if (!existsSync(path)) return platformDefaultSettings()
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<AppSettings>
    const next = normalizeSettings(parsed)
    if (typeof parsed.enhanceScreenCaptureEnabled !== 'boolean') {
      writeFileSync(path, JSON.stringify(next, null, 2), 'utf8')
    }
    return next
  } catch {
    return platformDefaultSettings()
  }
}

export function saveSettings(settings: AppSettings): void {
  const next = normalizeSettings(settings)
  writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8')
}

/** Ensure settings.json exists; migrate from legacy SQLite JSON if provided. */
export function ensureSettingsFile(legacySqliteJson?: string): void {
  if (existsSync(configPath())) return
  if (legacySqliteJson) {
    try {
      const parsed = JSON.parse(legacySqliteJson) as Partial<AppSettings>
      saveSettings(normalizeSettings(parsed))
      return
    } catch {
      // fall through
    }
  }
  saveSettings(platformDefaultSettings())
}

export function resetSettingsToDefault(): AppSettings {
  saveSettings(platformDefaultSettings())
  return getSettings()
}

export type ExportSettingsResult =
  | { ok: true; path: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string }

export async function exportSettingsToFile(
  includeSecrets: boolean
): Promise<ExportSettingsResult> {
  const settings = getSettings()
  const stamp = new Date().toISOString().slice(0, 10)
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: t('export.title'),
    defaultPath: `${t('export.filenamePrefix')}-${stamp}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (canceled || !filePath) return { ok: false, canceled: true }

  const payload = {
    format: 'vip-chat-settings',
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    includeSecrets,
    settings: includeSecrets ? settings : redactSecrets(settings)
  }

  try {
    writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
    return { ok: true, path: filePath }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
