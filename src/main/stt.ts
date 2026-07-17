import { AppSettings, LOCAL_DEFAULTS } from '../shared/types'
import { isLocalAsrInstalled, transcribeLocalBuiltin } from './local-asr'

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
} {
  if (settings.sttInferenceMode === 'local') {
    const builtin = isBuiltinLocalAsr(settings)
    if (builtin) {
      return {
        baseUrl: 'builtin://local-asr',
        apiKey: 'local',
        model: settings.localSttModel || 'whisper-base',
        isLocal: true,
        isBuiltin: true
      }
    }
    const baseUrl = (settings.localSttBaseUrl || LOCAL_DEFAULTS.sttBase).trim()
    const apiKey = (settings.localSttApiKey || LOCAL_DEFAULTS.sttApiKey).trim()
    const model = (settings.localSttModel || LOCAL_DEFAULTS.sttModel).trim()
    if (!baseUrl) throw new Error('请先在「模型」页配置本地语音，或一键安装本地套件')
    if (!model) throw new Error('请先配置本地语音模型名')
    return { baseUrl, apiKey: apiKey || 'local', model, isLocal: true, isBuiltin: false }
  }

  const sttBase = settings.sttBaseUrl.trim()
  const sttKey = settings.sttApiKey.trim()
  const model = settings.sttModel.trim() || 'whisper-1'

  if (sttBase && sttKey) {
    return { baseUrl: sttBase, apiKey: sttKey, model, isLocal: false, isBuiltin: false }
  }

  throw new Error('请先在「模型」页配置语音识别（硅基推荐或本地套件）')
}

export async function transcribeAudio(
  settings: AppSettings,
  audio: Buffer,
  mime: string
): Promise<string> {
  const cfg = resolveSttConfig(settings)

  if (cfg.isBuiltin) {
    if (!isLocalAsrInstalled()) {
      throw new Error('本地语音模型尚未安装，请到「模型」页一键安装本地套件')
    }
    return transcribeLocalBuiltin(audio, mime)
  }

  const url = `${cfg.baseUrl.replace(/\/+$/, '')}/audio/transcriptions`
  const ext = mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : 'webm'
  const form = new FormData()
  const blob = new Blob([new Uint8Array(audio)], { type: mime || 'audio/webm' })
  form.append('file', blob, `speech.${ext}`)
  form.append('model', cfg.model)
  form.append('language', 'zh')
  form.append('response_format', 'json')

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      body: form
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(cfg.isLocal ? `本地转写服务连不上（${msg}）` : `转写请求失败：${msg}`)
  }

  const text = await res.text()
  if (!res.ok) throw new Error(`转写失败 (${res.status}): ${text.slice(0, 240)}`)

  try {
    const data = JSON.parse(text) as { text?: string }
    const out = (data.text || '').trim()
    if (!out) throw new Error('转写结果为空')
    return out
  } catch (e) {
    if (e instanceof Error && (e.message.includes('转写') || e.message.includes('为空'))) throw e
    const out = text.trim()
    if (!out) throw new Error('转写结果为空')
    return out
  }
}
