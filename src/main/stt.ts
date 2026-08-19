import { AppSettings, LOCAL_DEFAULTS } from '../shared/types'
import { encodeWav16kMono, wavOrPcmDurationSeconds, wavPcm16le } from './audio-wav'
import {
  isLocalAsrInstalled,
  transcribeLocalBuiltin,
  transcribeLocalPcm16k,
  wavToCompactOpus
} from './local-asr'
import {
  formatMembershipHttpError,
  membershipAuthHeaders,
  membershipChatBase,
  intendsOfficialMembership
} from './membership'
import { throwIfCancelled } from './task-cancel'

export function isBuiltinLocalAsr(settings: AppSettings): boolean {
  return (
    settings.sttInferenceMode === 'local' &&
    (settings.localSttBaseUrl.startsWith('builtin://') ||
      settings.localSttModel === 'whisper-base' ||
      settings.localSttModel.includes('whisper'))
  )
}

export function resolveSttConfig(settings: AppSettings): {
  baseUrl: string
  apiKey: string
  model: string
  isLocal: boolean
  isBuiltin: boolean
  isMembership: boolean
} {
  if (settings.sttInferenceMode === 'local') {
    const builtin = isBuiltinLocalAsr(settings)
    if (builtin) {
      return {
        baseUrl: 'builtin://local-asr',
        apiKey: 'local',
        model: settings.localSttModel || 'whisper-base',
        isLocal: true,
        isBuiltin: true,
        isMembership: false
      }
    }
    const baseUrl = (settings.localSttBaseUrl || LOCAL_DEFAULTS.sttBase).trim()
    const apiKey = (settings.localSttApiKey || LOCAL_DEFAULTS.sttApiKey).trim()
    const model = (settings.localSttModel || LOCAL_DEFAULTS.sttModel).trim()
    if (!baseUrl) throw new Error('请先在「模型」页配置本地语音，或一键安装本地套件')
    if (!model) throw new Error('请先配置本地语音模型名')
    return { baseUrl, apiKey: apiKey || 'local', model, isLocal: true, isBuiltin: false, isMembership: false }
  }

  if (intendsOfficialMembership(settings) && settings.sttInferenceMode !== 'local') {
    const token = settings.membershipAccessToken.trim()
    if (!token) {
      throw new Error('请先注册或登录官方会员，或到「模型」页改用自配 Key / 本地')
    }
    return {
      baseUrl: membershipChatBase(settings),
      apiKey: token,
      model: settings.sttModel.trim() || 'whisper-1',
      isLocal: false,
      isBuiltin: false,
      isMembership: true
    }
  }

  const sttBase = settings.sttBaseUrl.trim()
  const sttKey = settings.sttApiKey.trim()
  const model = settings.sttModel.trim() || 'whisper-1'

  if (sttBase && sttKey) {
    return { baseUrl: sttBase, apiKey: sttKey, model, isLocal: false, isBuiltin: false, isMembership: false }
  }

  throw new Error('请先在「模型」页配置语音识别，或在「会员」页登录官方模式')
}

export function prefersLocalStreamAsr(settings: AppSettings): boolean {
  return settings.voiceAsrMode !== 'cloud'
}

/** Local Zipformer text wins; otherwise file ASR (membership / BYOK / whisper). */
export async function transcribeUtterance(
  settings: AppSettings,
  audio: Buffer,
  mime: string,
  streamedText: string,
  signal?: AbortSignal
): Promise<string> {
  const local = String(streamedText || '').trim()
  if (prefersLocalStreamAsr(settings) && local) return local
  return transcribeAudio(settings, audio, mime, signal)
}

function parseTranscriptBody(text: string): string {
  try {
    const data = JSON.parse(text) as { text?: string }
    const out = (data.text || '').trim()
    if (!out) throw new Error('没听清你说的话，请靠近麦克风再说一遍')
    return out
  } catch (e) {
    if (e instanceof Error && (e.message.includes('听清') || e.message.includes('转写'))) throw e
    const out = text.trim()
    if (!out) throw new Error('没听清你说的话，请靠近麦克风再说一遍')
    return out
  }
}

