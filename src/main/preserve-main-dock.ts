import { app, BrowserWindow } from 'electron'
import { applyDevDockBadge } from './dev-dock'

/** HUD / 录音等附属窗，不参与「主窗口」保护 */
const auxWindows = new WeakSet<BrowserWindow>()

export function markAuxWindow(win: BrowserWindow): void {
  auxWindows.add(win)
}

type MainSnap = {
  win: BrowserWindow
  minimized: boolean
  visible: boolean
}

function listMainWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && !auxWindows.has(w))
}

/** 功能触发前记下主窗口显示/缩小状态 */
export function snapshotMainWindowDockState(): MainSnap[] {
  return listMainWindows().map((win) => ({
    win,
    minimized: win.isMinimized(),
    visible: win.isVisible()
  }))
}

/**
 * 弹出 HUD / 录音窗时，macOS 可能把主窗口从「缩小」变成「隐藏」，
 * 或把正在显示的主窗口藏掉 → 程序坞图标随之消失。
 * 按触发前的状态把主窗口拉回。
 */
export function restoreMainWindowDockState(snaps: MainSnap[]): void {
  if (process.platform === 'darwin') {
    try {
      app.dock?.show()
      applyDevDockBadge()
    } catch {
      /* ignore */
    }
  }

  for (const s of snaps) {
    if (s.win.isDestroyed()) continue
    try {
      if (s.minimized) {
        if (s.win.isMinimized()) continue
        if (!s.win.isVisible()) s.win.showInactive()
        s.win.minimize()
        continue
      }
      // 原先正常显示：若被附属窗弄成隐藏，无焦点拉回
      if (s.visible && !s.win.isVisible() && !s.win.isMinimized()) {
        s.win.showInactive()
      }
    } catch {
      /* ignore */
    }
  }
}

function scheduleRestore(snaps: MainSnap[]): void {
  const run = () => restoreMainWindowDockState(snaps)
  // Electron 在 showInactive 后可能异步改主窗状态，多拍补救
  setImmediate(run)
  setTimeout(run, 50)
  setTimeout(run, 200)
}

/** 同步操作后恢复 */
export function withMainDockPreserved(fn: () => void): void {
  const snaps = snapshotMainWindowDockState()
  try {
    fn()
  } finally {
    scheduleRestore(snaps)
  }
}

export async function withMainDockPreservedAsync<T>(fn: () => Promise<T>): Promise<T> {
  const snaps = snapshotMainWindowDockState()
  try {
    return await fn()
  } finally {
    scheduleRestore(snaps)
  }
}
