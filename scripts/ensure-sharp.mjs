#!/usr/bin/env node
/**
 * 本地语音（@xenova/transformers）依赖 sharp + vendor/libvips。
 * npm 若跳过 scripts 或 electron-builder 漏打包 vendor，安装包一点「本地套件」就会崩。
 * 发版 / postinstall 须保证本脚本 exit 0。
 */
import { createRequire } from 'module'
import { existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sharpRoot = join(root, 'node_modules', 'sharp')
const vendorRoot = join(sharpRoot, 'vendor')

function hasVendor() {
  if (!existsSync(vendorRoot)) return false
  try {
    const versions = readdirSync(vendorRoot)
    for (const v of versions) {
      const platDirs = readdirSync(join(vendorRoot, v))
      for (const p of platDirs) {
        const libDir = join(vendorRoot, v, p, 'lib')
        if (!existsSync(libDir)) continue
        const libs = readdirSync(libDir)
        if (libs.some((f) => /libvips/i.test(f))) return true
      }
    }
  } catch {
    return false
  }
  return false
}

function tryLoad() {
  require('sharp')
}

function reinstall() {
  console.warn('[ensure-sharp] sharp/libvips missing or broken — reinstalling sharp@0.32.6…')
  execSync('npm install sharp@0.32.6 --ignore-scripts=false --foreground-scripts --no-save', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, npm_config_ignore_scripts: 'false' }
  })
}

try {
  if (!hasVendor()) reinstall()
  tryLoad()
  if (!hasVendor()) {
    throw new Error('sharp loaded but vendor/libvips still missing')
  }
  console.log('[ensure-sharp] ok — sharp + libvips vendor present')
} catch (err) {
  try {
    reinstall()
    tryLoad()
    if (!hasVendor()) throw new Error('vendor still missing after reinstall')
    console.log('[ensure-sharp] ok after reinstall')
  } catch (err2) {
    console.error('[ensure-sharp] FAILED:', err2 instanceof Error ? err2.message : err2)
    console.error('Local ASR one-click install will break in packaged app.')
    process.exit(1)
  }
}
