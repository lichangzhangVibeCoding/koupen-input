import { AppSettings, LOCAL_DEFAULTS } from '../shared/types'
import { isLocalAsrInstalled, transcribeLocalBuiltin } from './local-asr'
import {
  formatMembershipHttpError,
  membershipAuthHeaders,
  membershipChatBase,
  usesMembershipCloud
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

  if (usesMembershipCloud(settings)) {
    return {
      baseUrl: membershipChatBase(settings),
      apiKey: settings.membershipAccessToken.trim(),
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
      headers: cfg.isMembership
        ? membershipAuthHeaders(settings)
        : { Authorization: `Bearer ${cfg.apiKey}` },
      body: form,
      signal
    })
  } catch (e) {
    throwIfCancelled(signal)
    if (e instanceof Error && e.name === 'AbortError') throw e
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(cfg.isLocal ? `本地转写服务连不上（${msg}）` : `转写请求失败：${msg}`)
  }

  const text = await res.text()
  if (!res.ok) {
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
