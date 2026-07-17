import {
  AppSettings,
  CaptureResult,
  CapturedMessage,
  Contact,
  LOCAL_DEFAULTS,
  Message,
  ProfileRefreshResult
} from '../shared/types'
import { getOllamaStatus } from './ollama'

function resolveRuntime(settings: AppSettings): {
  baseUrl: string
  apiKey: string
  modelName: string
  visionModelName: string
  isLocal: boolean
} {
  if (settings.inferenceMode === 'local') {
    return {
      baseUrl: LOCAL_DEFAULTS.openaiBase,
      apiKey: LOCAL_DEFAULTS.apiKeyPlaceholder,
      modelName: settings.localModelName || LOCAL_DEFAULTS.textModel,
      visionModelName: settings.localVisionModelName || LOCAL_DEFAULTS.visionModel,
      isLocal: true
    }
  }
  return {
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    modelName: settings.modelName,
    visionModelName: settings.visionModelName,
    isLocal: false
  }
}

function chatUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return `${base}/chat/completions`
}

async function chatCompletion(
  settings: AppSettings,
  body: Record<string, unknown>
): Promise<string> {
  const runtime = resolveRuntime(settings)

  if (runtime.isLocal) {
    const status = await getOllamaStatus(runtime.modelName, runtime.visionModelName)
    if (!status.running) {
      throw new Error('本地 Ollama 未运行，请到设置页启动并安装本地模型')
    }
  } else if (!runtime.apiKey.trim()) {
    throw new Error('请先在设置里配置 API Key，或改用免费本地模型')
  }

  if (!runtime.baseUrl.trim()) {
    throw new Error('请先配置 API Base URL')
  }

  const res = await fetch(chatUrl(runtime.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${runtime.apiKey.trim() || 'ollama'}`
    },
    body: JSON.stringify(body)
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`模型请求失败 (${res.status}): ${text.slice(0, 300)}`)
  }

  let data: { choices?: { message?: { content?: string } }[] }
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('模型返回不是合法 JSON')
  }

  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('模型没有返回内容')
  return content.trim()
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? raw).trim()
  return JSON.parse(candidate)
}

export async function testConnection(settings: AppSettings): Promise<string> {
  const runtime = resolveRuntime(settings)
  const content = await chatCompletion(settings, {
    model: runtime.modelName || runtime.visionModelName,
    temperature: 0,
    messages: [{ role: 'user', content: '只回复：ok' }],
    max_tokens: 8
  })
  return content
}

export async function recognizeChatScreenshot(
  settings: AppSettings,
  imageBase64: string,
  hint: { appName: string; windowTitle: string }
): Promise<CaptureResult> {
  const runtime = resolveRuntime(settings)
  const model = runtime.visionModelName || runtime.modelName
  const prompt = `你是聊天窗口截图解析器。请分析这张即时通讯（微信/QQ）聊天窗口截图。
已知前台应用：${hint.appName || '未知'}，窗口标题：${hint.windowTitle || '未知'}。

请只输出 JSON（不要解释），格式：
{
  "channel": "wechat" | "qq" | "unknown",
  "contactName": "当前聊天对象的名字（顶部或会话标题）",
  "messages": [
    { "role": "them" | "me", "content": "纯文字内容" }
  ]
}

规则：
1. role=them 表示对方说的（通常在左侧气泡），role=me 表示我说的（通常在右侧气泡）
2. 只提取文字消息，忽略图片、表情、时间分隔、系统提示
3. 按从上到下时间顺序
4. contactName 不要带未读数字
5. 如果看不清就尽量猜测可见文字，不要编造不存在的长对话`

  const content = await chatCompletion(settings, {
    model,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${imageBase64}` }
          }
        ]
      }
    ]
  })

  let parsed: {
    channel?: string
    contactName?: string
    messages?: CapturedMessage[]
  }
  try {
    parsed = extractJson(content) as typeof parsed
  } catch {
    throw new Error(
      runtime.isLocal
        ? '本地视觉识别解析失败，可重试或升级云端模型'
        : '识别结果解析失败，请换支持视觉的模型（vision）'
    )
  }

  const channel =
    parsed.channel === 'wechat' || parsed.channel === 'qq' || parsed.channel === 'unknown'
      ? parsed.channel
      : 'unknown'
  const contactName = (parsed.contactName || '').trim()
  if (!contactName) throw new Error('未能识别联系人名称')

  const messages = (parsed.messages || [])
    .filter((m) => m && (m.role === 'me' || m.role === 'them') && String(m.content || '').trim())
    .map((m) => ({ role: m.role, content: String(m.content).trim() }))

  return { channel, contactName, messages }
}

