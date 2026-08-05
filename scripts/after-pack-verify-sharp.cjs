/**
 * electron-builder afterPack：确认 sharp 的 libvips 已打进 app，
 * 避免再出现「一键安装本地套件 → sharp/libvips 找不到」。
 */
const { existsSync, readdirSync, statSync } = require('fs')
const { join } = require('path')

function walkFind(dir, pred, depth = 0) {
  if (depth > 10 || !existsSync(dir)) return null
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return null
  }
  for (const name of entries) {
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isFile() && pred(full, name)) return full
    if (st.isDirectory() && name !== 'src') {
      const hit = walkFind(full, pred, depth + 1)
      if (hit) return hit
    }
  }
  return null
}

exports.default = async function afterPack(context) {
  const resources = context.appOutDir
  // Mac: Xxx.app/Contents/Resources ; Win/Linux: resources
  const candidates = [
    join(resources, '即刻对话.app', 'Contents', 'Resources'),
    join(resources, 'TypeNow.app', 'Contents', 'Resources'),
    join(resources, 'Resources'),
    join(resources, 'resources'),
    resources
  ]

  let resourcesDir = candidates.find((p) => existsSync(p)) || resources
  // electron-builder mac: appOutDir is already .../mac-arm64/即刻对话.app/Contents ?
  // Actually appOutDir is the folder containing the .app or the win unpacked dir.
  const searchRoots = [
    resourcesDir,
    join(resources, '即刻对话.app', 'Contents', 'Resources'),
    join(context.appOutDir, 'Contents', 'Resources'),
    context.appOutDir
  ]

  let libvips = null
  for (const root of searchRoots) {
    libvips = walkFind(
      root,
      (_full, name) => /^libvips-cpp\.\d+\.dylib$/i.test(name) || /^libvips-cpp-\d+\.dll$/i.test(name)
    )
    if (libvips) break
  }

  if (!libvips) {
    throw new Error(
      '[afterPack] sharp vendor/libvips missing from package — local suite install will crash. ' +
        'Run: npm run ensure-sharp && ensure asarUnpack includes **/sharp/**/*'
    )
  }
  console.log('[afterPack] sharp libvips present:', libvips)
}
