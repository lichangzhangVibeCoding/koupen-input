import { app, BrowserWindow, ipcMain, session } from 'electron'
import { randomUUID } from 'crypto'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { ensureMacMicrophoneAccess } from './permissions'
import { markAuxWindow, withMainDockPreservedAsync } from './preserve-main-dock'
import { TaskCancelledError } from './task-cancel'
import { t } from '../shared/i18n'

let recorderWin: BrowserWindow | null = null
let pending:
  | {
      resolve: (data: { buffer: Buffer; mime: string }) => void
      reject: (err: Error) => void
      requestId: string
    }
  | null = null

let ipcReady = false
let currentRequestId = ''
let micPermissionHooked = false

const RECORDER_HTML = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="UTF-8" /><title>Recorder</title></head>
<body>
<script>
let mediaStream = null
let mediaRecorder = null
let chunks = []
let requestId = ''

async function start(id) {
  requestId = id
  chunks = []
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }
  })
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : ''
  mediaRecorder = new MediaRecorder(mediaStream, mime ? { mimeType: mime } : undefined)
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }
  mediaRecorder.onstop = async () => {
    try {
      const blob = new Blob(chunks, { type: (mediaRecorder && mediaRecorder.mimeType) || 'audio/webm' })
      const buf = await blob.arrayBuffer()
      window.recBridge.result({
        requestId,
        ok: true,
        bytes: Array.from(new Uint8Array(buf)),
        mime: blob.type || 'audio/webm'
      })
    } catch (err) {
      window.recBridge.result({
        requestId,
        ok: false,
        error: String((err && err.message) || err)
      })
    } finally {
      if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop())
      mediaStream = null
      mediaRecorder = null
      chunks = []
    }
  }
  mediaRecorder.start(1000)
  window.recBridge.started({ requestId })
}

function stop() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  } else {
    window.recBridge.result({ requestId, ok: false, error: '录音尚未开始' })
  }
}

function discard() {
  try {
    if (mediaRecorder) {
      mediaRecorder.ondataavailable = null
      mediaRecorder.onstop = null
      if (mediaRecorder.state !== 'inactive') mediaRecorder.stop()
    }
  } catch (e) {}
  if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop())
  mediaStream = null
  mediaRecorder = null
  chunks = []
  window.recBridge.result({ requestId, ok: false, error: 'CANCELLED' })
}

window.recorderApi = { start, stop, discard }
</script>
</body>
</html>`

function ensureIpc(): void {
  if (ipcReady) return
  ipcReady = true

  ipcMain.on('voice:recorder-started', () => {})

  ipcMain.on(
    'voice:recorder-result',
    (
      _e,
      payload: { requestId: string; ok: boolean; bytes?: number[]; mime?: string; error?: string }
    ) => {
      if (!pending || pending.requestId !== payload.requestId) return
      const { resolve, reject } = pending
      pending = null
      if (!payload.ok || !payload.bytes) {
        if (payload.error === 'CANCELLED') {
          reject(new TaskCancelledError())
        } else {
          reject(new Error(payload.error || '录音失败'))
        }
        return
      }
      resolve({
        buffer: Buffer.from(payload.bytes),
        mime: payload.mime || 'audio/webm'
      })
    }
  )
}

function hookMicPermission(): void {
  if (micPermissionHooked) return
  micPermissionHooked = true
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media' || permission === 'microphone') {
      callback(true)
      return
    }
    callback(false)
  })
}

function recorderHtmlPath(): string {
  const dir = join(app.getPath('userData'), 'voice')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const path = join(dir, 'recorder.html')
  writeFileSync(path, RECORDER_HTML, 'utf8')
  return path
}

async function ensureRecorderWindow(): Promise<BrowserWindow> {
  hookMicPermission()
  if (recorderWin && !recorderWin.isDestroyed()) return recorderWin

  return withMainDockPreservedAsync(async () => {
    recorderWin = new BrowserWindow({
      show: false,
      width: 120,
      height: 120,
      skipTaskbar: true,
      focusable: false,
      ...(process.platform === 'darwin'
        ? { type: 'panel' as const, hiddenInMissionControl: true }
        : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/recorder.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })
    markAuxWindow(recorderWin)
    await recorderWin.loadFile(recorderHtmlPath())
    return recorderWin
  })
}

export async function startMicRecording(): Promise<string> {
  ensureIpc()
  const micOk = await ensureMacMicrophoneAccess()
  if (!micOk) {
    throw new Error(t('error.microphone', { name: t('brand.name') }))
  }
  const win = await ensureRecorderWindow()
  const requestId = randomUUID()
  currentRequestId = requestId
  await win.webContents.executeJavaScript(
    `window.recorderApi.start(${JSON.stringify(requestId)})`
  )
  return requestId
}

export async function stopMicRecording(
  requestId?: string
): Promise<{ buffer: Buffer; mime: string }> {
  ensureIpc()
  const win = await ensureRecorderWindow()
  const id = requestId || currentRequestId
  if (!id) throw new Error('没有进行中的录音')

  return new Promise<{ buffer: Buffer; mime: string }>((resolve, reject) => {
    pending = { resolve, reject, requestId: id }
    void win.webContents.executeJavaScript(`window.recorderApi.stop()`).catch((err) => {
      pending = null
      reject(err instanceof Error ? err : new Error(String(err)))
    })
    setTimeout(() => {
      if (pending && pending.requestId === id) {
        pending = null
        reject(new Error('录音超时，请重试'))
      }
    }, 180000)
  })
}

/** 丢弃当前录音（Esc 取消）；若已有 pending stop，以取消拒绝 */
export function discardMicRecording(): void {
  ensureIpc()
  const id = currentRequestId
  if (pending) {
    const p = pending
    pending = null
    p.reject(new TaskCancelledError())
  }
  currentRequestId = ''
  if (recorderWin && !recorderWin.isDestroyed()) {
    void recorderWin.webContents
      .executeJavaScript(`window.recorderApi.discard && window.recorderApi.discard()`)
      .catch(() => undefined)
  } else if (id) {
    // no window — already cleared
  }
}

export function destroyRecorder(): void {
  if (recorderWin && !recorderWin.isDestroyed()) recorderWin.destroy()
  recorderWin = null
  pending = null
  currentRequestId = ''
}
