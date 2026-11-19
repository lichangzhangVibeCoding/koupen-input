import { app, desktopCapturer, nativeImage, NativeImage, screen } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { unlinkSync } from 'fs'
import { join } from 'path'
import { hasMacAccessibility, macAccessibilityApisAllowed, markMacScreenCaptureVerified } from './permissions'
import { raceDeadline } from './task-cancel'
import {
  capThumbnailDimensions,
  ENHANCE_MAX_LONG_EDGE,
  preprocessCaptureForVision,
  preprocessEnhanceFullScreen,
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
  id?: number
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

function macScreenCaptureHint(): string {
  if (app.isPackaged) {
    return '截屏失败：请到 系统设置 → 屏幕录制 勾选「即刻对话」，然后 ⌘Q 完全退出再打开。'
  }
  return (
    '截屏失败：开发版请到 系统设置 → 屏幕录制，用「+」添加 node_modules 里的 Electron.app 并打开开关。' +
    '弹出「退出 Electron」时选「以后」，再对开发版按 ⌘Q，回到终端重新 npm run dev。不要点「退出并重新打开」。'
  )
}

async function captureViaScreencaptureWindow(
  windowId?: number,
  bounds?: ActiveWindowInfo['bounds']
): Promise<NativeImage | null> {
  if (process.platform !== 'darwin') return null
  const out = join(tmpdir(), `typenow-win-${Date.now()}.png`)
  const tryCapture = async (args: string[]): Promise<NativeImage | null> => {
    try {
      await execFileAsync('screencapture', args, { timeout: 5000 })
      const img = nativeImage.createFromPath(out)
      if (!img || img.isEmpty()) return null
      const { width, height } = img.getSize()
      if (width < 40 || height < 40) return null
      return img
    } catch {
      return null
    }
  }
  try {
    if (windowId && windowId > 0) {
      const byId = await tryCapture(['-x', '-o', '-l', String(windowId), out])
      if (byId) return byId
    }
    if (bounds && bounds.width > 40 && bounds.height > 40) {
      const rect = [
        Math.round(bounds.x),
        Math.round(bounds.y),
        Math.round(bounds.width),
        Math.round(bounds.height)
      ].join(',')
      const byRect = await tryCapture(['-x', '-R', rect, out])
      if (byRect) return byRect
    }
    return null
  } finally {
    try {
      unlinkSync(out)
    } catch {
      /* ignore */
    }
  }
}

async function captureActiveWindowImage(): Promise<{
  image: NativeImage
  appName: string
  windowTitle: string
}> {
  const active = await getActiveWindow()
  const meta = await getFrontAppMeta()
  const appName = active?.owner?.name || meta.appName
  const windowTitle = active?.title || meta.windowTitle
  const display = screen.getPrimaryDisplay()
  const scale = display.scaleFactor || 1
  const bounds = active?.bounds

  if (process.platform === 'darwin') {
    const winImg = await captureViaScreencaptureWindow(active?.id, bounds)
    if (winImg && !winImg.isEmpty()) {
      markMacScreenCaptureVerified()
      return { image: winImg, appName, windowTitle }
    }
  } else {
    const rawW = Math.round((bounds?.width || display.size.width) * scale)
    const rawH = Math.round((bounds?.height || display.size.height) * scale)
    const { width: tw, height: th } = capThumbnailDimensions(rawW, rawH)
    try {
      const windowSources = await raceDeadline(
        desktopCapturer.getSources({
          types: ['window'],
          thumbnailSize: { width: tw, height: th },
          fetchWindowIcons: false
        }),
        3000,
        'window-capture-timeout'
      )
      const picked = pickWindowSource(windowSources, active, windowTitle)
      if (picked?.thumbnail && !picked.thumbnail.isEmpty()) {
        return { image: picked.thumbnail, appName, windowTitle }
      }
    } catch {
      /* fall through */
    }
  }

  const screenRawW = Math.round(display.size.width * scale)
  const screenRawH = Math.round(display.size.height * scale)
  const screenCap = capThumbnailDimensions(screenRawW, screenRawH)
  let image = await capturePrimaryScreenImage(screenCap, 4000)
  if (bounds) {
    image = cropThumbnailToBounds(image, bounds, display)
  }
  return { image, appName, windowTitle }
}

async function captureViaScreencaptureCli(): Promise<NativeImage | null> {
  if (process.platform !== 'darwin') return null
  const out = join(tmpdir(), `typenow-screen-${Date.now()}.png`)
  try {
    await execFileAsync('screencapture', ['-x', out], { timeout: 8000 })
    const img = nativeImage.createFromPath(out)
    if (!img || img.isEmpty()) return null
    return img
  } catch {
    return null
  } finally {
    try {
      unlinkSync(out)
    } catch {
      /* ignore */
    }
  }
}

async function capturePrimaryScreenImage(
  thumbnailSize: { width: number; height: number },
  timeoutMs: number
): Promise<NativeImage> {
  if (process.platform === 'darwin') {
    const cli = await captureViaScreencaptureCli()
    if (cli && !cli.isEmpty()) {
      markMacScreenCaptureVerified()
      return cli
    }
  }

  const sources = await raceDeadline(
    desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize
    }),
    timeoutMs,
    '截屏超时'
  )
  const display = screen.getPrimaryDisplay()
  const src = sources.find((s) => s.display_id === String(display.id)) || sources[0]
  if (!src?.thumbnail || src.thumbnail.isEmpty()) {
    throw new Error(
      process.platform === 'darwin' ? macScreenCaptureHint() : '截屏失败，请检查系统是否允许屏幕捕获'
    )
  }
  markMacScreenCaptureVerified()
  return src.thumbnail
}

