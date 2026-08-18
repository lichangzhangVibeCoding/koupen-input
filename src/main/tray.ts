import { execFile } from 'child_process'
import { app, BrowserWindow, Menu, Tray } from 'electron'
import { BRAND } from '../shared/brand'
import { appDisplayTitle, t } from '../shared/i18n'
import { getModelDashboard } from './model-service'
import { getTrayIcon, getTrayIconPath } from './tray-icon'

/** 独立身份，避免被系统当成无名 Item-0 藏进菜单栏 */
const TRAY_GUID = 'a8e3c0d2-7f14-4b9a-9c21-1f0e4d7b6a55'

export type TrayHandlers = {
  getMainWindow: () => BrowserWindow | null
  onVoice: () => void
  onAiTalk: () => void
  onReply: () => void
  onScreenAsk: () => void
  onQuit: () => void
}

let tray: Tray | null = null
let statusTimer: ReturnType<typeof setInterval> | null = null
let lastHandlers: TrayHandlers | null = null
let lastStatus = ''

export function navigateMainWindow(
  win: BrowserWindow | null,
  hash: string,
  show = true
): void {
  if (!win) return
  if (show) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
  const route = hash.startsWith('#') ? hash : `#/${hash.replace(/^\//, '')}`
  void win.webContents.executeJavaScript(`window.location.hash = ${JSON.stringify(route)}`)
}

async function statusLine(): Promise<string> {
  try {
    const dash = await Promise.race([
      getModelDashboard(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 1500)
      })
    ])
    return t('tray.modelsReady', { ready: dash.readyCount, total: dash.total })
  } catch {
    return t('tray.modelsUnknown')
  }
}

function trayAppTitle(): string {
  return appDisplayTitle(!app.isPackaged)
}

function applyTrayTitle(): void {
  if (!tray) return
  try {
    tray.setTitle(t('brand.trayShort'))
  } catch {
    /* ignore */
  }
}

function applyMenu(handlers: TrayHandlers, status: string): void {
  if (!tray) return
  lastStatus = status
  const title = trayAppTitle()
  const menu = Menu.buildFromTemplate([
    { label: title, enabled: false },
    { label: status, enabled: false },
    { type: 'separator' },
    {
      label: BRAND.voice.name,
      click: () => handlers.onVoice()
    },
    {
      label: BRAND.aiTalk.name,
      click: () => handlers.onAiTalk()
    },
    {
      label: BRAND.reply.name,
      click: () => handlers.onReply()
    },
    {
      label: BRAND.screenAsk.name,
      click: () => handlers.onScreenAsk()
    },
    { type: 'separator' },
    {
      label: t('tray.openMain'),
      click: () => navigateMainWindow(handlers.getMainWindow(), '/', true)
    },
    {
      label: t('tray.screenAsk'),
      click: () => navigateMainWindow(handlers.getMainWindow(), '/chats', true)
    },
    {
      label: t('tray.models'),
      click: () => navigateMainWindow(handlers.getMainWindow(), '/models', true)
    },
    {
      label: t('tray.prefs'),
      click: () => navigateMainWindow(handlers.getMainWindow(), '/settings', true)
    },
    { type: 'separator' },
    {
      label: t('tray.quit'),
      click: () => handlers.onQuit()
    }
  ])
  tray.setContextMenu(menu)
  tray.setToolTip(title)
  applyTrayTitle()
}

async function rebuildMenu(handlers: TrayHandlers): Promise<void> {
  if (!tray) return
  applyMenu(handlers, lastStatus || t('tray.modelsUnknown'))
  const status = await statusLine()
  applyMenu(handlers, status)
}

function applyTrayImage(): void {
  if (!tray) return
  const path = getTrayIconPath()
  try {
    if (path) tray.setImage(path)
    else tray.setImage(getTrayIcon())
  } catch {
    try {
      tray.setImage(getTrayIcon())
    } catch {
      /* ignore */
    }
  }
}

/** 语言切换或状态变化后刷新托盘文案 */
export function refreshTray(): void {
  if (!tray || !lastHandlers) return
  applyTrayImage()
  applyTrayTitle()
  void rebuildMenu(lastHandlers)
}

function popupTrayMenu(): void {
  if (!tray) return
  try {
    tray.popUpContextMenu()
  } catch {
    /* ignore */
  }
}

function unhideStatusItem(): void {
  execFile(
    'defaults',
    ['write', 'com.apple.controlcenter', `NSStatusItem Visible ${TRAY_GUID}`, '-bool', 'true'],
    () => {
      /* ignore: 无权限时 silently fail */
    }
  )
}

function createStatusItem(iconPath: string | null): Tray {
  const icon = getTrayIcon()
  try {
    return new Tray(iconPath || icon, TRAY_GUID)
  } catch (err) {
    console.warn('Tray GUID failed, falling back', err)
    return new Tray(iconPath || icon)
  }
}

/** 初始化 macOS 菜单栏托盘；失败时不影响 Dock 主流程 */
export function setupTray(handlers: TrayHandlers): Tray | null {
  if (process.platform !== 'darwin') return null
  if (tray) return tray

  try {
    lastHandlers = handlers
    unhideStatusItem()
    const iconPath = getTrayIconPath()
    tray = createStatusItem(iconPath)
    tray.setIgnoreDoubleClickEvents(true)
    applyTrayTitle()
    tray.setToolTip(trayAppTitle())
    applyMenu(handlers, t('tray.modelsUnknown'))
    void rebuildMenu(handlers)

    tray.on('click', () => {
      popupTrayMenu()
    })
    tray.on('right-click', () => {
      popupTrayMenu()
    })

    statusTimer = setInterval(() => {
      void rebuildMenu(handlers)
    }, 30_000)

    const logBounds = (when: string): void => {
      try {
        const bounds = tray?.getBounds()
        console.info('[tray]', when, {
          path: iconPath,
          title: tray?.getTitle(),
          bounds
        })
        if (
          when === 'after-2s' &&
          bounds &&
          bounds.x === 0 &&
          bounds.height > 0 &&
          bounds.height <= 22
        ) {
          console.warn(
            '[tray] 菜单栏图标被系统放到屏幕外。请打开 系统设置 → 菜单栏，打开「Electron」或「即刻对话」；仍没有则点页面底部「还原控制中心」。'
          )
        }
      } catch {
        /* ignore */
      }
    }
    logBounds('ready')
    setTimeout(() => logBounds('after-2s'), 2000)

    return tray
  } catch (err) {
    console.error('Failed to setup menu bar tray', err)
    tray = null
    return null
  }
}

export function destroyTray(): void {
  if (statusTimer) {
    clearInterval(statusTimer)
    statusTimer = null
  }
  if (tray) {
    tray.destroy()
    tray = null
  }
  lastHandlers = null
}
