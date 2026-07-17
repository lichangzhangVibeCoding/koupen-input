import { app, dialog } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  defaultReplyHotkey,
  isDoubleAltHotkey,
  isDoubleCommandHotkey
} from '../shared/hotkey'
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
    hotkey: defaultReplyHotkey()
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
      : ''
  }
}

export function normalizeSettings(raw: Partial<AppSettings> | AppSettings): AppSettings {
  const base = platformDefaultSettings()
  const merged = { ...base, ...raw } as AppSettings
  if (LEGACY_HOTKEYS.includes(merged.hotkey)) {
    merged.hotkey = base.hotkey
  }
  // 跨平台配置文件：把另一侧默认双击热键纠正到本机
  if (process.platform === 'win32' && isDoubleCommandHotkey(merged.hotkey)) {
    merged.hotkey = defaultReplyHotkey('win32')
  } else if (process.platform === 'darwin' && isDoubleAltHotkey(merged.hotkey)) {
    merged.hotkey = defaultReplyHotkey('darwin')
  }
  return merged
}

export function getSettings(): AppSettings {
  const path = configPath()
  if (!existsSync(path)) return platformDefaultSettings()
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<AppSettings>
    return normalizeSettings(parsed)
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
    title: '导出配置',
    defaultPath: `口喷输入-配置-${stamp}.json`,
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
