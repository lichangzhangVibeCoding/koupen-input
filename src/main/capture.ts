import { desktopCapturer, screen } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)

export interface WindowCapture {
  imagePath: string
  imageBase64: string
  appName: string
  windowTitle: string
}

type ActiveWindowInfo = {
  title?: string
  owner?: { name?: string }
  bounds?: { x: number; y: number; width: number; height: number }
}

async function getActiveWindow(): Promise<ActiveWindowInfo | null> {
  try {
    const activeWin = (await import('active-win')).default
    return (await activeWin()) as ActiveWindowInfo | null
  } catch {
    return null
  }
}

async function getFrontAppMeta(): Promise<{ appName: string; windowTitle: string }> {
  if (process.platform === 'darwin') {
    return {
      appName: await getFrontAppNameMac(),
      windowTitle: await getFrontWindowTitleMac()
    }
  }
  const win = await getActiveWindow()
  return {
    appName: win?.owner?.name || '',
    windowTitle: win?.title || ''
  }
}

async function getFrontAppNameMac(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      'tell application "System Events" to get name of first application process whose frontmost is true'
    ])
    return stdout.trim()
  } catch {
    return ''
  }
}

async function getFrontWindowTitleMac(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      'tell application "System Events" to get name of first window of (first application process whose frontmost is true)'
    ])
    return stdout.trim()
  } catch {
    return ''
  }
}

async function captureMac(): Promise<WindowCapture> {
  const { appName, windowTitle } = await getFrontAppMeta()
  const imagePath = join(tmpdir(), `vip-chat-${randomUUID()}.png`)

  let windowId: number | null = null
  try {
    const win = await getActiveWindow()
    if (win && 'id' in win && typeof (win as { id?: number }).id === 'number') {
      windowId = (win as { id: number }).id
    }
  } catch {
    // optional
  }

  if (windowId) {
    try {
      await execFileAsync('screencapture', ['-x', '-l', String(windowId), imagePath])
    } catch {
      await execFileAsync('screencapture', ['-x', '-m', imagePath])
    }
  } else {
    await execFileAsync('screencapture', ['-x', '-m', imagePath])
  }

  if (!existsSync(imagePath)) {
    throw new Error('截屏失败，请在系统设置中授予屏幕录制权限')
  }

  const buf = readFileSync(imagePath)
  const imageBase64 = buf.toString('base64')
  try {
    unlinkSync(imagePath)
  } catch {
    // ignore
  }

  return { imagePath, imageBase64, appName, windowTitle }
}

