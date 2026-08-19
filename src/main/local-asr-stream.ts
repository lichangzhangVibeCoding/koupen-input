import { app } from 'electron'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { join, delimiter } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { pcm16leToFloat32 } from './audio-wav'

const execFileAsync = promisify(execFile)

const MODEL_DIR_NAME = 'sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20'
const HF_REPO = 'csukuangfj/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20'
const LEGACY_MODEL_DIRS = ['sherpa-onnx-streaming-zipformer-zh-14M-2023-02-23']
const TAR_NAME = `${MODEL_DIR_NAME}.tar.bz2`
const TAR_URLS = [
  `https://ghfast.top/https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/${TAR_NAME}`,
  `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/${TAR_NAME}`
]

const MODEL_FILES_INT8 = [
  'encoder-epoch-99-avg-1.int8.onnx',
  'decoder-epoch-99-avg-1.onnx',
  'joiner-epoch-99-avg-1.int8.onnx',
  'tokens.txt'
]
const MODEL_FILES_FP32 = [
  'encoder-epoch-99-avg-1.onnx',
  'decoder-epoch-99-avg-1.onnx',
  'joiner-epoch-99-avg-1.onnx',
  'tokens.txt'
]

export type StreamAsrStatus = {
  installed: boolean
  downloading: boolean
  percent?: number
  error?: string
  detail: string
}

type OnlineStream = {
  acceptWaveform: (obj: { samples: Float32Array; sampleRate: number }) => void
  inputFinished: () => void
}

type OnlineRecognizer = {
  createStream: () => OnlineStream
  isReady: (stream: OnlineStream) => boolean
  decode: (stream: OnlineStream) => void
  getResult: (stream: OnlineStream) => { text?: string }
  isEndpoint: (stream: OnlineStream) => boolean
  reset: (stream: OnlineStream) => void
}

type OfflinePunctuation = {
  addPunct: (text: string) => string
}

type SherpaModule = {
  OnlineRecognizer: new (config: object) => OnlineRecognizer
  OfflinePunctuation: new (config: object) => OfflinePunctuation
}

let sherpaMod: SherpaModule | null = null
let recognizer: OnlineRecognizer | null = null
let recognizerEncoder = ''
let punct: OfflinePunctuation | null = null
let stream: OnlineStream | null = null
let lastPartial = ''
let committed = ''
let endpointCount = 0
let partialHandler: ((text: string) => void) | null = null
let downloadPromise: Promise<void> | null = null
let punctPromise: Promise<void> | null = null
let downloadPercent = 0
let lastError = ''

