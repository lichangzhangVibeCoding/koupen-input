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

async function getFrontAppMeta(): Promise<{ appName: string; windowTitle: string }> {
  if (process.platform === 'darwin') {
    return {
      appName: await getFrontAppNameMac(),
      windowTitle: await getFrontWindowTitleMac()
    }
  }
  try {
    const activeWin = (await import('active-win')).default
    const win = await activeWin()
    return {
      appName: win?.owner?.name || '',
      windowTitle: win?.title || ''
    }
  } catch {
    return { appName: '', windowTitle: '' }
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
    const activeWin = (await import('active-win')).default
    const win = await activeWin()
    if (win?.id) windowId = win.id
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

async function captureWindows(): Promise<WindowCapture> {
  const { appName, windowTitle } = await getFrontAppMeta()
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.size
  const scale = display.scaleFactor || 1
  const tw = Math.round(width * scale)
  const th = Math.round(height * scale)

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: tw, height: th }
  })
  const source =
    sources.find((s) => s.display_id === String(display.id)) || sources[0]
  if (!source?.thumbnail || source.thumbnail.isEmpty()) {
    throw new Error('截屏失败，请检查系统是否允许屏幕捕获')
  }

  const png = source.thumbnail.toPNG()
  return {
    imagePath: '',
    imageBase64: png.toString('base64'),
    appName,
    windowTitle
  }
}

/** Capture the frontmost window (Mac) or primary screen (Windows) */
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
