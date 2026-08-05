import { execFile, spawn, type ChildProcess } from 'child_process'
import { createHash } from 'crypto'
import { existsSync, unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { getLocale } from '../shared/i18n'
import type { AppSettings } from '../shared/types'
import { notifyActivityChanged } from './activity-notify'
import { getSettings } from './user-config'

const COSY_MODEL = 'FunAudioLLM/CosyVoice2-0.5B'
/** 女声，中文自然 */
const COSY_VOICE = 'FunAudioLLM/CosyVoice2-0.5B:anna'
const COSY_PCM_RATE = 24_000
/** 短句走缓存 / 预取；长答仍边收边播 */
const COSY_CACHE_MAX_CHARS = 120

let speaking: ChildProcess | null = null
let speakingTempFile: string | null = null
let cosyWarmed = false

/** 短句 mp3 内存缓存（二次播报近乎瞬时） */
const cosyMp3Cache = new Map<string, Buffer>()
/** 进行中的合成，供截屏并行预取复用 */
const cosyMp3Inflight = new Map<string, Promise<Buffer | null>>()

/** 首次成功后的音色缓存，避免每次试错 */
let cachedDarwinVoice: string | null = null

function findFfplay(): string | null {
  for (const p of ['/opt/homebrew/bin/ffplay', '/usr/local/bin/ffplay']) {
    if (existsSync(p)) return p
  }
  return null
}

function cosyCacheKey(text: string): string {
  return createHash('sha1').update(`${COSY_VOICE}\n${text}`).digest('hex')
}

function cleanupTemp(): void {
  if (!speakingTempFile) return
  try {
    unlinkSync(speakingTempFile)
  } catch {
    /* ignore */
  }
  speakingTempFile = null
}

function killSpeakingProcess(): boolean {
  const was = Boolean(speaking && !speaking.killed)
  if (speaking && !speaking.killed) {
    try {
      speaking.kill('SIGTERM')
    } catch {
      // ignore
    }
  }
  speaking = null
  return was
}

/** 打断当前播报 */
export function stopSpeaking(): void {
  const was = killSpeakingProcess()
  cleanupTemp()
  if (was) notifyActivityChanged()
}

/** 是否正在系统朗读（答案 TTS 等） */
export function isSpeaking(): boolean {
  return Boolean(speaking && !speaking.killed)
}

function runExec(bin: string, args: string[], keepTempFile?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    killSpeakingProcess()
    // 若即将播放 keepTempFile，勿删；否则清掉上一段 Cosy 临时文件
    if (speakingTempFile && speakingTempFile !== keepTempFile) {
      cleanupTemp()
    }
    if (keepTempFile) speakingTempFile = keepTempFile

    const child = execFile(bin, args, { timeout: 90_000 }, (err) => {
      if (speaking === child) {
        speaking = null
        if (keepTempFile) cleanupTemp()
        notifyActivityChanged()
      }
      if (err && (err as NodeJS.ErrnoException).killed) {
        resolve()
        return
      }
      if (err) reject(err)
      else resolve()
    })
    speaking = child
    notifyActivityChanged()
  })
}

/** 去掉 Markdown / 链接等，让 TTS 念起来顺 */
function prepareForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[*_~#>|]+/g, ' ')
    .replace(/[（(【\[]/g, '，')
    .replace(/[）)\]】]/g, '，')
    .replace(/[;；]+/g, '，')
    .replace(/[!]{2,}/g, '！')
    .replace(/[?]{2,}/g, '？')
    .replace(/\s+/g, ' ')
    .replace(/\s*([，。！？、,.!?])\s*/g, '$1')
    .trim()
}

function resolveCosyAuth(settings: AppSettings): { baseUrl: string; apiKey: string } | null {
  const key = (settings.apiKey || settings.sttApiKey || '').trim()
  if (!key) return null

  const candidates = [settings.baseUrl, settings.sttBaseUrl, 'https://api.siliconflow.cn/v1']
  const base =
    candidates.find((u) => /siliconflow/i.test(u || '')) || 'https://api.siliconflow.cn/v1'
  return { baseUrl: base.replace(/\/+$/, ''), apiKey: key }
}