function normalizeTitle(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

function isGenericChatTitle(title: string): boolean {
  const t = normalizeTitle(title)
  return (
    !t ||
    t === '微信' ||
    t === 'wechat' ||
    t === 'weixin' ||
    t === 'qq' ||
    t === '腾讯qq' ||
    t === 'wechat for windows'
  )
}

/** 从 Windows / Mac 窗口标题推断联系人名（微信/QQ 标题常为「张三」或「张三 - 微信」） */
export function parseContactNameFromWindowTitle(
  windowTitle: string,
  appName = ''
): string {
  let title = windowTitle.trim()
  if (!title) return ''

  title = title.replace(/^\(\d+\)\s*/, '').trim()
  title = title.replace(/\s*[-|–—|｜]\s*微信.*$/i, '').trim()
  title = title.replace(/\s*[-|–—|｜]\s*WeChat.*$/i, '').trim()
  title = title.replace(/\s*[-|–—|｜]\s*Weixin.*$/i, '').trim()
  title = title.replace(/\s*[-|–—|｜]\s*QQ.*$/i, '').trim()
  title = title.replace(/\s*[-|–—|｜]\s*腾讯QQ.*$/i, '').trim()

  if (isGenericChatTitle(title)) {
    // 有时标题只有应用名，尝试从进程名判断后仍无法得到联系人
    void appName
    return ''
  }
  return title
}

function pickWindowSource(
  sources: Electron.DesktopCapturerSource[],
  active: ActiveWindowInfo | null
): Electron.DesktopCapturerSource | undefined {
  const title = active?.title?.trim()
  if (!title) return undefined

  const nTitle = normalizeTitle(title)
  let hit = sources.find((s) => s.name.trim() === title)
  if (hit) return hit

  hit = sources.find((s) => normalizeTitle(s.name) === nTitle)
  if (hit) return hit

  hit = sources.find((s) => {
    const n = normalizeTitle(s.name)
    if (isGenericChatTitle(s.name)) return false
    return n.startsWith(nTitle) || nTitle.startsWith(n) || n.includes(nTitle) || nTitle.includes(n)
  })
  if (hit) return hit

  const app = (active?.owner?.name || '').toLowerCase()
  if (app.includes('wechat') || app.includes('weixin') || app.includes('qq')) {
    const chatSources = sources.filter((s) => !isGenericChatTitle(s.name))
    if (chatSources.length === 1) return chatSources[0]
  }

  return undefined
}

function cropThumbnailToBounds(
  thumbnail: Electron.NativeImage,
  bounds: ActiveWindowInfo['bounds'],
  display: Electron.Display
): Electron.NativeImage {
  if (!bounds?.width || !bounds?.height || thumbnail.isEmpty()) return thumbnail

  const scale = display.scaleFactor || 1
  const size = thumbnail.getSize()
  const dispW = Math.max(1, Math.round(display.size.width * scale))
  const dispH = Math.max(1, Math.round(display.size.height * scale))
  const rx = size.width / dispW
  const ry = size.height / dispH

  const x = Math.max(0, Math.round((bounds.x - display.bounds.x) * scale * rx))
  const y = Math.max(0, Math.round((bounds.y - display.bounds.y) * scale * ry))
  const w = Math.min(size.width - x, Math.round(bounds.width * scale * rx))
  const h = Math.min(size.height - y, Math.round(bounds.height * scale * ry))
  if (w < 40 || h < 40) return thumbnail

  return thumbnail.crop({ x, y, width: w, height: h })
}

async function captureWindows(): Promise<WindowCapture> {
  const active = await getActiveWindow()
  const appName = active?.owner?.name || ''
  const windowTitle = active?.title || ''
  const display = screen.getPrimaryDisplay()
  const scale = display.scaleFactor || 1
  const bounds = active?.bounds
  const tw = Math.max(
    640,
    Math.min(2560, Math.round((bounds?.width || display.size.width) * scale))
  )
  const th = Math.max(
    480,
    Math.min(1600, Math.round((bounds?.height || display.size.height) * scale))
  )

  const windowSources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: tw, height: th },
    fetchWindowIcons: false
  })

  const picked = pickWindowSource(windowSources, active)
  if (picked?.thumbnail && !picked.thumbnail.isEmpty()) {
    return {
      imagePath: '',
      imageBase64: picked.thumbnail.toPNG().toString('base64'),
      appName,
      windowTitle
    }
  }

  // 兜底：整屏截取后按前台窗口区域裁剪（比纯整屏更容易识别）
  const screenW = Math.round(display.size.width * scale)
  const screenH = Math.round(display.size.height * scale)
  const screenSources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: screenW, height: screenH }
  })
  const screenSource =
    screenSources.find((s) => s.display_id === String(display.id)) || screenSources[0]
  if (!screenSource?.thumbnail || screenSource.thumbnail.isEmpty()) {
    throw new Error('截屏失败，请检查系统是否允许屏幕捕获')
  }

  let image = screenSource.thumbnail
  if (bounds) {
    image = cropThumbnailToBounds(image, bounds, display)
  }

  return {
    imagePath: '',
    imageBase64: image.toPNG().toString('base64'),
    appName,
    windowTitle
  }
}

/** Capture the frontmost window (Mac) or active chat window (Windows) */
export async function captureFrontWindow(): Promise<WindowCapture> {
  if (process.platform === 'win32') {
    return captureWindows()
  }
  return captureMac()
}

export function guessChannel(appName: string, windowTitle: string): 'wechat' | 'qq' | 'unknown' {
  const hay = `${appName} ${windowTitle}`.toLowerCase()
  if (hay.includes('wechat') || hay.includes('微信') || hay.includes('weixin')) return 'wechat'
  if (hay.includes('qq') || hay.includes('腾讯qq')) return 'qq'
  return 'unknown'
}
