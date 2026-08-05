import { app } from 'electron'

/**
 * 开发版程序坞角标。
 * 用短 ASCII「DEV」：macOS Dock 对中文「开发」经常不渲染或极淡。
 */
export function applyDevDockBadge(): void {
  if (app.isPackaged || process.platform !== 'darwin') return
  try {
    app.dock?.setBadge('DEV')
  } catch {
    /* ignore */
  }
}
