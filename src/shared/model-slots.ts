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
    hint: '我来口喷：你说，我转成字（左 Command）'
  },
  vision: {
    label: '截图理解',
    hint: '帮你口喷：看懂当前聊天窗口（快速双击左 Command）'
  },
  chat: {
    label: '回复生成',
    hint: '帮你口喷：按人设写出下一条回复'
  }
}

/** 硅基快捷推荐：与当前常用三槽一致，一点即同步到下方配置 */
export const SILICONFLOW_RECOMMEND = {
  baseUrl: 'https://api.siliconflow.cn/v1',
  asr: 'FunAudioLLM/SenseVoiceSmall',
  vision: 'moonshotai/Kimi-K2.7-Code',
  chat: 'deepseek-ai/DeepSeek-V3'
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
