import { app, nativeImage } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

function trayIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources/trayTemplate.png')
  }
  return join(app.getAppPath(), 'resources/trayTemplate.png')
}

/** macOS 菜单栏模板图标（16×16） */
export function getTrayIcon(): Electron.NativeImage {
  const path = trayIconPath()
  if (existsSync(path)) {
    const img = nativeImage.createFromPath(path)
    if (!img.isEmpty()) {
      img.setTemplateImage(true)
      return img
    }
  }
  const empty = nativeImage.createEmpty()
  empty.setTemplateImage(true)
  return empty
}
