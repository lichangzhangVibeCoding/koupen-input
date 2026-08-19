import { app, BrowserWindow, ipcMain, session } from 'electron'
import { randomUUID } from 'crypto'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { encodeWav16kMono } from './audio-wav'
import {
  abortStreamSession,
  beginStreamSession,
  feedStreamPcm16k,
  finishStreamSession,
  peekStreamPartial,
  rescoreStreamPcm16k,
  setStreamPartialHandler
} from './local-asr-stream'
import { ensureMacMicrophoneAccess } from './permissions'
import { markAuxWindow, withMainDockPreservedAsync } from './preserve-main-dock'
import { TaskCancelledError } from './task-cancel'
import { t } from '../shared/i18n'

let recorderWin: BrowserWindow | null = null
let pending:
  | {
      resolve: (data: {
        buffer: Buffer
        mime: string
        streamedText: string
        liveText: string
      }) => void
      reject: (err: Error) => void
      requestId: string
    }
  | null = null

let ipcReady = false
let currentRequestId = ''
let micPermissionHooked = false
let streamActive = false

export function setVoicePartialTranscriptHandler(handler: ((text: string) => void) | null): void {
  setStreamPartialHandler(handler)
}

function resetPcmSession(): void {
  abortStreamSession()
  streamActive = false
}

const RECORDER_HTML = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="UTF-8" /><title>Recorder</title></head>
<body>
<script>
let mediaStream = null
let audioCtx = null
let processor = null
let sourceNode = null
let mute = null
let requestId = ''
let pcmChunks = []
let tickBuf = []
let tickTimer = null

function resampleTo16k(input, inRate) {
  if (inRate === 16000) return input
  const ratio = inRate / 16000
  const outLen = Math.max(1, Math.round(input.length / ratio))
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const x = i * ratio
    const i0 = Math.min(Math.floor(x), input.length - 1)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const f = x - i0
    out[i] = input[i0] * (1 - f) + input[i1] * f
  }
  return out
}

function floatToInt16(f32) {
  const out = new Int16Array(f32.length)
  for (let i = 0; i < f32.length; i++) {
    var s = f32[i]
    if (s > 1) s = 1
    else if (s < -1) s = -1
    out[i] = s < 0 ? (s * 0x8000) : (s * 0x7fff)
  }
  return out
}

function concatInt16(parts) {
  var total = 0
  for (var i = 0; i < parts.length; i++) total += parts[i].length
  var out = new Int16Array(total)
  var off = 0
  for (var j = 0; j < parts.length; j++) {
    out.set(parts[j], off)
    off += parts[j].length
  }
  return out
}

function flushTick() {
  if (!tickBuf.length || !window.recBridge.pcm) return
  var i16 = concatInt16(tickBuf)
  tickBuf = []
  window.recBridge.pcm({
    requestId: requestId,
    bytes: Array.from(new Uint8Array(i16.buffer, i16.byteOffset, i16.byteLength))
  })
}

function cleanupGraph() {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
  try { if (processor) processor.disconnect() } catch (e) {}
  try { if (sourceNode) sourceNode.disconnect() } catch (e) {}
  try { if (mute) mute.disconnect() } catch (e) {}
  processor = null
  sourceNode = null
  mute = null
  if (audioCtx) {
    try { audioCtx.close() } catch (e) {}
    audioCtx = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(function (t) { t.stop() })
    mediaStream = null
  }
}

async function start(id) {
  requestId = id
  pcmChunks = []
  tickBuf = []
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
      sampleRate: 16000
    }
  })
  audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') await audioCtx.resume()
  sourceNode = audioCtx.createMediaStreamSource(mediaStream)
  processor = audioCtx.createScriptProcessor(4096, 1, 1)
  mute = audioCtx.createGain()
  mute.gain.value = 0
  var inRate = audioCtx.sampleRate
  processor.onaudioprocess = function (ev) {
    var input = ev.inputBuffer.getChannelData(0)
    var resampled = resampleTo16k(input, inRate)
    var i16 = floatToInt16(resampled)
    pcmChunks.push(i16)
    tickBuf.push(i16)
  }
  sourceNode.connect(processor)
  processor.connect(mute)
  mute.connect(audioCtx.destination)
  tickTimer = setInterval(flushTick, 200)
  window.recBridge.started({ requestId: requestId })
}