function modelsRoot(): string {
  const dir = join(app.getPath('userData'), 'models', 'asr-stream')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function modelDir(): string {
  return join(modelsRoot(), MODEL_DIR_NAME)
}

function readyMarker(): string {
  return join(modelsRoot(), 'asr-stream.ready')
}

function punctDir(): string {
  const dir = join(modelsRoot(), 'punct-ct-zh-en')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function findPunctModel(): string | null {
  const dir = punctDir()
  if (!existsSync(dir)) return null
  const files = readdirSync(dir)
  const int8 = files.find((f) => f.includes('int8') && f.endsWith('.onnx'))
  if (int8) return join(dir, int8)
  const onnx = files.find((f) => f.endsWith('.onnx'))
  return onnx ? join(dir, onnx) : null
}

function hfHost(): string {
  return (process.env.TALKNOW_HF_ENDPOINT || 'https://hf-mirror.com/').replace(/\/*$/, '/')
}

function nodeModulesRoot(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
  }
  return join(__dirname, '../../node_modules')
}

function platformNativeDir(): string {
  const plat = process.platform === 'win32' ? 'win' : process.platform
  return join(nodeModulesRoot(), `sherpa-onnx-${plat}-${process.arch}`)
}

function ensureNativeSearchPath(): void {
  const dir = platformNativeDir()
  if (!existsSync(dir)) return
  if (process.platform === 'darwin') {
    const cur = process.env.DYLD_LIBRARY_PATH || ''
    if (!cur.includes(dir)) process.env.DYLD_LIBRARY_PATH = cur ? `${dir}${delimiter}${cur}` : dir
  } else if (process.platform === 'linux') {
    const cur = process.env.LD_LIBRARY_PATH || ''
    if (!cur.includes(dir)) process.env.LD_LIBRARY_PATH = cur ? `${dir}${delimiter}${cur}` : dir
  } else if (process.platform === 'win32') {
    const cur = process.env.PATH || ''
    if (!cur.toLowerCase().includes(dir.toLowerCase())) {
      process.env.PATH = `${dir}${delimiter}${cur}`
    }
  }
}

function loadSherpa(): SherpaModule {
  if (sherpaMod) return sherpaMod
  ensureNativeSearchPath()
  // Native addon; keep require so electron-vite externalizes it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sherpaMod = require('sherpa-onnx-node') as SherpaModule
  return sherpaMod
}

function pickModelFile(
  files: string[],
  prefix: string,
  preferInt8: boolean
): string | undefined {
  const onnx = files.filter((f) => f.startsWith(prefix) && f.endsWith('.onnx'))
  if (!onnx.length) return undefined
  if (preferInt8) {
    return onnx.find((f) => f.includes('int8')) || onnx[0]
  }
  return onnx.find((f) => !f.includes('int8')) || onnx[0]
}

export function findStreamModelFiles(
  dir = modelDir()
): { encoder: string; decoder: string; joiner: string; tokens: string } | null {
  if (!existsSync(dir)) return null
  const files = readdirSync(dir)
  const encoder = pickModelFile(files, 'encoder', true)
  const decoder = pickModelFile(files, 'decoder', false)
  const joiner = pickModelFile(files, 'joiner', true)
  const tokens = files.find((f) => f === 'tokens.txt')
  if (!encoder || !decoder || !joiner || !tokens) return null
  return {
    encoder: join(dir, encoder),
    decoder: join(dir, decoder),
    joiner: join(dir, joiner),
    tokens: join(dir, tokens)
  }
}

export function isStreamAsrInstalled(): boolean {
  return Boolean(findStreamModelFiles())
}

function removeLegacyModels(): void {
  for (const name of LEGACY_MODEL_DIRS) {
    const dir = join(modelsRoot(), name)
    if (!existsSync(dir)) continue
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* leftover Chinese-only pack is unused */
    }
  }
}

export function getStreamAsrStatus(): StreamAsrStatus {
  if (isStreamAsrInstalled()) {
    return { installed: true, downloading: false, detail: '本机中英流式语音已就绪（免积分）' }
  }
  if (downloadPromise) {
    return {
      installed: false,
      downloading: true,
      percent: downloadPercent,
        detail: `正在下载中英语音模型… ${downloadPercent}%`
    }
  }
  if (lastError) {
    return { installed: false, downloading: false, error: lastError, detail: lastError }
  }
  return { installed: false, downloading: false, detail: '本机流式语音尚未下载' }
}

async function downloadToFile(url: string, dest: string, onChunk?: (n: number, total: number) => void): Promise<void> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`下载失败 (${res.status}) ${url}`)
  const total = Number(res.headers.get('content-length') || 0)
  let received = 0
  const file = createWriteStream(dest)
  const nodeStream = Readable.fromWeb(res.body as import('stream/web').ReadableStream)
  nodeStream.on('data', (chunk: Buffer) => {
    received += chunk.length
    onChunk?.(received, total)
  })
  await pipeline(nodeStream, file)
}

async function downloadFromHf(): Promise<void> {
  const dest = modelDir()
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
  const host = hfHost()
  const tryLists = [MODEL_FILES_INT8, MODEL_FILES_FP32]
  let lastFail = ''
  for (const list of tryLists) {
    try {
      let done = 0
      for (const name of list) {
        const url = `${host}${HF_REPO}/resolve/main/${name}`
        const destFile = join(dest, name)
        await downloadToFile(url, destFile, (n, total) => {
          const fileFrac = total > 0 ? n / total : 1
          downloadPercent = Math.min(99, Math.round(((done + fileFrac) / list.length) * 100))
        })
        done += 1
        downloadPercent = Math.round((done / list.length) * 100)
      }
      if (findStreamModelFiles(dest)) return
    } catch (e) {
      lastFail = e instanceof Error ? e.message : String(e)
    }
  }
  throw new Error(lastFail || '镜像下载失败')
}

async function downloadFromGithubTar(): Promise<void> {
  const destRoot = modelsRoot()
  const archive = join(destRoot, TAR_NAME)
  let lastFail = ''
  for (const url of TAR_URLS) {
    try {
      await downloadToFile(url, archive, (n, total) => {
        downloadPercent = total > 0 ? Math.min(90, Math.round((n / total) * 90)) : downloadPercent
      })
      lastFail = ''
      break
    } catch (e) {
      lastFail = e instanceof Error ? e.message : String(e)
    }
  }
  if (lastFail) throw new Error(lastFail)
  const dest = modelDir()
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
  try {
    await execFileAsync('tar', ['-xjf', archive, '-C', destRoot], { timeout: 120000 })
  } catch {
    await execFileAsync('tar', ['-xf', archive, '-C', destRoot], { timeout: 120000 })
  }
  try {
    unlinkSync(archive)
  } catch {
    /* ignore */
  }
  if (!findStreamModelFiles(dest)) {
    throw new Error('解压后未找到 Zipformer 模型文件')
  }
}

