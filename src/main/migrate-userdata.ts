import { app } from 'electron'
import { cpSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { dirname, join } from 'path'

const LEGACY_SUPPORT_NAMES = [
  'streamer-vip-chat',
  '口喷输入',
  '即刻对话',
  'koupen-input'
]

function dirHasUserFiles(dir: string): boolean {
  if (!existsSync(dir)) return false
  try {
    const entries = readdirSync(dir)
    return entries.some((n) => n === 'config' || n === 'data' || n.endsWith('.sqlite'))
  } catch {
    return false
  }
}

function copyTreeIfMissing(from: string, to: string): void {
  if (!existsSync(from)) return
  mkdirSync(dirname(to), { recursive: true })
  if (!existsSync(to)) {
    cpSync(from, to, { recursive: true })
    return
  }
  // 目标已存在则只补缺文件/目录
  for (const name of readdirSync(from)) {
    const src = join(from, name)
    const dst = join(to, name)
    if (!existsSync(dst)) {
      cpSync(src, dst, { recursive: true })
    }
  }
}

/**
 * appId / 包名改为 typenow 后，userData 路径会变。
 * 现用：Mac ~/Library/Application Support/typenow ；Windows %APPDATA%\typenow
 * 新目录为空时，从旧 Application Support 目录迁移 config / data。
 */
export function migrateUserDataFromLegacy(): void {
  const next = app.getPath('userData')
  if (dirHasUserFiles(next)) return

  const supportRoot = dirname(next)
  for (const legacyName of LEGACY_SUPPORT_NAMES) {
    const legacy = join(supportRoot, legacyName)
    if (legacy === next) continue
    if (!dirHasUserFiles(legacy)) continue
    try {
      copyTreeIfMissing(join(legacy, 'config'), join(next, 'config'))
      copyTreeIfMissing(join(legacy, 'data'), join(next, 'data'))
      console.log('[migrate-userdata] migrated from', legacy)
      return
    } catch (err) {
      console.warn('[migrate-userdata] failed', legacy, err)
    }
  }
}