async function captureViaDesktopCapturer(): Promise<WindowCapture> {
  const { image, appName, windowTitle } = await captureActiveWindowImage()
  return finalizeCapture(image, appName, windowTitle)
}

/** Capture the frontmost window (Mac / Windows) */
export async function captureFrontWindow(): Promise<WindowCapture> {
  return captureViaDesktopCapturer()
}

/** 与AI对话读屏：只截当前激活窗口（不截整桌面） */
export async function captureForEnhance(): Promise<{
  visionImage: VisionImagePayload
  imageBase64: string
  appName: string
  windowTitle: string
}> {
  const { image, appName, windowTitle } = await captureActiveWindowImage()
  const visionImage = preprocessEnhanceFullScreen(image)
  return { visionImage, imageBase64: visionImage.base64, appName, windowTitle }
}

/** 截取主屏幕整屏。看屏幕/答题清晰图 */
export async function captureFullScreen(opts?: {
  forEnhance?: boolean
}): Promise<{
  visionImage: VisionImagePayload
  imageBase64: string
}> {
  const display = screen.getPrimaryDisplay()
  const scale = display.scaleFactor || 1
  const screenRawW = Math.round(display.size.width * scale)
  const screenRawH = Math.round(display.size.height * scale)
  const maxLong = opts?.forEnhance ? ENHANCE_MAX_LONG_EDGE : undefined
  const screenCap = capThumbnailDimensions(screenRawW, screenRawH, maxLong)
  const timeoutMs = opts?.forEnhance ? 4000 : 8000
  const image = await capturePrimaryScreenImage(screenCap, timeoutMs)

  const visionImage = opts?.forEnhance
    ? preprocessEnhanceFullScreen(image)
    : preprocessFullScreenForVision(image)
  return { visionImage, imageBase64: visionImage.base64 }
}

export function guessChannel(appName: string, windowTitle: string): 'wechat' | 'qq' | 'unknown' {
  const hay = `${appName} ${windowTitle}`.toLowerCase()
  if (hay.includes('wechat') || hay.includes('微信') || hay.includes('weixin')) return 'wechat'
  if (hay.includes('qq') || hay.includes('腾讯qq')) return 'qq'
  return 'unknown'
}
