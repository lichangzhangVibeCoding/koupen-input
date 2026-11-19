import { AppSettings, LOCAL_DEFAULTS } from './types'

export type SlotId = 'asr' | 'vision' | 'chat'

export type ProviderId = 'siliconflow' | 'openai' | 'local' | 'custom'

export interface SlotBinding {
  providerId: ProviderId
  modelName: string
}

export interface SlotStatus {
  id: SlotId
  label: string
  hint: string
  providerId: ProviderId
  modelName: string
  ready: boolean
  detail: string
}

export const SLOT_META: Record<
  SlotId,
  { label: string; hint: string }
> = {
  asr: {
    label: '语音识别',
    hint: '即刻对话：默认云端语音；官方会员 / 自配 Key 可在语音卡打开「本机语音」'
  },
  vision: {
    label: '视觉理解',
    hint: '帮我对话看聊天窗；看屏幕答题时负责读题'
  },
  chat: {
    label: '回复生成',
    hint: '帮我对话写回复；看屏幕答题时对照知识库作答'
  }
}

/** 硅基快捷推荐：与当前常用三槽一致，一点即同步到下方配置 */
export const SILICONFLOW_RECOMMEND = {
  baseUrl: 'https://api.siliconflow.cn/v1',
  asr: 'FunAudioLLM/SenseVoiceSmall',
  /** 看屏幕答题读题：32B VL 比 8B / 代码向模型更稳 */
  vision: 'Qwen/Qwen3-VL-32B-Instruct',
  chat: 'deepseek-ai/DeepSeek-V4-Flash'
} as const

export const LOCAL_RECOMMEND = {
  asr: 'whisper-base',
  vision: LOCAL_DEFAULTS.visionModel,
  chat: LOCAL_DEFAULTS.textModel
} as const

/** Derive slot bindings from flat settings (compatible with existing fields). */
export function getSlotBindings(settings: AppSettings): Record<SlotId, SlotBinding> {
  const asrProvider: ProviderId =
    settings.sttInferenceMode === 'local'
      ? 'local'
      : settings.sttBaseUrl.includes('siliconflow')
        ? 'siliconflow'
        : settings.sttBaseUrl.includes('openai.com')
          ? 'openai'
          : 'custom'

  const chatProvider: ProviderId =
    settings.inferenceMode === 'local'
      ? 'local'
      : settings.baseUrl.includes('siliconflow')
        ? 'siliconflow'
        : settings.baseUrl.includes('openai.com')
          ? 'openai'
          : settings.provider === 'custom'
            ? 'custom'
            : (settings.provider as ProviderId) || 'custom'

  return {
    asr: {
      providerId: asrProvider,
      modelName:
        settings.sttInferenceMode === 'local'
          ? settings.localSttModel || LOCAL_RECOMMEND.asr
          : settings.sttModel || SILICONFLOW_RECOMMEND.asr
    },
    vision: {
      providerId: chatProvider,
      modelName:
        settings.inferenceMode === 'local'
          ? settings.localVisionModelName || LOCAL_RECOMMEND.vision
          : settings.visionModelName
    },
    chat: {
      providerId: chatProvider,
      modelName:
        settings.inferenceMode === 'local'
          ? settings.localModelName || LOCAL_RECOMMEND.chat
          : settings.modelName
    }
  }
}

export function applySiliconflowRecommend(
  settings: AppSettings,
  apiKey: string
): AppSettings {
  return {
    ...settings,
    inferenceMode: 'cloud',
    provider: 'siliconflow',
    baseUrl: SILICONFLOW_RECOMMEND.baseUrl,
    apiKey: apiKey.trim() || settings.apiKey,
    modelName: SILICONFLOW_RECOMMEND.chat,
    visionModelName: SILICONFLOW_RECOMMEND.vision,
    sttInferenceMode: 'cloud',
    sttBaseUrl: SILICONFLOW_RECOMMEND.baseUrl,
    sttApiKey: apiKey.trim() || settings.sttApiKey || settings.apiKey,
    sttModel: SILICONFLOW_RECOMMEND.asr
  }
}

/** 官方会员：把服务端三槽模型同步到本地配置（免 Key，仅模型名供展示/请求） */
export function applyOfficialModelRoutes(
  settings: AppSettings,
  routes?: { asr?: string; vision?: string; chat?: string } | null
): AppSettings {
  const asr = String(routes?.asr || '').trim()
  const vision = String(routes?.vision || '').trim()
  const chat = String(routes?.chat || '').trim()
  return {
    ...settings,
    modelRoutingMode: 'membership',
    inferenceMode: 'cloud',
    sttInferenceMode: 'cloud',
    // 展示与兼容字段：走会员代理时 Key 由服务端持有，本地不必填
    provider: 'siliconflow',
    baseUrl: SILICONFLOW_RECOMMEND.baseUrl,
    sttBaseUrl: SILICONFLOW_RECOMMEND.baseUrl,
    ...(chat ? { modelName: chat } : {}),
    ...(vision ? { visionModelName: vision } : {}),
    ...(asr ? { sttModel: asr } : {})
  }
}

export function applyLocalSuiteRecommend(settings: AppSettings): AppSettings {
  return {
    ...settings,
    inferenceMode: 'local',
    provider: 'local',
    baseUrl: LOCAL_DEFAULTS.openaiBase,
    apiKey: LOCAL_DEFAULTS.apiKeyPlaceholder,
    modelName: LOCAL_RECOMMEND.chat,
    visionModelName: LOCAL_RECOMMEND.vision,
    localModelName: LOCAL_RECOMMEND.chat,
    localVisionModelName: LOCAL_RECOMMEND.vision,
    sttInferenceMode: 'local',
    localSttBaseUrl: 'builtin://local-asr',
    localSttApiKey: 'local',
    localSttModel: LOCAL_RECOMMEND.asr
  }
}

export function providerLabel(id: ProviderId): string {
  switch (id) {
    case 'siliconflow':
      return '硅基流动'
    case 'openai':
      return 'OpenAI'
    case 'local':
      return '本地'
    default:
      return '自定义'
  }
}