async function playAudioFile(filePath: string): Promise<void> {
  if (process.platform === 'darwin') {
    await runExec('/usr/bin/afplay', [filePath], filePath)
    return
  }
  if (process.platform === 'win32') {
    const ps = `
Add-Type -AssemblyName presentationCore;
$p = New-Object System.Windows.Media.MediaPlayer;
$p.Open([Uri]'${filePath.replace(/'/g, "''")}');
$p.Play();
Start-Sleep -Milliseconds 300;
while ($p.NaturalDuration.HasTimeSpan -and $p.Position -lt $p.NaturalDuration.TimeSpan) {
  Start-Sleep -Milliseconds 120
}
`.trim()
    await runExec('powershell', ['-NoProfile', '-Command', ps], filePath)
    return
  }
  throw new Error('unsupported platform for audio playback')
}

function isPipeClosedError(err: unknown): boolean {
  const e = err as NodeJS.ErrnoException | undefined
  return e?.code === 'EPIPE' || e?.code === 'ERR_STREAM_DESTROYED' || e?.code === 'ERR_STREAM_WRITE_AFTER_END'
}

type CosyStreamFormat = 'mp3' | 'pcm'

function ffplayArgs(format: CosyStreamFormat): string[] {
  if (format === 'pcm') {
    return [
      '-nodisp',
      '-autoexit',
      '-loglevel',
      'quiet',
      '-f',
      's16le',
      '-ar',
      String(COSY_PCM_RATE),
      '-ch_layout',
      'mono',
      '-i',
      'pipe:0'
    ]
  }
  return ['-nodisp', '-autoexit', '-loglevel', 'quiet', '-i', 'pipe:0']
}

/** 流式：API 边出音频边喂给 ffplay；可选 tee 进短句缓存 */
async function playCosyStreamFfplay(
  ffplayBin: string,
  body: ReadableStream<Uint8Array>,
  format: CosyStreamFormat,
  tee?: { key: string; as: 'mp3' }
): Promise<boolean> {
  killSpeakingProcess()
  cleanupTemp()

  return new Promise((resolve) => {
    const child = spawn(ffplayBin, ffplayArgs(format), { stdio: ['pipe', 'ignore', 'ignore'] })
    speaking = child
    notifyActivityChanged()

    let settled = false
    let pipeClosed = false
    const teeChunks: Buffer[] = []
    const t0 = Date.now()
    let loggedFirst = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      if (speaking === child) {
        speaking = null
        notifyActivityChanged()
      }
      if (ok && tee?.as === 'mp3' && teeChunks.length > 0) {
        const buf = Buffer.concat(teeChunks)
        if (buf.length >= 64) cosyMp3Cache.set(tee.key, buf)
      }
      resolve(ok)
    }

    // 打断：Esc/进程退出后继续 write 会抛未捕获 EPIPE，弹主进程错误框
    child.stdin?.on('error', (err) => {
      if (isPipeClosedError(err)) {
        pipeClosed = true
        return
      }
      console.warn('[speak] ffplay stdin error', err)
    })
    child.on('error', () => {
      pipeClosed = true
      finish(false)
    })
    child.on('close', (code) => {
      pipeClosed = true
      finish(code === 0 || code === null)
    })

    void (async () => {
      try {
        const reader = body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (!loggedFirst) {
            loggedFirst = true
            console.log(`[speak] cosy stream-${format} first_byte=${Date.now() - t0}ms`)
          }
          const chunk = Buffer.from(value)
          if (tee?.as === 'mp3') teeChunks.push(chunk)
          if (pipeClosed || child.killed || !child.stdin || child.stdin.destroyed) break
          try {
            const ok = child.stdin.write(chunk)
            if (!ok && !pipeClosed && child.stdin && !child.stdin.destroyed) {
              await new Promise<void>((r) => {
                const stdin = child.stdin
                if (!stdin || stdin.destroyed) {
                  r()
                  return
                }
                const onDrain = () => {
                  stdin.off('error', onErr)
                  r()
                }
                const onErr = () => {
                  stdin.off('drain', onDrain)
                  r()
                }
                stdin.once('drain', onDrain)
                stdin.once('error', onErr)
              })
            }
          } catch (err) {
            if (isPipeClosedError(err)) {
              pipeClosed = true
              break
            }
            throw err
          }
        }
        if (!pipeClosed && child.stdin && !child.stdin.destroyed) {
          try {
            child.stdin.end()
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        if (!isPipeClosedError(err)) {
          console.warn('[speak] CosyVoice stream write failed', err)
        }
        try {
          child.kill('SIGTERM')
        } catch {
          /* ignore */
        }
        finish(false)
      }
    })()
  })
}

