export type Channel = 'wechat' | 'qq' | 'unknown'

export type MessageRole = 'me' | 'them'

export type InferenceMode = 'local' | 'cloud'

export interface AppSettings {
  hotkey: string
  /**
   * 智能回复运行方式（截屏识别 + 生成回复）
   * 兼容旧字段名 inferenceMode
   */
  inferenceMode: InferenceMode
  provider: string
  baseUrl: string
  apiKey: string
  modelName: string
  visionModelName: string
  contextWindowSize: number
  /** 本地文本模型名（Ollama tag） */
  localModelName: string
  /** 本地视觉模型名（Ollama tag） */
  localVisionModelName: string
  /** 长文本语音转文字开关 */
  voiceInputEnabled: boolean
  /** 语音转文字运行方式：本地 / 在线（独立于智能回复） */
  sttInferenceMode: InferenceMode
  /** 在线转写 API */
  sttBaseUrl: string
  sttApiKey: string
  sttModel: string
  /** 本地转写（Whisper 兼容服务） */
  localSttBaseUrl: string
  localSttApiKey: string
  localSttModel: string
}

export interface KeyFact {
  id: string
  text: string
  createdAt: string
}

export interface Contact {
  id: number
  channel: Channel
  displayName: string
  /** 客户标签（逗号分隔） */
  tags: string
  personaTitle: string
  personaPrompt: string
  /** 我对 TA 的人设标签（逗号分隔） */
  personaTags: string
  /** 客户人物画像总结 */
  profileSummary: string
  /** 画像/关键信息标签（逗号分隔） */
  profileTags: string
  /** 关键事实 JSON：KeyFact[] */
  keyFacts: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: number
  contactId: number
  role: MessageRole
  contentText: string
  capturedAt: string
  batchId: string
}

export interface MessageQuery {
  limit?: number
  from?: string
  to?: string
}

export interface ProfileRefreshResult {
  personaTitle?: string
  personaPrompt?: string
  personaTags?: string[]
  profileSummary?: string
  profileTags?: string[]
  keyFacts?: string[]
}

export interface CapturedMessage {
  role: MessageRole
  content: string
}

export interface CaptureResult {
  channel: Channel
  contactName: string
  messages: CapturedMessage[]
}

export type HudStatus =
  | { kind: 'hidden' }
  | { kind: 'recognizing'; text?: string }
  | { kind: 'generating'; text?: string }
  | { kind: 'recording'; text?: string }
  | { kind: 'transcribing'; text?: string }
  | { kind: 'done'; text: string }
  | { kind: 'error'; text: string }

export interface ProviderPreset {
  id: string
  label: string
  baseUrl: string
  modelName: string
  visionModelName: string
}

export interface SttProviderPreset {
  id: string
  label: string
  baseUrl: string
  modelName: string
}

export interface OllamaStatus {
  installed: boolean
  running: boolean
  version?: string
  models: string[]
  textModelReady: boolean
  visionModelReady: boolean
  error?: string
}

export interface PullProgress {
  model: string
  status: string
  completed?: number
  total?: number
  percent?: number
  done: boolean
  error?: string
}

/** 免费试用默认本地模型（体积相对小） */
export const LOCAL_DEFAULTS = {
  host: 'http://127.0.0.1:11434',
  openaiBase: 'http://127.0.0.1:11434/v1',
  textModel: 'qwen2.5:3b',
  visionModel: 'moondream',
  apiKeyPlaceholder: 'ollama',
  sttBase: 'http://127.0.0.1:9000/v1',
  sttModel: 'whisper-small',
  sttApiKey: 'local'
} as const

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4o-mini',
    visionModelName: 'gpt-4o-mini'
  },
  {
    id: 'siliconflow',
    label: '硅基流动 SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    modelName: 'deepseek-ai/DeepSeek-V3',
    visionModelName: 'moonshotai/Kimi-K2.7-Code'
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-chat',
    visionModelName: 'deepseek-chat'
  },
  {
    id: 'qwen',
    label: '通义千问 (DashScope 兼容)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelName: 'qwen-plus',
    visionModelName: 'qwen-vl-plus'
  },
  {
    id: 'moonshot',
    label: 'Moonshot / Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    modelName: 'moonshot-v1-8k',
    visionModelName: 'moonshot-v1-8k-vision-preview'
  },
  {
    id: 'custom',
    label: '自定义 (OpenAI 兼容)',
    baseUrl: '',
    modelName: '',
    visionModelName: ''
  }
]

export const STT_PROVIDER_PRESETS: SttProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI Whisper',
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'whisper-1'
  },
  {
    id: 'siliconflow',
    label: '硅基流动 SenseVoice',
    baseUrl: 'https://api.siliconflow.cn/v1',
    modelName: 'FunAudioLLM/SenseVoiceSmall'
  },
  {
    id: 'custom',
    label: '自定义 (Whisper 兼容)',
    baseUrl: '',
    modelName: ''
  }
]

export const DEFAULT_SETTINGS: AppSettings = {
  // Mac：快速双击左 Command（单击留给「我来口喷」）
  hotkey: 'DoubleCommand',
  inferenceMode: 'local',
  provider: 'local',
  baseUrl: LOCAL_DEFAULTS.openaiBase,
  apiKey: LOCAL_DEFAULTS.apiKeyPlaceholder,
  modelName: LOCAL_DEFAULTS.textModel,
  visionModelName: LOCAL_DEFAULTS.visionModel,
  localModelName: LOCAL_DEFAULTS.textModel,
  localVisionModelName: LOCAL_DEFAULTS.visionModel,
  contextWindowSize: 40,
  voiceInputEnabled: true,
  sttInferenceMode: 'cloud',
  sttBaseUrl: 'https://api.siliconflow.cn/v1',
  sttApiKey: '',
  sttModel: 'FunAudioLLM/SenseVoiceSmall',
  localSttBaseUrl: LOCAL_DEFAULTS.sttBase,
  localSttApiKey: LOCAL_DEFAULTS.sttApiKey,
  localSttModel: LOCAL_DEFAULTS.sttModel
}
