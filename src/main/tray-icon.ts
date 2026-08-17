import { app, nativeImage } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

function resourceCandidates(file: string): string[] {
  return [
    join(process.resourcesPath, 'resources', file),
    join(app.getAppPath(), 'resources', file),
    join(__dirname, '../../resources', file),
    join(process.cwd(), 'resources', file)
  ]
}

function firstExisting(file: string): string | null {
  for (const p of resourceCandidates(file)) {
    if (existsSync(p)) return p
  }
  return null
}

/** 16pt 模板图路径；同目录需有 trayTemplate@2x.png */
export function getTrayIconPath(): string | null {
  return firstExisting('trayTemplate.png')
}

/** macOS 菜单栏模板图标：16pt 1x + 32px 2x */
export function getTrayIcon(): Electron.NativeImage {
  const p16 = firstExisting('trayTemplate.png') || firstExisting('trayTemplate-16.png')
  const p32 = firstExisting('trayTemplate@2x.png') || firstExisting('trayTemplate.png')

  if (p16) {
    const img = nativeImage.createFromPath(p16)
    if (!img.isEmpty()) {
      if (p32 && p32 !== p16) {
        try {
          img.addRepresentation({
            scaleFactor: 2,
            width: 32,
            height: 32,
            buffer: readFileSync(p32)
          })
        } catch {
          /* keep 1x */
        }
      }
      img.setTemplateImage(true)
      return img
    }
  }

  if (p32) {
    const big = nativeImage.createFromPath(p32)
    if (!big.isEmpty()) {
      const img = big.resize({ width: 16, height: 16 })
      try {
        img.addRepresentation({
          scaleFactor: 2,
          width: 32,
          height: 32,
          buffer: big.toPNG()
        })
      } catch {
        /* keep resized 1x */
      }
      img.setTemplateImage(true)
      return img
    }
  }

  const empty = nativeImage.createEmpty()
  empty.setTemplateImage(true)
  return empty
}
