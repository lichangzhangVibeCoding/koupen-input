import { BrowserWindow, screen } from 'electron'
import { HudStatus } from '../shared/types'

let hudWindow: BrowserWindow | null = null
let hideTimer: NodeJS.Timeout | null = null

function iconFor(kind: string): string {
  if (kind === 'recording') return '<span class="pulse"></span>'
  if (kind === 'recognizing' || kind === 'generating' || kind === 'transcribing') {
    return '<span class="spinner"></span>'
  }
  if (kind === 'done') return '<span class="check">✓</span>'
  if (kind === 'error') return '<span class="warn">!</span>'
  return ''
}

function hudHtml(text: string, kind: string): string {
  const isError = kind === 'error'
  const isDone = kind === 'done'
  // 与主界面按钮一致的紫渐变；完成/失败略作区分但仍在紫系
  const barBg = isError
    ? 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)'
    : isDone
      ? 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 55%, #6d28d9 100%)'
      : 'linear-gradient(135deg, #c4b5fd 0%, #8b5cf6 45%, #7c3aed 100%)'
  const glow = isError
    ? 'rgba(244, 63, 94, 0.45)'
    : 'rgba(124, 58, 237, 0.55)'

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body {
    margin: 0; padding: 0;
    background: transparent;
    overflow: hidden;
    font-family: "SF Pro Text", "PingFang SC", "Hiragino Sans GB", sans-serif;
  }
  .bar {
    margin: 12px auto;
    width: fit-content;
    max-width: 380px;
    min-height: 44px;
    padding: 11px 18px 11px 14px;
    border-radius: 999px;
    background: ${barBg};
    color: #fff;
    font-size: 14px;
    font-weight: 650;
    letter-spacing: 0.02em;
    box-shadow:
      0 10px 32px ${glow},
      0 0 0 1px rgba(255, 255, 255, 0.18) inset,
      0 1px 0 rgba(255, 255, 255, 0.25) inset;
    backdrop-filter: blur(12px);
    -webkit-app-region: no-drag;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: rise 0.22s ease-out;
  }
  .icon {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .label {
    line-height: 1.35;
    text-shadow: 0 1px 2px rgba(45, 20, 90, 0.25);
  }
  .pulse {
    width: 10px; height: 10px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 10px rgba(255,255,255,0.8);
    animation: pulse 1.1s ease-in-out infinite;
  }
  .spinner {
    width: 14px; height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.75s linear infinite;
  }
  .check, .warn {
    color: #fff;
    font-size: 15px;
    font-weight: 800;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.4; transform: scale(0.85); }
    50% { opacity: 1; transform: scale(1.15); }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
</head>
<body>
  <div class="bar">
    <div class="icon">${iconFor(kind)}</div>
    <div class="label">${escapeHtml(text)}</div>
  </div>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ensureHud(): BrowserWindow {
  if (hudWindow && !hudWindow.isDestroyed()) return hudWindow

  const display = screen.getPrimaryDisplay()
  const width = 420
  const height = 72
  const x = display.workArea.x + Math.round((display.workAreaSize.width - width) / 2)
  const y = display.workArea.y + display.workAreaSize.height - height - 28

  hudWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  hudWindow.setIgnoreMouseEvents(true)
  hudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  return hudWindow
}

export function showHud(status: HudStatus): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }

  if (status.kind === 'hidden') {
    if (hudWindow && !hudWindow.isDestroyed()) hudWindow.hide()
    return
  }

  const text =
    status.text ||
    (status.kind === 'recognizing'
      ? '帮你口喷：正在看聊天…'
      : status.kind === 'generating'
        ? '帮你口喷：正在写回复…'
        : status.kind === 'recording'
          ? process.platform === 'win32'
            ? '我来口喷：正在听…再按 Alt 结束'
            : '我来口喷：正在听…再按左 Command 结束'
          : status.kind === 'transcribing'
            ? '我来口喷：正在转成字…'
            : '')

  const win = ensureHud()
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(hudHtml(text, status.kind))}`)
  win.showInactive()

  if (status.kind === 'done' || status.kind === 'error') {
    hideTimer = setTimeout(() => {
      if (hudWindow && !hudWindow.isDestroyed()) hudWindow.hide()
    }, 2800)
  }
}

export function destroyHud(): void {
  if (hideTimer) clearTimeout(hideTimer)
  if (hudWindow && !hudWindow.isDestroyed()) hudWindow.destroy()
  hudWindow = null
}
