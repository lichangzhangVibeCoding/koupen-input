import { join } from 'path'
import { BrowserWindow, ipcMain, screen } from 'electron'
import { BRAND } from '../shared/brand'
import { HudIcon, HudStatus } from '../shared/types'
import { markAuxWindow, withMainDockPreserved } from './preserve-main-dock'

let hudWindow: BrowserWindow | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let ready = false
let pending: {
  text: string
  kind: string
  detail: string
  icon: string
} | null = null
/** 当前是否为答案态，且鼠标悬停在答案卡片上（暂停自动消失） */
let answerHovering = false
let lastAnswerText = ''
let lastHudKind = ''
/** 答案自动消失的剩余毫秒（悬停时冻结） */
let answerHideRemainingMs = 0
let answerHideStartedAt = 0

const HUD_W = 380
const HUD_H = 58
const HUD_ANSWER_W = 480
const HUD_ANSWER_H = 300
/** 答案移出悬停后至少再留这么久 */
const ANSWER_LEAVE_GRACE_MS = 12_000

function shellHtml(): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: transparent !important;
    overflow: hidden;
    font-family: "SF Pro Text", "PingFang SC", "Hiragino Sans GB", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  #root {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: transparent;
    padding-bottom: 2px;
    box-sizing: border-box;
  }
  .bar {
    display: none;
    align-items: center;
    gap: 10px;
    max-width: 360px;
    padding: 9px 14px 9px 11px;
    border-radius: 18px;
    color: #fff;
    font-size: 12.5px;
    font-weight: 560;
    letter-spacing: 0.01em;
    line-height: 1.25;
    box-sizing: border-box;
    user-select: none;
    -webkit-app-region: no-drag;
    box-shadow: 0 8px 28px rgba(18, 20, 26, 0.36);
    animation: in 0.18s ease-out;
    border: 1px solid rgba(0, 180, 200, 0.22);
  }
  .bar.show { display: inline-flex; }
  .bar.answer {
    display: none;
    max-width: 460px;
    width: min(460px, 100%);
    max-height: calc(100% - 4px);
    align-items: flex-start;
    border-radius: 16px;
    padding: 12px 14px;
    font-weight: 500;
    line-height: 1.45;
  }
  .bar.answer.show { display: inline-flex; }
  .bar.answer .copy {
    flex: 1;
    min-height: 0;
    max-height: 100%;
  }
  .bar.busy {
    background: linear-gradient(145deg, #1A1D26 0%, #12141A 55%, #0E1518 100%);
  }
  .bar.recording {
    background: linear-gradient(145deg, #1A2228 0%, #12141A 60%, #0C1418 100%);
    border-color: rgba(0, 180, 200, 0.45);
  }
  .bar.done, .bar.answer {
    background: linear-gradient(145deg, #1A1D26 0%, #151A1E 100%);
    border-color: rgba(0, 180, 200, 0.35);
  }
  .bar.error {
    background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
    border-color: transparent;
  }
  .icon {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
  }
  .copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.01em;
    opacity: 0.78;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .detail:empty { display: none; }
  .bar.answer .label {
    white-space: pre-wrap;
    overflow-x: hidden;
    overflow-y: auto;
    max-height: 240px;
    text-overflow: unset;
    font-size: 13px;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding-right: 4px;
  }
  .bar.answer .label::-webkit-scrollbar {
    width: 6px;
  }
  .bar.answer .label::-webkit-scrollbar-thumb {
    background: rgba(0, 180, 200, 0.45);
    border-radius: 999px;
  }
  .pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #00B4C8;
    animation: pulse 1.1s ease-in-out infinite;
  }
  .spinner {
    width: 12px;
    height: 12px;
    border: 1.6px solid rgba(0,180,200,0.28);
    border-top-color: #00B4C8;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  .look {
    width: 14px;
    height: 14px;
    border: 1.6px solid #00B4C8;
    border-radius: 50%;
    position: relative;
    animation: breathe 1.4s ease-in-out infinite;
  }
  .look::after {
    content: '';
    position: absolute;
    inset: 3px;
    border-radius: 50%;
    background: #00B4C8;
  }
  .listen {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1.5px solid rgba(0,180,200,0.9);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: ring 1.35s ease-out infinite;
  }
  .listen::after {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #00B4C8;
  }
  .speak {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 14px;
  }
  .speak i {
    display: block;
    width: 2.5px;
    border-radius: 2px;
    background: #00B4C8;
    animation: wave 0.9s ease-in-out infinite;
  }
  .speak i:nth-child(1) { height: 5px; animation-delay: 0s; }
  .speak i:nth-child(2) { height: 11px; animation-delay: 0.12s; }
  .speak i:nth-child(3) { height: 7px; animation-delay: 0.24s; }
  .speak i:nth-child(4) { height: 13px; animation-delay: 0.36s; }
  .think {
    width: 16px;
    height: 16px;
    position: relative;
    animation: spin 2.4s linear infinite;
  }
  .think span {
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #00B4C8;
  }
  .think span:nth-child(1) { top: 0; left: 6px; opacity: 1; }
  .think span:nth-child(2) { top: 6px; right: 0; opacity: 0.7; }
  .think span:nth-child(3) { bottom: 0; left: 6px; opacity: 0.45; }
  .think span:nth-child(4) { top: 6px; left: 0; opacity: 0.85; }
  .write {
    width: 12px;
    height: 12px;
    border: 1.6px solid rgba(0,180,200,0.32);
    border-top-color: #00B4C8;
    border-radius: 50%;
    animation: spin 0.75s linear infinite;
  }
  .check, .warn {
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    color: #00B4C8;
  }
  .bar.error .warn { color: #fff; }
  @keyframes pulse {
    0%, 100% { opacity: 0.45; transform: scale(0.9); }
    50% { opacity: 1; transform: scale(1.14); }
  }
  @keyframes breathe {
    0%, 100% { transform: scale(0.92); opacity: 0.75; }
    50% { transform: scale(1.08); opacity: 1; }
  }
  @keyframes ring {
    0% { transform: scale(0.72); opacity: 0.95; }
    70% { transform: scale(1.15); opacity: 0.35; }
    100% { transform: scale(1.25); opacity: 0.1; }
  }
  @keyframes wave {
    0%, 100% { transform: scaleY(0.55); opacity: 0.7; }
    50% { transform: scaleY(1); opacity: 1; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes in {
    from { opacity: 0; transform: translateY(6px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
</style>
</head>
<body>
  <div id="root">
    <div id="bar" class="bar" aria-live="polite">
      <div class="icon" id="icon"></div>
      <div class="copy">
        <div class="label" id="label"></div>
        <div class="detail" id="detail"></div>
      </div>
    </div>
  </div>
  <script>
    function iconFor(kind, icon) {
      var key = icon || '';
      if (!key) {
        if (kind === 'recording') key = 'listen';
        else if (kind === 'recognizing') key = 'look';
        else if (kind === 'generating') key = 'think';
        else if (kind === 'transcribing') key = 'write';
        else if (kind === 'done' || kind === 'answer') key = 'check';
        else if (kind === 'error') key = 'warn';
        else key = 'spin';
      }
      if (key === 'look') return '<span class="look"></span>';
      if (key === 'listen') return '<span class="listen"></span>';
      if (key === 'speak') return '<span class="speak"><i></i><i></i><i></i><i></i></span>';
      if (key === 'think') return '<span class="think"><span></span><span></span><span></span><span></span></span>';
      if (key === 'write' || key === 'spin') return '<span class="write"></span>';
      if (key === 'pulse') return '<span class="pulse"></span>';
      if (key === 'check') return '<span class="check">✓</span>';
      if (key === 'warn') return '<span class="warn">!</span>';
      return '<span class="spinner"></span>';
    }
    function toneClass(kind) {
      if (kind === 'error') return 'error';
      if (kind === 'done') return 'done';
      if (kind === 'answer') return 'answer';
      if (kind === 'recording') return 'recording';
      return 'busy';
    }
    window.__hudUpdate = function (text, kind, detail, icon) {
      var bar = document.getElementById('bar');
      var iconEl = document.getElementById('icon');
      var label = document.getElementById('label');
      var detailEl = document.getElementById('detail');
      if (!bar || !iconEl || !label || !detailEl) return;
      iconEl.innerHTML = iconFor(kind, icon || '');
      label.textContent = text || '';
      detailEl.textContent = detail || '';
      bar.className = 'bar show ' + toneClass(kind);
      if (window.hudBridge) window.hudBridge.setIgnoreMouse(true);
    };
    window.__hudHide = function () {
      var bar = document.getElementById('bar');
      if (bar) bar.className = 'bar';
      if (window.hudBridge) window.hudBridge.setIgnoreMouse(true);
    };
    (function bindAnswerHover() {
      var bar = document.getElementById('bar');
      if (!bar || !window.hudBridge) return;
      bar.addEventListener('mouseenter', function () {
        if (bar.classList.contains('answer')) {
          window.hudBridge.setIgnoreMouse(false);
          if (window.hudBridge.setAnswerHover) window.hudBridge.setAnswerHover(true);
        }
      });
      bar.addEventListener('mouseleave', function () {
        window.hudBridge.setIgnoreMouse(true);
        if (window.hudBridge.setAnswerHover) window.hudBridge.setAnswerHover(false);
      });
      bar.addEventListener('wheel', function () {
        if (bar.classList.contains('answer') && window.hudBridge.setAnswerHover) {
          window.hudBridge.setAnswerHover(true);
        }
      }, { passive: true });
    })();
  </script>
</body>
</html>`
}

function placeHud(win: BrowserWindow, kind?: string, hasDetail?: boolean): void {
  const display = screen.getPrimaryDisplay()
  const answer = kind === 'answer'
  const w = answer ? HUD_ANSWER_W : HUD_W
  const h = answer ? HUD_ANSWER_H : hasDetail ? HUD_H : 48
  const x = display.workArea.x + Math.round((display.workAreaSize.width - w) / 2)
  const y = display.workArea.y + display.workAreaSize.height - h - 18
  win.setBounds({ x, y, width: w, height: h })
}

let hudIpcBound = false

function bindHudIpc(): void {
  if (hudIpcBound) return
  hudIpcBound = true
  ipcMain.on('hud:setIgnoreMouse', (_e, ignore: unknown) => {
    if (!hudWindow || hudWindow.isDestroyed()) return
    try {
      hudWindow.setIgnoreMouseEvents(Boolean(ignore), { forward: true })
    } catch {
      /* ignore */
    }
  })
  ipcMain.on('hud:answerHover', (_e, hovering: unknown) => {
    const next = Boolean(hovering)
    answerHovering = next
    if (lastHudKind !== 'answer') return
    if (next) {
      freezeAnswerHideRemaining()
      clearHideTimer()
      return
    }
    // 移出：用冻结的剩余时间，至少再留一段宽限
    const remaining = Math.max(ANSWER_LEAVE_GRACE_MS, answerHideRemainingMs)
    scheduleAutoHide('answer', lastAnswerText, remaining)
  })
}

/** 答案阅读时间：约 4 字/秒，夹在 20s～90s */
function answerAutoHideMs(text: string): number {
  const readingMs = Math.ceil(Math.max(0, text.length) / 4) * 1000
  return Math.min(90_000, Math.max(20_000, 12_000 + readingMs))
}

function clearHideTimer(): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function freezeAnswerHideRemaining(): void {
  if (!hideTimer || lastHudKind !== 'answer') return
  const elapsed = Date.now() - answerHideStartedAt
  answerHideRemainingMs = Math.max(0, answerHideRemainingMs - elapsed)
}

function performHudHide(): void {
  answerHovering = false
  lastHudKind = ''
  lastAnswerText = ''
  answerHideRemainingMs = 0
  answerHideStartedAt = 0
  if (hudWindow && !hudWindow.isDestroyed()) {
    try {
      hudWindow.setIgnoreMouseEvents(true, { forward: true })
    } catch {
      /* ignore */
    }
    void hudWindow.webContents
      .executeJavaScript('window.__hudHide && window.__hudHide()')
      .catch(() => undefined)
    hudWindow.hide()
  }
}

function scheduleAutoHide(kind: string, text = '', forceMs?: number): void {
  if (kind !== 'done' && kind !== 'error' && kind !== 'answer') return
  clearHideTimer()
  if (kind === 'answer' && answerHovering) {
    // 悬停中：只记下应有的总时长，等移出再开计时
    answerHideRemainingMs = forceMs ?? answerAutoHideMs(text)
    return
  }
  const ms =
    forceMs ?? (kind === 'answer' ? answerAutoHideMs(text) : 2400)
  if (kind === 'answer') {
    answerHideRemainingMs = ms
    answerHideStartedAt = Date.now()
  } else {
    answerHideRemainingMs = 0
    answerHideStartedAt = 0
  }
  hideTimer = setTimeout(() => {
    hideTimer = null
    // 定时到时若仍悬停，继续等移出
    if (kind === 'answer' && answerHovering) return
    performHudHide()
  }, ms)
}

function ensureHud(): BrowserWindow {
  if (hudWindow && !hudWindow.isDestroyed()) return hudWindow

  ready = false
  bindHudIpc()
  let win!: BrowserWindow
  withMainDockPreserved(() => {
    win = new BrowserWindow({
      width: HUD_W,
      height: HUD_H,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
      fullscreenable: false,
      thickFrame: false,
      // panel：避免在主窗口已缩到程序坞时，弹出 HUD 把主窗口从 Dock「弄没」
      ...(process.platform === 'darwin'
        ? { type: 'panel' as const, hiddenInMissionControl: true }
        : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/hud.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        backgroundThrottling: false
      }
    })
    markAuxWindow(win)

    if (process.platform === 'darwin') {
      win.setWindowButtonVisibility(false)
      win.setAlwaysOnTop(true, 'floating')
    } else {
      win.setAlwaysOnTop(true)
    }

    // 始终穿透；答案卡片悬停时由 preload 临时关闭穿透以便滚轮
    win.setIgnoreMouseEvents(true, { forward: true })
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    placeHud(win)

    win.webContents.on('did-finish-load', () => {
      ready = true
      if (pending) {
        const p = pending
        pending = null
        void applyHud(win, p.text, p.kind, p.detail, p.icon)
        scheduleAutoHide(p.kind, p.text)
      }
    })

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(shellHtml())}`)
    hudWindow = win
  })
  return win
}

async function applyHud(
  win: BrowserWindow,
  text: string,
  kind: string,
  detail: string,
  icon: string
): Promise<void> {
  const args = [text, kind, detail, icon].map((x) => JSON.stringify(x)).join(', ')
  try {
    await win.webContents.executeJavaScript(
      `window.__hudUpdate && window.__hudUpdate(${args})`
    )
  } catch {
    // ignore
  }
  if (!win.isVisible()) {
    withMainDockPreserved(() => {
      win.showInactive()
    })
  }
  // 默认穿透（含答案透明区）；悬停卡片时由 hudBridge 临时接收鼠标
  try {
    win.setIgnoreMouseEvents(true, { forward: true })
  } catch {
    /* ignore */
  }
  // 防止被其它全屏层压住：每次更新再抬一次
  if (process.platform === 'darwin') {
    win.setAlwaysOnTop(true, 'floating')
  } else {
    win.setAlwaysOnTop(true)
  }
}

function defaultText(kind: HudStatus['kind']): string {
  switch (kind) {
    case 'recognizing':
      return '正在看聊天…'
    case 'generating':
      return '正在想怎么回你…'
    case 'recording':
      return process.platform === 'win32'
        ? '我在听…再按一下 Alt 结束'
        : '我在听…再按一下右 Command 结束'
    case 'transcribing':
      return '我记下来了…'
    default:
      return ''
  }
}

function defaultIcon(kind: HudStatus['kind']): HudIcon | '' {
  switch (kind) {
    case 'recognizing':
      return 'look'
    case 'recording':
      return 'listen'
    case 'transcribing':
      return 'write'
    case 'generating':
      return 'think'
    case 'done':
    case 'answer':
      return 'check'
    case 'error':
      return 'warn'
    default:
      return ''
  }
}

/** 过长文案收短，避免胶囊显得笨重（answer 不截断） */
function compactHudText(text: string, kind: string): string {
  let t = text.trim()
  if (kind === 'answer') {
    if (t.length > 1200) t = `${t.slice(0, 1199)}…`
    return t
  }
  const voice = BRAND.voice.name
  const reply = BRAND.reply.name
  t = t
    .replace(new RegExp(`^${reply}：正在看聊天…（本地）$`), '正在看聊天…')
    .replace(new RegExp(`^${reply}：正在看聊天…$`), '正在看聊天…')
    .replace(new RegExp(`^${reply}：看聊天…（本地）$`), '正在看聊天…')
    .replace(new RegExp(`^${reply}：看聊天…$`), '正在看聊天…')
    .replace(new RegExp(`^${reply}：正在写回复…（本地）$`), '正在想怎么回你…')
    .replace(new RegExp(`^${reply}：正在写回复…$`), '正在想怎么回你…')
    .replace(new RegExp(`^${reply}：写回复…（本地）$`), '正在想怎么回你…')
    .replace(new RegExp(`^${reply}：写回复…$`), '正在想怎么回你…')
    .replace(new RegExp(`^${reply}：已填入.*$`), '写好了，帮你填进输入框啦')
    .replace(new RegExp(`^${voice}：转文字…$`), '我记下来了…')
    .replace(new RegExp(`^${voice}：听着…`), '我在听…')
    .replace(/^粘贴失败.*$/, '填不进去，但我帮你复制好了')
    .replace(/^已套用「(.+?)」$/, '想到了「$1」这招…')
    .replace(new RegExp(`^${reply}：已套用「(.+?)」.*$`), '想到了「$1」这招…')
    .replace(/^帮你口喷：/, '')
    .replace(/^我来口喷：/, '')
    .replace(new RegExp(`^${reply}：`), '')
    .replace(new RegExp(`^${voice}：`), '')
    .replace(/^正在截整屏…$/, '正在看屏幕…')
    .replace(/^看屏幕：正在截整屏…$/, '正在看屏幕…')

  const max = kind === 'error' ? 42 : 48
  if (t.length > max) t = `${t.slice(0, max - 1)}…`
  return t
}

export function showHud(status: HudStatus): void {
  clearHideTimer()

  if (status.kind === 'hidden') {
    performHudHide()
    return
  }

  const text = compactHudText(status.text || defaultText(status.kind), status.kind)
  const detail =
    status.kind !== 'answer' && 'detail' in status && status.detail
      ? compactHudText(status.detail, 'error')
      : ''
  const icon =
    status.kind !== 'answer' && 'icon' in status && status.icon
      ? status.icon
      : defaultIcon(status.kind)
  lastHudKind = status.kind
  if (status.kind === 'answer') {
    lastAnswerText = text
  } else {
    answerHovering = false
    lastAnswerText = ''
    answerHideRemainingMs = 0
    answerHideStartedAt = 0
  }
  const win = ensureHud()
  placeHud(win, status.kind, Boolean(detail))

  if (!ready) {
    pending = { text, kind: status.kind, detail, icon }
    withMainDockPreserved(() => {
      win.showInactive()
    })
    return
  }

  void applyHud(win, text, status.kind, detail, icon)
  scheduleAutoHide(status.kind, text)
}

export function destroyHud(): void {
  clearHideTimer()
  answerHovering = false
  lastAnswerText = ''
  lastHudKind = ''
  answerHideRemainingMs = 0
  answerHideStartedAt = 0
  pending = null
  ready = false
  if (hudWindow && !hudWindow.isDestroyed()) hudWindow.destroy()
  hudWindow = null
}
