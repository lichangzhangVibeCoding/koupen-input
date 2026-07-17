import { app } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)

export type AsrProgress = {
  status: string
  progress?: number
  file?: string
}

let asrPipeline: null | ((audio: Float32Array | string, opts?: object) => Promise<{ text: string }>) =
  null
let loading: Promise<void> | null = null

function modelsDir(): string {
  const dir = join(app.getPath('userData'), 'models')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function readyMarker(): string {
  return join(modelsDir(), 'whisper-base.ready')
}

export function isLocalAsrInstalled(): boolean {
  return existsSync(readyMarker())
}

async function getFfmpegPath(): Promise<string> {
  const mod = await import('ffmpeg-static')
  const p = (mod as { default?: string }).default || (mod as unknown as string)
  if (!p || !existsSync(p)) throw new Error('未找到 ffmpeg，无法处理录音格式')
  return p
}

/** Convert webm/opus buffer to 16kHz mono wav file path */
async function toWav16k(audio: Buffer, mime: string): Promise<string> {
  const ffmpeg = await getFfmpegPath()
  const id = randomUUID()
  const inPath = join(tmpdir(), `vip-asr-in-${id}.webm`)
  const outPath = join(tmpdir(), `vip-asr-out-${id}.wav`)
  writeFileSync(inPath, audio)
  try {
    await execFileAsync(ffmpeg, [
      '-y',
      '-i',
      inPath,
      '-ar',
      '16000',
      '-ac',
      '1',
      '-f',
      'wav',
      outPath
    ])
    return outPath
  } finally {
    try {
      unlinkSync(inPath)
    } catch {
      // ignore
    }
  }
}

function wavToFloat32(wavPath: string): Float32Array {
  const buf = readFileSync(wavPath)
  // Skip WAV header (44 bytes typical); find 'data' chunk for robustness
  let offset = 44
  for (let i = 12; i < Math.min(buf.length - 8, 200); i++) {
    if (buf.toString('ascii', i, i + 4) === 'data') {
      offset = i + 8
      break
    }
  }
  const samples = Math.floor((buf.length - offset) / 2)
  const out = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const s = buf.readInt16LE(offset + i * 2)
    out[i] = s / 32768
  }
  return out
}

export async function ensureLocalAsr(
  onProgress?: (p: AsrProgress) => void
): Promise<void> {
  if (asrPipeline) return
  if (loading) return loading

  loading = (async () => {
    onProgress?.({ status: '正在准备本地语音模型…', progress: 0 })
    const { pipeline, env } = await import('@xenova/transformers')
    env.cacheDir = modelsDir()
    env.allowLocalModels = true
    env.allowRemoteModels = true

    const pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
      progress_callback: (info: { status?: string; progress?: number; file?: string }) => {
        onProgress?.({
          status: info.status || 'downloading',
          progress:
            typeof info.progress === 'number' ? Math.round(info.progress * 100) : undefined,
          file: info.file
        })
      }
    })

    asrPipeline = pipe as typeof asrPipeline
    writeFileSync(readyMarker(), new Date().toISOString(), 'utf8')
    onProgress?.({ status: '本地语音模型已就绪', progress: 100 })
  })()

  try {
    await loading
  } finally {
    loading = null
  }
}

export async function transcribeLocalBuiltin(
  audio: Buffer,
  mime: string,
  onProgress?: (p: AsrProgress) => void
): Promise<string> {
  await ensureLocalAsr(onProgress)
  if (!asrPipeline) throw new Error('本地语音模型未就绪')

  const wavPath = await toWav16k(audio, mime)
  try {
    const samples = wavToFloat32(wavPath)
    const result = await asrPipeline(samples, {
      language: 'chinese',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5
    })
    const text = (result?.text || '').trim()
    if (!text) throw new Error('本地转写结果为空')
    return text
  } finally {
    try {
      unlinkSync(wavPath)
    } catch {
      // ignore
    }
  }
}
