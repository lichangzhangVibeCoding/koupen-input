import type { LocalePreference } from './i18n/types'
import type { PersonaPackId } from './persona-packs/types'
import type { VoiceTriggerId } from './hotkey'

export type Channel = 'wechat' | 'qq' | 'unknown'
export type { LocalePreference }
export type { VoiceTriggerId }

export type MessageRole = 'me' | 'them'

export type InferenceMode = 'local' | 'cloud'

/** 云端模型路由：自配 Key，或走官方会员薄代理 */
export type ModelRoutingMode = 'byok' | 'membership'

export type { PersonaPackId }

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
  /**
   * 即刻对话点按触发键（仅 Mac 生效）
   * rightCommand=右 Command（默认）；rightOption=右 Option；fn=Fn/地球键
   * Windows 忽略，仍用 Alt
   */
  voiceTrigger: VoiceTriggerId
  /**
   * 帮我对话：去除 AI 味儿（默认开）
   * 开启时强化真人私聊语气，抑制客服腔 / 排比 / 总结句
   */
  deAiToneEnabled: boolean
  /**
   * 默认性格包：none=通用；streamer-free-v1=主播维系（免费）
   */
  personaPackId: PersonaPackId
  /** Mac 权限引导是否已完成（开始使用 / 稍后再说） */
  permissionGuideCompleted: boolean
  /** UI 语言：system | zh-CN | en-US */
  locale: LocalePreference
  /** 看屏幕问答开关 */
  screenAskEnabled: boolean
  /** 看屏幕问答快捷键（globalShortcut） */
  screenAskHotkey: string
  /** 看屏幕答题：截屏后只给正确答案 */
  screenQuizEnabled: boolean
  /** 看屏幕答题快捷键 */
  screenQuizHotkey: string
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
  /**
   * 云端走自配 Key（byok）还是官方会员代理（membership）
   * 本地 inference / 本地 STT 不受此字段影响
   */
  modelRoutingMode: ModelRoutingMode
  /** 会员服务根地址；正式环境需含 index.php，如 https://…/talknowAPi/index.php */
  membershipServerUrl: string
  /** 会员登录后的 access token（仅本机） */
  membershipAccessToken: string
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

/** 看屏幕对话：角色 */
export type ScreenAskRole = 'user' | 'assistant'

/** 看屏幕会话（ChatGPT 式列表项） */
export interface ScreenAskSession {
  id: number
  title: string
  createdAt: string
  updatedAt: string
  /** 列表预览：最近一条内容摘要 */
  preview: string
}

/** 看屏幕对话消息（含可选截图相对路径） */
export interface ScreenAskMessage {
  id: number
  sessionId: number
  role: ScreenAskRole
  contentText: string
  /** 相对 userData/data/screen-ask/ 的路径；仅 user 轮常见 */
  screenshotPath: string | null
  screenshotMime: string | null
  capturedAt: string
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

/** HUD 动效图标：看 / 听 / 说 / 想 / 写 / 默认脉冲或转圈 */
export type HudIcon =
  | 'look'
  | 'listen'
  | 'speak'
  | 'think'
  | 'write'
  | 'pulse'
  | 'spin'
  | 'check'
  | 'warn'

export type HudStatus =
  | { kind: 'hidden' }
  | { kind: 'recognizing'; text?: string; detail?: string; icon?: HudIcon }
  | { kind: 'generating'; text?: string; detail?: string; icon?: HudIcon }
  | { kind: 'recording'; text?: string; detail?: string; icon?: HudIcon }
  | { kind: 'transcribing'; text?: string; detail?: string; icon?: HudIcon }
  | { kind: 'done'; text: string; detail?: string }
  | { kind: 'error'; text: string; detail?: string }
  /** 看屏幕：较长回答，多行展示 */
  | { kind: 'answer'; text: string }

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
    modelName: 'deepseek-ai/DeepSeek-V4-Flash',
    visionModelName: 'Qwen/Qwen3-VL-32B-Instruct'
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
  // Mac：快速双击右 Command（单击留给「即刻对话」语音）
  hotkey: 'DoubleCommand',
  // 默认走在线硅基推荐（与模型页「硅基流动」快捷区一致）；本地套件需用户主动点安装
  inferenceMode: 'cloud',
  provider: 'siliconflow',
  baseUrl: 'https://api.siliconflow.cn/v1',
  apiKey: '',
  modelName: 'deepseek-ai/DeepSeek-V4-Flash',
  visionModelName: 'Qwen/Qwen3-VL-32B-Instruct',
  localModelName: LOCAL_DEFAULTS.textModel,
  localVisionModelName: LOCAL_DEFAULTS.visionModel,
  contextWindowSize: 40,
  voiceInputEnabled: true,
  voiceTrigger: 'rightCommand',
  deAiToneEnabled: true,
  personaPackId: 'none',
  permissionGuideCompleted: false,
  locale: 'system',
  screenAskEnabled: true,
  // 默认 Mac Command+Shift+1；Win 在 user-config 里校正为 Super+Shift+1
  screenAskHotkey: 'Command+Shift+1',
  screenQuizEnabled: true,
  // 默认 Mac Command+Shift+2；Win 在 user-config 里校正为 Super+Shift+2
  screenQuizHotkey: 'Command+Shift+2',
  sttInferenceMode: 'cloud',
  sttBaseUrl: 'https://api.siliconflow.cn/v1',
  sttApiKey: '',
  sttModel: 'FunAudioLLM/SenseVoiceSmall',
  localSttBaseUrl: LOCAL_DEFAULTS.sttBase,
  localSttApiKey: LOCAL_DEFAULTS.sttApiKey,
  localSttModel: LOCAL_DEFAULTS.sttModel,
  modelRoutingMode: 'byok',
  membershipServerUrl: 'https://www.lizhenning.com/other/typenow/talknowAPi/index.php',
  membershipAccessToken: ''
}
