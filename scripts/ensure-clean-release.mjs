#!/usr/bin/env node
/**
 * 打包前检查：安装包必须是干净初始版，不含用户配置 / 客户 / 聊天。
 * 失败则 process.exit(1)，阻断 dist/pack。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const root = process.cwd()
const skipDirs = new Set([
  'node_modules',
  '.git',
  'out',
  'release',
  'dist',
  '.cursor'
])

const hits = []

function note(path, reason) {
  hits.push({ path: relative(root, path) || path, reason })
}

function walk(dir, depth = 0) {
  if (depth > 6) return
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (skipDirs.has(name) || name === '.DS_Store') continue
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      // 本地会员服务库，不进 Electron 安装包
      if (name === 'data' && (relative(root, dir) === 'server' || dir.endsWith(`${join('server')}`))) {
        continue
      }
      if (name === 'config' && depth <= 2) {
        const settings = join(full, 'settings.json')
        if (existsSync(settings)) note(settings, '疑似用户配置文件，不可打进安装包')
      }
      walk(full, depth + 1)
      continue
    }
    if (name === 'vip-chat.sqlite' || name.endsWith('.sqlite') || name.endsWith('.sqlite-wal')) {
      note(full, '数据库文件不可打进安装包')
    }
    if (name === 'settings.json' && full.includes(`${join('config', 'settings.json')}`)) {
      note(full, '用户 settings.json 不可打进安装包')
    }
  }
}

walk(root)

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const build = pkg.build || {}
const files = build.files || []
const extra = [
  ...(build.extraResources || []),
  ...(build.extraFiles || [])
]

function badBundlePath(p) {
  const s = typeof p === 'string' ? p : p?.from || p?.to || ''
  if (!s) return null
  if (s.includes('Application Support')) return '指向本机 Application Support'
  if (s.includes('userData')) return '包含 userData'
  if (s.includes('vip-chat.sqlite')) return '包含业务数据库'
  if (s.includes('settings.json')) return '包含 settings.json'
  if (s.startsWith('/Users/') || s.startsWith('/home/')) return '绝对用户路径'
  return null
}

for (const f of files) {
  const reason = badBundlePath(f)
  if (reason) note(String(f), `build.files: ${reason}`)
}
for (const f of extra) {
  const reason = badBundlePath(f)
  if (reason) note(String(typeof f === 'string' ? f : JSON.stringify(f)), `extraResources/Files: ${reason}`)
}

if (!files.includes('out/**/*') || files.some((f) => String(f).includes('src/'))) {
  // soft: only warn if clearly packing src data dirs — already covered by walk
}

if (hits.length) {
  console.error('\n[ensure-clean-release] 发现会污染安装包的用户数据，已中止打包：\n')
  for (const h of hits) {
    console.error(`  - ${h.path}\n    ${h.reason}`)
  }
  console.error('\n请移出仓库或加入忽略后重试。安装包只能是干净初始版。\n')
  process.exit(1)
}

console.log('[ensure-clean-release] OK — Clean release: no user settings / contacts / messages bundled')
console.log('[ensure-clean-release] 用户数据仅在安装后本机 userData 生成')
