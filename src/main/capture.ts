import { desktopCapturer, NativeImage, screen } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { assertMacScreenCaptureAllowed, hasMacAccessibility, macAccessibilityApisAllowed } from './permissions'
import {
  capThumbnailDimensions,
  preprocessCaptureForVision,
  preprocessFullScreenForVision,
  VisionImagePayload
} from './capture-preprocess'

const execFileAsync = promisify(execFile)

export type { VisionImagePayload }

export interface WindowCapture {
  imagePath: string
  /** 兼容旧字段，等同 visionImage.base64 */
  imageBase64: string
  visionImage: VisionImagePayload
  /** 从窗口标题解析的联系人名（视觉模型不必再识别） */
  contactNameHint: string
  appName: string
  windowTitle: string
}

type ActiveWindowInfo = {
  title?: string
  owner?: { name?: string }
  bounds?: { x: number; y: number; width: number; height: number }
}

async function getActiveWindow(): Promise<ActiveWindowInfo | null> {
  if (process.platform === 'darwin' && (!macAccessibilityApisAllowed() || !hasMacAccessibility())) {
    return null
  }
  try {
    const activeWin = (await import('active-win')).default
    return (await activeWin()) as ActiveWindowInfo | null
  } catch {
    return null
  }
}

async function getFrontAppMeta(): Promise<{ appName: string; windowTitle: string }> {
  const win = await getActiveWindow()
  if (win?.owner?.name || win?.title) {
    return {
      appName: win.owner?.name || '',
      windowTitle: win.title || ''
    }
  }

  if (process.platform !== 'darwin' || !macAccessibilityApisAllowed() || !hasMacAccessibility()) {
    return { appName: '', windowTitle: '' }
  }

  return {
    appName: await getFrontAppNameMac(),
    windowTitle: await getFrontWindowTitleMac()
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
    t === 'wechatapp' ||
    t === 'qq' ||
    t === '腾讯qq' ||
    t === 'wechat for windows' ||
    t === '即刻对话' ||
    t === '即刻对话（开发）' ||
    t === 'typenow' ||
    t === 'typenow (dev)' ||
    t === 'talknow' ||
    t === 'talknow (dev)' ||
    t === '口喷输入' ||
    t === 'electron'
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
    void appName
    return ''
  }
  return title
}

function finalizeCapture(
  image: NativeImage,
  appName: string,
  windowTitle: string
): WindowCapture {
  const channel = guessChannel(appName, windowTitle)
  const visionImage = preprocessCaptureForVision(image, channel)
  const contactNameHint = parseContactNameFromWindowTitle(windowTitle, appName)
  return {
    imagePath: '',
    imageBase64: visionImage.base64,
    visionImage,
    contactNameHint,
    appName,
    windowTitle
  }
}

function pickWindowSource(
  sources: Electron.DesktopCapturerSource[],
  active: ActiveWindowInfo | null,
  fallbackTitle?: string
): Electron.DesktopCapturerSource | undefined {
  const title = (active?.title || fallbackTitle || '').trim()
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

async function captureViaDesktopCapturer(): Promise<WindowCapture> {
  if (process.platform === 'darwin') {
    assertMacScreenCaptureAllowed()
  }

  const active = await getActiveWindow()
  const meta = await getFrontAppMeta()
  const appName = active?.owner?.name || meta.appName
  const windowTitle = active?.title || meta.windowTitle

  const display = screen.getPrimaryDisplay()
  const scale = display.scaleFactor || 1
  const bounds = active?.bounds
  const rawW = Math.round((bounds?.width || display.size.width) * scale)
  const rawH = Math.round((bounds?.height || display.size.height) * scale)
  const { width: tw, height: th } = capThumbnailDimensions(rawW, rawH)

  const windowSources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: tw, height: th },
    fetchWindowIcons: false
  })

  const picked = pickWindowSource(windowSources, active, windowTitle)
  if (picked?.thumbnail && !picked.thumbnail.isEmpty()) {
    return finalizeCapture(picked.thumbnail, appName, windowTitle)
  }

  const screenRawW = Math.round(display.size.width * scale)
  const screenRawH = Math.round(display.size.height * scale)
  const screenCap = capThumbnailDimensions(screenRawW, screenRawH)
  const screenSources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: screenCap.width, height: screenCap.height }
  })
  const screenSource =
    screenSources.find((s) => s.display_id === String(display.id)) || screenSources[0]
  if (!screenSource?.thumbnail || screenSource.thumbnail.isEmpty()) {
    throw new Error(
      process.platform === 'darwin'
        ? '截屏失败：请确认已在 系统设置 → 屏幕录制 中勾选「即刻对话」，并完全退出后重开。'
        : '截屏失败，请检查系统是否允许屏幕捕获'
    )
  }

  let image = screenSource.thumbnail
  if (bounds) {
    image = cropThumbnailToBounds(image, bounds, display)
  }

  return finalizeCapture(image, appName, windowTitle)
}

/** Capture the frontmost window (Mac / Windows) */
export async function captureFrontWindow(): Promise<WindowCapture> {
  return captureViaDesktopCapturer()
}

/** 截取主屏幕整屏（看屏幕问答） */
export async function captureFullScreen(): Promise<{
  visionImage: VisionImagePayload
  imageBase64: string
}> {
  if (process.platform === 'darwin') {
    assertMacScreenCaptureAllowed()
  }

  const display = screen.getPrimaryDisplay()
  const scale = display.scaleFactor || 1
  const screenRawW = Math.round(display.size.width * scale)
  const screenRawH = Math.round(display.size.height * scale)
  const screenCap = capThumbnailDimensions(screenRawW, screenRawH)
  const screenSources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: screenCap.width, height: screenCap.height }
  })
  const screenSource =
    screenSources.find((s) => s.display_id === String(display.id)) || screenSources[0]
  if (!screenSource?.thumbnail || screenSource.thumbnail.isEmpty()) {
    throw new Error(
      process.platform === 'darwin'
        ? '截屏失败：请确认已在 系统设置 → 屏幕录制 中勾选应用，并完全退出后重开。'
        : '截屏失败，请检查系统是否允许屏幕捕获'
    )
  }

  const visionImage = preprocessFullScreenForVision(screenSource.thumbnail)
  return { visionImage, imageBase64: visionImage.base64 }
}

export function guessChannel(appName: string, windowTitle: string): 'wechat' | 'qq' | 'unknown' {
  const hay = `${appName} ${windowTitle}`.toLowerCase()
  if (hay.includes('wechat') || hay.includes('微信') || hay.includes('weixin')) return 'wechat'
  if (hay.includes('qq') || hay.includes('腾讯qq')) return 'qq'
  return 'unknown'
}