export async function generateReply(
  settings: AppSettings,
  contact: Contact,
  history: Message[]
): Promise<string> {
  const runtime = resolveRuntime(settings)
  let keyFactsText = ''
  try {
    const facts = JSON.parse(contact.keyFacts || '[]') as { text?: string }[]
    keyFactsText = facts
      .map((f) => f.text)
      .filter(Boolean)
      .join('；')
  } catch {
    keyFactsText = ''
  }

  const persona = [
    contact.personaTitle ? `人设名称：${contact.personaTitle}` : '',
    contact.personaPrompt ? `人设描述：${contact.personaPrompt}` : '',
    contact.personaTags ? `人设标签：${contact.personaTags}` : '',
    contact.tags ? `联系人标签：${contact.tags}` : '',
    contact.profileSummary ? `对方画像：${contact.profileSummary}` : '',
    contact.profileTags ? `画像标签：${contact.profileTags}` : '',
    keyFactsText ? `关键事实：${keyFactsText}` : '',
    contact.notes ? `备注：${contact.notes}` : ''
  ]
    .filter(Boolean)
    .join('\n')

  const historyText = history
    .map((m) => `${m.role === 'me' ? '我' : '对方'}：${m.contentText}`)
    .join('\n')

  const system = `你是「口喷输入」里的回复助手。请严格以「我」的身份，按当前联系人的人设回复对方。
要求：
1. 只输出一条可直接发送的中文回复，不要引号，不要分析过程
2. 语气自然，像真人微信聊天，不要官方腔
3. 结合历史上下文，不要忘记之前聊过的事
4. 若人设为空，用亲切自然的默认私聊语气
5. 不要提及你是 AI`

  const user = `当前联系人：${contact.displayName}（渠道：${contact.channel}）

【我对这个人的人设与对方画像】
${persona || '（未设置，用自然亲切语气）'}

【最近对话】
${historyText || '（暂无历史，根据截屏识别到的最新内容合理开场/接话）'}

请生成下一条「我」要发送的回复：`

  return chatCompletion(settings, {
    model: runtime.modelName,
    temperature: 0.7,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  })
}

export async function refreshProfileFromHistory(
  settings: AppSettings,
  contact: Contact,
  history: Message[]
): Promise<ProfileRefreshResult> {
  const runtime = resolveRuntime(settings)
  const historyText = history
    .slice(-120)
    .map((m) => `${m.role === 'me' ? '我' : '对方'}：${m.contentText}`)
    .join('\n')

  if (!historyText.trim()) {
    throw new Error('暂无聊天记录，无法生成画像')
  }

  const prompt = `你是对话助手。根据「我对联系人扮演的人设」与双方历史聊天，输出 JSON（不要解释）：
{
  "personaTitle": "我对TA的人设短名",
  "personaPrompt": "我对TA的人设描述（身份/性格/说话风格/边界）",
  "personaTags": ["人设标签1", "人设标签2"],
  "profileSummary": "对方人物画像总结（身份、偏好、习惯、雷点、关系进展）",
  "profileTags": ["对方标签1", "对方标签2"],
  "keyFacts": ["关键事实1", "关键事实2"]
}

要求：
1. 基于对话事实，不要编造夸张情节
2. 标签简短（2-6字）
3. keyFacts 每条一句话，最多 8 条
4. 若原有人设/画像可参考并优化，不要完全跑偏

当前联系人：${contact.displayName}
原人设名：${contact.personaTitle || '无'}
原人设：${contact.personaPrompt || '无'}
原画像：${contact.profileSummary || '无'}

【历史对话】
${historyText}`

  const content = await chatCompletion(settings, {
    model: runtime.modelName,
    temperature: 0.4,
    messages: [{ role: 'user', content: prompt }]
  })

  try {
    return extractJson(content) as ProfileRefreshResult
  } catch {
    throw new Error('画像解析失败，请换模型后重试')
  }
}

export function isLocalMode(settings: AppSettings): boolean {
  return settings.inferenceMode === 'local'
}