async function downloadPunct(): Promise<void> {
  const dest = join(punctDir(), 'model.int8.onnx')
  const urls = [
    `${hfHost()}ranger810/sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12-int8/resolve/main/model.int8.onnx`,
    `${hfHost()}csukuangfj/sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12/resolve/main/model.onnx`
  ]
  let lastFail = ''
  for (const url of urls) {
    try {
      await downloadToFile(url, dest, (n, total) => {
        downloadPercent = total > 0 ? Math.min(99, Math.round((n / total) * 99)) : downloadPercent
      })
      if (existsSync(dest)) return
    } catch (e) {
      lastFail = e instanceof Error ? e.message : String(e)
    }
  }
  throw new Error(lastFail || '标点模型下载失败')
}

async function ensurePunct(): Promise<void> {
  if (findPunctModel()) {
    createPunct()
    return
  }
  if (punctPromise) {
    await punctPromise
    return
  }
  punctPromise = (async () => {
    try {
      await downloadPunct()
      createPunct()
    } catch {
      /* ASR still works without punctuation */
    } finally {
      punctPromise = null
    }
  })()
  await punctPromise
}

export async function ensureStreamAsr(
  onProgress?: (p: { percent: number; message: string }) => void
): Promise<void> {
  if (isStreamAsrInstalled()) {
    createRecognizer()
    void ensurePunct()
    return
  }
  if (downloadPromise) {
    await downloadPromise
    createRecognizer()
    void ensurePunct()
    return
  }
  lastError = ''
  downloadPercent = 0
  downloadPromise = (async () => {
    onProgress?.({ percent: 0, message: '正在下载中英流式语音模型…' })
    try {
      try {
        await downloadFromHf()
      } catch {
        await downloadFromGithubTar()
      }
      if (!findStreamModelFiles()) throw new Error('模型文件不完整')
      removeLegacyModels()
      writeFileSync(readyMarker(), MODEL_DIR_NAME, 'utf8')
      downloadPercent = 100
      onProgress?.({ percent: 100, message: '本机中英流式语音已就绪' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      lastError =
        /ENOTFOUND|ECONNRESET|fetch failed|下载失败/i.test(msg)
          ? `下载本机语音模型失败（${msg.slice(0, 80)}）。本次改走云端转写。`
          : msg
      throw new Error(lastError)
    } finally {
      downloadPromise = null
    }
  })()
  await downloadPromise
  createRecognizer()
  onProgress?.({ percent: 0, message: '正在下载标点模型…' })
  await ensurePunct()
  onProgress?.({ percent: 100, message: '本机中英流式语音已就绪' })
}

function createRecognizer(): void {
  const files = findStreamModelFiles()
  if (!files) throw new Error('本机流式语音模型未就绪')
  if (recognizer && recognizerEncoder === files.encoder) return
  const sherpa = loadSherpa()
  recognizer = new sherpa.OnlineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      transducer: {
        encoder: files.encoder,
        decoder: files.decoder,
        joiner: files.joiner
      },
      tokens: files.tokens,
      numThreads: 2,
      provider: 'cpu',
      modelType: 'zipformer',
      debug: 0
    },
    decodingMethod: 'modified_beam_search',
    maxActivePaths: 4,
    enableEndpoint: 1,
    rule1MinTrailingSilence: 2.4,
    rule2MinTrailingSilence: 1.0,
    rule3MinUtteranceLength: 15
  })
  recognizerEncoder = files.encoder
  createPunct()
}

function createPunct(): void {
  if (punct) return
  const model = findPunctModel()
  if (!model) return
  try {
    const sherpa = loadSherpa()
    punct = new sherpa.OfflinePunctuation({
      model: { ctTransformer: model, numThreads: 1, provider: 'cpu', debug: 0 }
    })
  } catch {
    punct = null
  }
}

function joinSeg(a: string, b: string): string {
  const x = a.trim()
  const y = b.trim()
  if (!x) return y
  if (!y) return x
  if (/[。！？，、；：,.!?;:]$/.test(x)) {
    return /[A-Za-z0-9]/.test(y[0] || '') ? `${x} ${y}` : `${x}${y}`
  }
  const gap = /[A-Za-z0-9]$/.test(x) && /[A-Za-z0-9]/.test(y[0] || '') ? ' ' : ''
  return `${x}${gap}${y}`
}

