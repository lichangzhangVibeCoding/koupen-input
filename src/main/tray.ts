import { app, BrowserWindow, Menu, Tray } from 'electron'
import { BRAND } from '../shared/brand'
import { appDisplayTitle, t } from '../shared/i18n'
import { getModelDashboard } from './model-service'
import { getTrayIcon } from './tray-icon'

export type TrayHandlers = {
  getMainWindow: () => BrowserWindow | null
  onVoice: () => void
  onReply: () => void
  onScreenAsk: () => void
  onScreenQuiz: () => void
  onQuit: () => void
}

let tray: Tray | null = null
let statusTimer: ReturnType<typeof setInterval> | null = null
let lastHandlers: TrayHandlers | null = null

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
    const dash = await getModelDashboard()
    return t('tray.modelsReady', { ready: dash.readyCount, total: dash.total })
  } catch {
    return t('tray.modelsUnknown')
  }
}

function trayAppTitle(): string {
  return appDisplayTitle(!app.isPackaged)
}

async function rebuildMenu(handlers: TrayHandlers): Promise<void> {
  if (!tray) return
  const status = await statusLine()
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
      label: BRAND.reply.name,
      click: () => handlers.onReply()
    },
    {
      label: BRAND.screenAsk.name,
      click: () => handlers.onScreenAsk()
    },
    {
      label: BRAND.screenQuiz.name,
      click: () => handlers.onScreenQuiz()
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
  // 开发版菜单栏旁加「开发」字样，方便和安装版区分
  if (!app.isPackaged) {
    tray.setTitle(t('brand.devBadge'))
  }
}

/** 语言切换或状态变化后刷新托盘文案 */
export function refreshTray(): void {
  if (!tray || !lastHandlers) return
  const icon = getTrayIcon()
  if (icon.isEmpty()) {
    tray.setTitle(t('brand.trayShort'))
  }
  void rebuildMenu(lastHandlers)
}

/** 初始化 macOS 菜单栏托盘；失败时不影响 Dock 主流程 */
export function setupTray(handlers: TrayHandlers): Tray | null {
  if (process.platform !== 'darwin') return null
  if (tray) return tray

  try {
    lastHandlers = handlers
    const icon = getTrayIcon()
    tray = new Tray(icon)
    if (icon.isEmpty()) {
      tray.setTitle(t('brand.trayShort'))
    }
    tray.setToolTip(trayAppTitle())

    void rebuildMenu(handlers)
    tray.on('click', () => {
      navigateMainWindow(handlers.getMainWindow(), '/', true)
    })

    statusTimer = setInterval(() => {
      void rebuildMenu(handlers)
    }, 30_000)

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