async function transcribeLocalFallback(audio: Buffer, mime: string): Promise<string> {
  if (!isLocalAsrInstalled()) throw new Error('本地语音模型尚未安装')
  if (/wav|pcm/i.test(mime)) {
    const pcm = /wav/i.test(mime) ? wavPcm16le(audio) : audio
    return transcribeLocalPcm16k(pcm)
  }
  return transcribeLocalBuiltin(audio, mime)
}

async function prepareCloudFile(
  audio: Buffer,
  mime: string,
  membership: boolean
): Promise<{ buffer: Buffer; mime: string; filename: string; durationSeconds: number }> {
  const durationSeconds = wavOrPcmDurationSeconds(audio, mime)
  let wav = audio
  let wavMime = mime
  if (!/wav/i.test(mime) && /pcm/i.test(mime)) {
    wav = encodeWav16kMono(audio)
    wavMime = 'audio/wav'
  }
  if (membership && /wav/i.test(wavMime)) {
    try {
      const compact = await wavToCompactOpus(wav)
      return { ...compact, durationSeconds }
    } catch {
      /* PHP size heuristic is wrong for WAV; still better than failing the utterance */
    }
  }
  if (/wav/i.test(wavMime)) {
    return { buffer: wav, mime: 'audio/wav', filename: 'speech.wav', durationSeconds }
  }
  const ext = mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'
  return { buffer: audio, mime: mime || 'audio/webm', filename: `speech.${ext}`, durationSeconds }
}

export async function transcribeAudio(
  settings: AppSettings,
  audio: Buffer,
  mime: string,
  signal?: AbortSignal
): Promise<string> {
  const cfg = resolveSttConfig(settings)
  throwIfCancelled(signal)

  if (cfg.isBuiltin) {
    if (!isLocalAsrInstalled()) {
      throw new Error('本地语音模型尚未安装，请到「模型」页一键安装本地套件')
    }
    return transcribeLocalBuiltin(audio, mime)
  }

  const file = await prepareCloudFile(audio, mime, cfg.isMembership)
  const url = `${cfg.baseUrl.replace(/\/+$/, '')}/audio/transcriptions`
  const form = new FormData()
  const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mime })
  form.append('file', blob, file.filename)
  form.append('model', cfg.model)
  form.append('language', 'zh')
  form.append('response_format', 'json')
  form.append('duration_seconds', String(file.durationSeconds))

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: cfg.isMembership
        ? membershipAuthHeaders(settings)
        : { Authorization: `Bearer ${cfg.apiKey}` },
      body: form,
      signal
    })
  } catch (e) {
    throwIfCancelled(signal)
    if (e instanceof Error && e.name === 'AbortError') throw e
    if (isLocalAsrInstalled()) {
      try {
        return await transcribeLocalFallback(audio, mime)
      } catch {
        /* keep network error */
      }
    }
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(cfg.isLocal ? `本地转写服务连不上（${msg}）` : `转写请求失败：${msg}`)
  }

  const text = await res.text()
  if (!res.ok) {
    const retryable = res.status >= 500 || res.status === 429 || res.status === 503 || res.status === 504
    if (retryable && isLocalAsrInstalled()) {
      try {
        return await transcribeLocalFallback(audio, mime)
      } catch {
        /* keep cloud error */
      }
    }
    if (cfg.isMembership) {
      throw new Error(formatMembershipHttpError(res.status, text))
    }
    const hint =
      res.status === 401 || res.status === 403
        ? '语音 API Key 无效或额度不足'
        : res.status === 429
          ? '语音接口太忙，请稍后再试'
          : `转写失败 (${res.status})`
    throw new Error(`${hint}：${text.slice(0, 160)}`)
  }

  return parseTranscriptBody(text)
}