function punctuate(text: string): string {
  const t = text.trim()
  if (!t) return ''
  if (!punct || t.length < 2) return t
  try {
    return normalizeStreamAsrText(String(punct.addPunct(t) || t).trim())
  } catch {
    return t
  }
}

export function setStreamPartialHandler(handler: ((text: string) => void) | null): void {
  partialHandler = handler
}

/**
 * Bilingual Zipformer BPE is LibriSpeech-style: English tokens are ALL CAPS.
 * Lowercase Latin runs so mixed 中英 dictation doesn't shout.
 */
export function normalizeStreamAsrText(text: string): string {
  return text.replace(/[A-Z]+(?:'[A-Z]+)*/g, (w) => w.toLowerCase())
}

function emitPartial(): void {
  if (!recognizer || !stream) return
  while (recognizer.isReady(stream)) recognizer.decode(stream)
  if (recognizer.isEndpoint(stream)) {
    const seg = normalizeStreamAsrText(String(recognizer.getResult(stream)?.text || '').trim())
    if (seg) {
      committed = joinSeg(committed, punctuate(seg))
      endpointCount += 1
    }
    try {
      recognizer.reset(stream)
    } catch {
      /* keep going */
    }
    lastPartial = committed
    if (committed) partialHandler?.(committed)
    return
  }
  const cur = normalizeStreamAsrText(String(recognizer.getResult(stream)?.text || '').trim())
  const shown = joinSeg(committed, cur)
  if (shown && shown !== lastPartial) {
    lastPartial = shown
    partialHandler?.(shown)
  }
}

export function beginStreamSession(): boolean {
  try {
    if (!isStreamAsrInstalled()) return false
    createRecognizer()
    if (!recognizer) return false
    stream = recognizer.createStream()
    lastPartial = ''
    committed = ''
    endpointCount = 0
    return true
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e)
    stream = null
    return false
  }
}

export function feedStreamPcm16k(pcm16le: Buffer): void {
  if (!stream || !pcm16le.length) return
  const samples = pcm16leToFloat32(pcm16le)
  const step = 3200 // 200ms at 16kHz
  if (samples.length <= step) {
    stream.acceptWaveform({ samples, sampleRate: 16000 })
    emitPartial()
    return
  }
  for (let i = 0; i < samples.length; i += step) {
    stream.acceptWaveform({
      samples: samples.subarray(i, Math.min(i + step, samples.length)),
      sampleRate: 16000
    })
    emitPartial()
  }
}

export function peekStreamPartial(): string {
  return lastPartial
}

export function finishStreamSession(): string {
  if (!recognizer || !stream) {
    const text = lastPartial || committed
    stream = null
    lastPartial = ''
    committed = ''
    return text
  }
  try {
    const tail = new Float32Array(16000 * 0.4)
    stream.acceptWaveform({ samples: tail, sampleRate: 16000 })
    stream.inputFinished()
    while (recognizer.isReady(stream)) recognizer.decode(stream)
    const tailSeg = normalizeStreamAsrText(String(recognizer.getResult(stream)?.text || '').trim())
    committed = joinSeg(committed, punctuate(tailSeg))
  } catch {
    committed = lastPartial || committed
  }
  const text = committed
  stream = null
  lastPartial = ''
  committed = ''
  return text
}

/** Second pass on the full utterance (WeChat-style: live draft, then snap to a better final). */
export function rescoreStreamPcm16k(pcm16le: Buffer): string {
  if (!pcm16le.length || !isStreamAsrInstalled()) return ''
  if (endpointCount > 0) return ''
  try {
    createRecognizer()
    if (!recognizer) return ''
    const s = recognizer.createStream()
    const samples = pcm16leToFloat32(pcm16le)
    const step = 3200
    for (let i = 0; i < samples.length; i += step) {
      s.acceptWaveform({
        samples: samples.subarray(i, Math.min(i + step, samples.length)),
        sampleRate: 16000
      })
      while (recognizer.isReady(s)) recognizer.decode(s)
    }
    const tail = new Float32Array(16000 * 0.4)
    s.acceptWaveform({ samples: tail, sampleRate: 16000 })
    s.inputFinished()
    while (recognizer.isReady(s)) recognizer.decode(s)
    return punctuate(normalizeStreamAsrText(String(recognizer.getResult(s)?.text || '').trim()))
  } catch {
    return ''
  }
}

export function abortStreamSession(): void {
  stream = null
  lastPartial = ''
  committed = ''
  endpointCount = 0
}

export function warmupStreamAsr(): void {
  if (!isStreamAsrInstalled()) {
    void ensureStreamAsr().catch(() => undefined)
    return
  }
  try {
    createRecognizer()
    void ensurePunct()
  } catch {
    /* first utterance will surface */
  }
}