function stop() {
  flushTick()
  if (!pcmChunks.length) {
    cleanupGraph()
    window.recBridge.result({ requestId: requestId, ok: false, error: '录音尚未开始' })
    return
  }
  var i16 = concatInt16(pcmChunks)
  var bytes = Array.from(new Uint8Array(i16.buffer, i16.byteOffset, i16.byteLength))
  cleanupGraph()
  pcmChunks = []
  tickBuf = []
  window.recBridge.result({
    requestId: requestId,
    ok: true,
    bytes: bytes,
    mime: 'audio/pcm'
  })
}

function discard() {
  cleanupGraph()
  pcmChunks = []
  tickBuf = []
  window.recBridge.result({ requestId: requestId, ok: false, error: 'CANCELLED' })
}

window.recorderApi = { start: start, stop: stop, discard: discard }
</script>
</body>
</html>`

function ensureIpc(): void {
  if (ipcReady) return
  ipcReady = true

  ipcMain.on('voice:recorder-started', () => {})

  ipcMain.on(
    'voice:recorder-pcm',
    (_e, payload: { requestId?: string; bytes?: number[] }) => {
      if (!currentRequestId || !payload?.bytes?.length) return
      if (payload.requestId && payload.requestId !== currentRequestId) return
      if (streamActive) feedStreamPcm16k(Buffer.from(payload.bytes))
    }
  )

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
        resetPcmSession()
        if (payload.error === 'CANCELLED') {
          reject(new TaskCancelledError())
        } else {
          reject(new Error(payload.error || '录音失败'))
        }
        return
      }
      const raw = Buffer.from(payload.bytes)
      const mime = payload.mime || 'audio/pcm'
      const wav = /wav/i.test(mime) ? raw : encodeWav16kMono(raw)
      const liveText = streamActive ? peekStreamPartial() : ''
      let streamedText = ''
      if (streamActive) {
        const closed = finishStreamSession()
        streamedText = rescoreStreamPcm16k(raw) || closed || liveText
      }
      streamActive = false
      resolve({
        buffer: wav,
        mime: 'audio/wav',
        streamedText,
        liveText
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

export async function startMicRecording(opts?: { stream?: boolean }): Promise<string> {
  ensureIpc()
  const micOk = await ensureMacMicrophoneAccess()
  if (!micOk) {
    throw new Error(t('error.microphone', { name: t('brand.name') }))
  }
  const win = await ensureRecorderWindow()
  const requestId = randomUUID()
  currentRequestId = requestId
  resetPcmSession()
  streamActive = Boolean(opts?.stream) && beginStreamSession()
  await win.webContents.executeJavaScript(
    `window.recorderApi.start(${JSON.stringify(requestId)})`
  )
  return requestId
}

export async function stopMicRecording(
  requestId?: string
): Promise<{ buffer: Buffer; mime: string; streamedText: string; liveText: string }> {
  ensureIpc()
  const win = await ensureRecorderWindow()
  const id = requestId || currentRequestId
  if (!id) throw new Error('没有进行中的录音')

  return new Promise<{ buffer: Buffer; mime: string; streamedText: string; liveText: string }>((resolve, reject) => {
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
    }, 600000)
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
  resetPcmSession()
  if (recorderWin && !recorderWin.isDestroyed()) {
    void recorderWin.webContents
      .executeJavaScript(`window.recorderApi.discard && window.recorderApi.discard()`)
      .catch(() => undefined)
  } else if (id) {
    // no window — already cleared
  }
}

export function destroyRecorder(): void {
  resetPcmSession()
  if (recorderWin && !recorderWin.isDestroyed()) recorderWin.destroy()
  recorderWin = null
  pending = null
  currentRequestId = ''
}
