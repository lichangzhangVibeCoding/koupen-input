import { clipboard } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { hasMacAccessibility, macAccessibilityApisAllowed } from './permissions'

const execFileAsync = promisify(execFile)

export type PasteMode = 'restore-clipboard' | 'keep-clipboard'

/** Paste text into the frontmost app. Does NOT press Enter/Send. */
export async function pasteIntoFrontApp(
  text: string,
  mode: PasteMode = 'restore-clipboard'
): Promise<'pasted' | 'clipboard'> {
  const previous = clipboard.readText()
  clipboard.writeText(text)

  try {
    if (process.platform === 'win32') {
      await pasteWindows()
    } else {
      await pasteMac()
    }
    if (mode === 'restore-clipboard') {
      setTimeout(() => {
        try {
          clipboard.writeText(previous)
        } catch {
          // ignore
        }
      }, 800)
    }
    return 'pasted'
  } catch {
    return 'clipboard'
  }
}

async function pasteMac(): Promise<void> {
  // 未签名包即使勾了辅助功能，System Events 也会反复弹窗 → 只用剪贴板兜底
  if (!macAccessibilityApisAllowed() || !hasMacAccessibility()) {
    throw new Error('accessibility required')
  }
  await execFileAsync('osascript', [
    '-e',
    'tell application "System Events" to keystroke "v" using command down'
  ])
}

async function pasteWindows(): Promise<void> {
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 80; [System.Windows.Forms.SendKeys]::SendWait('^v')"
  ])
}