async function readBodyToBuffer(body: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = []
  const reader = body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}

async function playCachedMp3(buf: Buffer): Promise<boolean> {
  const filePath = join(tmpdir(), `typenow-cosy-cache-${Date.now()}.mp3`)
  writeFileSync(filePath, buf)
  try {
    console.log(`[speak] cosy cache-hit bytes=${buf.length}`)
    await playAudioFile(filePath)
    return true
  } catch (err) {
    cleanupTemp()
    console.warn('[speak] CosyVoice cache play failed', err)
    return false
  }
}

async function fetchCosySpeech(
  text: string,
  settings: AppSettings,
  opts: { format: CosyStreamFormat; stream: boolean }
): Promise<Response | null> {
  const auth = resolveCosyAuth(settings)
  if (!auth) return null

  const body: Record<string, unknown> = {
    model: COSY_MODEL,
    input: text,
    voice: COSY_VOICE,
    response_format: opts.format,
    stream: opts.stream,
    speed: 1.15
  }
  if (opts.format === 'pcm') body.sample_rate = COSY_PCM_RATE

  const res = await fetch(`${auth.baseUrl}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok || !res.body) {
    const errBody = await res.text().catch(() => '')
    console.warn('[speak] CosyVoice failed', res.status, errBody.slice(0, 200))
    return null
  }
  return res
}

/** 拉取短句 mp3 并写入缓存（可与截屏并行） */
async function ensureCosyMp3(text: string, settings: AppSettings): Promise<Buffer | null> {
  const key = cosyCacheKey(text)
  const hit = cosyMp3Cache.get(key)
  if (hit) return hit

  const pending = cosyMp3Inflight.get(key)
  if (pending) return pending

  const job = (async (): Promise<Buffer | null> => {
    try {
      const res = await fetchCosySpeech(text, settings, { format: 'mp3', stream: true })
      if (!res?.body) return null
      const buf = await readBodyToBuffer(res.body)
      if (buf.length < 64) return null
      cosyMp3Cache.set(key, buf)
      console.log(`[speak] cosy cached key=${key.slice(0, 8)} bytes=${buf.length}`)
      return buf
    } catch (err) {
      console.warn('[speak] CosyVoice prefetch failed', err)
      return null
    } finally {
      cosyMp3Inflight.delete(key)
    }
  })()

  cosyMp3Inflight.set(key, job)
  return job
}

/**
 * 预取短句语音（不播）。看屏幕可在截屏时并行调用，截完即可播缓存。
 */
export function prefetchSpeakText(text: string, opts?: { maxLen?: number }): void {
  const maxLen = opts?.maxLen ?? 400
  const clean = prepareForSpeech(text).slice(0, maxLen)
  if (!clean || clean.length > COSY_CACHE_MAX_CHARS) return
  const settings = getSettings()
  if (!resolveCosyAuth(settings)) return
  void ensureCosyMp3(clean, settings)
}

/** 硅基 CosyVoice2：短句优先缓存，长句 PCM 流式 */
async function speakCosyVoice(text: string, settings: AppSettings): Promise<boolean> {
  const key = cosyCacheKey(text)

  if (text.length <= COSY_CACHE_MAX_CHARS) {
    const cached = cosyMp3Cache.get(key)
    if (cached) return playCachedMp3(cached)

    // 已在预取：等齐后本地播（截屏重叠时常已就绪）
    if (cosyMp3Inflight.has(key)) {
      const buf = await ensureCosyMp3(text, settings)
      if (buf) return playCachedMp3(buf)
    }
  }

  const ffplay = findFfplay()
  // 长答用 PCM 降解码等待；短句用 mp3 流式并 tee 进缓存，二次可本地秒播
  const format: CosyStreamFormat =
    ffplay && text.length > COSY_CACHE_MAX_CHARS ? 'pcm' : 'mp3'
  const res = await fetchCosySpeech(text, settings, { format, stream: true })
  if (!res?.body) return false

  if (ffplay) {
    const tee =
      format === 'mp3' && text.length <= COSY_CACHE_MAX_CHARS
        ? { key, as: 'mp3' as const }
        : undefined
    return playCosyStreamFfplay(ffplay, res.body, format, tee)
  }

  const buf = await readBodyToBuffer(res.body)
  if (buf.length < 64) return false
  if (text.length <= COSY_CACHE_MAX_CHARS) cosyMp3Cache.set(key, buf)
  const filePath = join(tmpdir(), `typenow-cosy-${Date.now()}.mp3`)
  writeFileSync(filePath, buf)
  try {
    await playAudioFile(filePath)
    return true
  } catch (err) {
    cleanupTemp()
    console.warn('[speak] CosyVoice play failed', err)
    return false
  }
}

/** 启动后预热 + 预缓存看屏幕固定提示语 */
export function warmupCosyVoice(): void {
  if (cosyWarmed) return
  const settings = getSettings()
  const auth = resolveCosyAuth(settings)
  if (!auth) return
  cosyWarmed = true

  const phrases = [
    '嗯',
    '我看到屏幕了，你想让我做什么？',
    'I can see your screen. What should I do?'
  ]
  void (async () => {
    try {
      for (const phrase of phrases) {
        await ensureCosyMp3(phrase, settings)
      }
    } catch {
      cosyWarmed = false
    }
  })()
}

type DarwinVoice = { name: string; lang: string }

function listDarwinVoices(): Promise<DarwinVoice[]> {
  return new Promise((resolve) => {
    execFile('say', ['-v', '?'], { timeout: 10_000, maxBuffer: 2_000_000 }, (err, stdout) => {
      if (err || !stdout) {
        resolve([])
        return
      }
      const out: DarwinVoice[] = []
      for (const line of stdout.split('\n')) {
        const m = line.match(/^(.+?)\s+([a-z]{2}_[A-Z]{2})\s+#/)
        if (!m) continue
        out.push({ name: m[1].trim(), lang: m[2] })
      }
      resolve(out)
    })
  })
}

async function pickDarwinZhVoice(): Promise<string | null> {
  const voices = await listDarwinVoices()
  const zhCn = voices.filter((v) => v.lang === 'zh_CN')
  const zhAny = zhCn.length > 0 ? zhCn : voices.filter((v) => v.lang.startsWith('zh'))
  if (zhAny.length === 0) return null

  const prefer = ['Tingting', 'Ting-Ting', 'Meijia', 'Sandy', 'Flo', 'Shelley', 'Eddy']
  for (const base of prefer) {
    const hit = zhAny.find(
      (v) =>
        v.name === base ||
        v.name.startsWith(`${base} `) ||
        v.name.startsWith(`${base}(`) ||
        v.name.startsWith(`${base}（`)
    )
    if (hit) return hit.name
  }
  return zhAny[0]?.name ?? null
}

async function speakDarwin(text: string, locale: string): Promise<void> {
  const hasHan = /[\u4e00-\u9fff]/.test(text)
  const zh = hasHan || locale.startsWith('zh')
  const rate = zh ? '168' : '175'

  const tryVoice = async (voice: string | null): Promise<boolean> => {
    try {
      const args = voice ? ['-v', voice, '-r', rate, text] : ['-r', rate, text]
      await runExec('say', args)
      return true
    } catch {
      return false
    }
  }

  if (!zh) {
    for (const voice of ['Samantha', 'Karen', 'Daniel', 'Moira', 'Fred']) {
      if (await tryVoice(voice)) {
        cachedDarwinVoice = voice
        return
      }
    }
    await tryVoice(null)
    return
  }

  if (
    cachedDarwinVoice &&
    (!/Tingting|Ting-Ting|Meijia|中文/i.test(cachedDarwinVoice) ||
      /Shelley|Sandy|Flo|Eddy|Rocko|Reed|Grandma|Grandpa/i.test(cachedDarwinVoice))
  ) {
    cachedDarwinVoice = null
  }

  if (cachedDarwinVoice) {
    if (await tryVoice(cachedDarwinVoice)) return
    cachedDarwinVoice = null
  }

  for (const voice of ['Tingting', 'Ting-Ting']) {
    if (await tryVoice(voice)) {
      cachedDarwinVoice = voice
      return
    }
  }

  const picked = await pickDarwinZhVoice()
  if (picked && (await tryVoice(picked))) {
    cachedDarwinVoice = picked
    return
  }

  await tryVoice(null)
}

async function speakWindows(text: string, locale: string): Promise<void> {
  const zh = locale.startsWith('zh')
  const culturePref = zh ? 'zh' : 'en'
  const ps = `
Add-Type -AssemblyName System.Speech;
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;
$s.Rate = -1;
$s.Volume = 100;
$pref = '${culturePref}';
$pick = $null;
foreach ($v in $s.GetInstalledVoices()) {
  $c = $v.VoiceInfo.Culture.Name;
  if ($c -like ($pref + '*')) { $pick = $v.VoiceInfo.Name; break; }
}
if ($pick) { $s.SelectVoice($pick); }
$s.Speak([Console]::In.ReadToEnd());
`.trim()

  await new Promise<void>((resolve, reject) => {
    stopSpeaking()
    const child = execFile(
      'powershell',
      ['-NoProfile', '-Command', ps],
      { timeout: 90_000 },
      (err) => {
        if (speaking === child) {
          speaking = null
          notifyActivityChanged()
        }
        if (err && (err as NodeJS.ErrnoException).killed) resolve()
        else if (err) reject(err)
        else resolve()
      }
    )
    speaking = child
    notifyActivityChanged()
    child.stdin?.write(text, 'utf8')
    child.stdin?.end()
  })
}

async function speakSystem(text: string, locale: string): Promise<void> {
  if (process.platform === 'darwin') {
    await speakDarwin(text, locale)
  } else if (process.platform === 'win32') {
    await speakWindows(text, locale)
  }
}

/**
 * 播报：一律优先硅基 CosyVoice2 流式（拟人）；仅失败时回退系统 TTS。
 */
export async function speakText(text: string, opts?: { maxLen?: number }): Promise<void> {
  const maxLen = opts?.maxLen ?? 400
  const clean = prepareForSpeech(text).slice(0, maxLen)
  if (!clean) return

  const locale = getLocale()
  const settings = getSettings()

  try {
    const ok = await speakCosyVoice(clean, settings)
    if (ok) return
    console.warn('[speak] CosyVoice unavailable, fallback to system TTS')
    await speakSystem(clean, locale)
  } catch (err) {
    console.warn('[speak] failed', err)
    try {
      await speakSystem(clean, locale)
    } catch (err2) {
      console.warn('[speak] system fallback failed', err2)
    }
  }
}
