import {
  formatScenarioPromptBlock,
  getPersonaPack,
  matchScenario
} from '../shared/persona-packs'
import {
  AppSettings,
  CaptureResult,
  CapturedMessage,
  Contact,
  LOCAL_DEFAULTS,
  Message,
  ProfileRefreshResult
} from '../shared/types'
import { guessChannel, parseContactNameFromWindowTitle } from './capture'
import {
  formatMembershipHttpError,
  membershipAuthHeaders,
  membershipChatBase,
  intendsOfficialMembership,
  type MembershipCapability
} from './membership'
import { formatPromptSceneBlock, matchPromptScene } from '../shared/prompt-scenes'
import { getOllamaStatus } from './ollama'

export type GenerateReplyResult = {
  text: string
  /** 命中场景短名，供 HUD */
  scenarioShortName?: string
}

function resolveRuntime(settings: AppSettings): {
  baseUrl: string
  apiKey: string
  modelName: string
  visionModelName: string
  isLocal: boolean
  isMembership: boolean
} {
  if (settings.inferenceMode === 'local') {
    return {
      baseUrl: LOCAL_DEFAULTS.openaiBase,
      apiKey: LOCAL_DEFAULTS.apiKeyPlaceholder,
      modelName: settings.localModelName || LOCAL_DEFAULTS.textModel,
      visionModelName: settings.localVisionModelName || LOCAL_DEFAULTS.visionModel,
      isLocal: true,
      isMembership: false
    }
  }
  if (intendsOfficialMembership(settings)) {
    return {
      baseUrl: membershipChatBase(settings),
      apiKey: settings.membershipAccessToken.trim(),
      modelName: settings.modelName,
      visionModelName: settings.visionModelName,
      isLocal: false,
      isMembership: true
    }
  }
  return {
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    modelName: settings.modelName,
    visionModelName: settings.visionModelName,
    isLocal: false,
    isMembership: false
  }
}

function chatUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return `${base}/chat/completions`
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('aborted'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason ?? new Error('aborted'))
      },
      { once: true }
    )
  })
}

function formatModelHttpError(status: number, body: string): string {
  let msg = ''
  try {
    const j = JSON.parse(body) as { message?: string; code?: number | string }
    msg = (j.message || '').trim()
    if (status === 429 || /rate.?limit/i.test(msg) || j.code === 50609) {
      return (
        '模型请求太频繁被限流了（429）。看屏幕答题会连打「读题+作答」两次，请等十几秒再试；' +
        '或在模型页换配额更高的模型/提升硅基等级。' +
        (msg ? `（${msg.slice(0, 80)}）` : '')
      )
    }
    if (status === 401) return 'API Key 无效，请到模型页检查'
    if (status === 403) {
      return msg.includes('实名') || /authenticat/i.test(msg)
        ? '该模型需要实名认证或权限不足，请到服务商控制台处理'
        : `权限不足或余额不足：${msg.slice(0, 120) || body.slice(0, 120)}`
    }
    if (msg) return `模型请求失败 (${status}): ${msg.slice(0, 200)}`
  } catch {
    // fall through
  }
  return `模型请求失败 (${status}): ${body.slice(0, 200)}`
}

async function chatCompletion(
  settings: AppSettings,
  body: Record<string, unknown>,
  signal?: AbortSignal,
  capability: MembershipCapability = 'reply'
): Promise<string> {
  const runtime = resolveRuntime(settings)

  if (runtime.isLocal) {
    const status = await getOllamaStatus(runtime.modelName, runtime.visionModelName)
    if (!status.running) {
      throw new Error('本地 Ollama 未运行，请到设置页启动并安装本地模型')
    }
  } else if (runtime.isMembership) {
    if (!runtime.apiKey.trim()) {
      throw new Error('请先注册或登录官方会员，或到「模型」页改用自配 Key / 本地')
    }
  } else if (!runtime.apiKey.trim()) {
    throw new Error('请先在设置里配置 API Key，或改用免费本地模型 / 官方会员')
  }

  if (!runtime.baseUrl.trim()) {
    throw new Error('请先配置 API Base URL')
  }

  const maxAttempts = runtime.isLocal ? 1 : 3
  let lastErr: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(runtime.isMembership
        ? membershipAuthHeaders(settings, capability)
        : { Authorization: `Bearer ${runtime.apiKey.trim() || 'ollama'}` })
    }
    const res = await fetch(chatUrl(runtime.baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    })

    const text = await res.text()
    if (!res.ok) {
      lastErr = new Error(
        runtime.isMembership
          ? formatMembershipHttpError(res.status, text)
          : formatModelHttpError(res.status, text)
      )
      const retryable = res.status === 429 || res.status === 503 || res.status === 504
      if (retryable && attempt < maxAttempts) {
        await sleep(1500 * attempt, signal)
        continue
      }
      throw lastErr
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

  throw lastErr ?? new Error('模型请求失败')
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? raw).trim()
  return JSON.parse(candidate)
}

function isGenericContactName(name: string): boolean {
  const t = name.trim().toLowerCase()
  return (
    t === '微信' ||
    t === 'wechat' ||
    t === 'weixin' ||
    t === 'qq' ||
    t === '腾讯qq' ||
    t === 'unknown' ||
    t === '未知'
  )
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
  image: { base64: string; mime: string },
  hint: { appName: string; windowTitle: string; contactNameHint?: string },
  signal?: AbortSignal
): Promise<CaptureResult> {
  const runtime = resolveRuntime(settings)
  const model = runtime.visionModelName || runtime.modelName
  const titleHint = hint.contactNameHint || parseContactNameFromWindowTitle(hint.windowTitle, hint.appName)
  const channelGuess = guessChannel(hint.appName, hint.windowTitle)

  const prompt = titleHint
    ? `你是聊天截图解析器。截图已去掉左侧会话列表和底部输入框，保留了顶栏与聊天气泡。
已知前台应用：${hint.appName || '未知'}，窗口标题：${hint.windowTitle || '未知'}。
**联系人姓名已确定为「${titleHint}」，JSON 里 contactName 必须填「${titleHint}」。**

请只输出 JSON（不要解释），格式：
{
  "channel": "wechat" | "qq" | "unknown",
  "contactName": "${titleHint}",
  "messages": [
    { "role": "them" | "me", "content": "纯文字内容" }
  ]
}

规则：
1. role=them 表示对方说的（通常在左侧气泡），role=me 表示我说的（通常在右侧气泡）
2. 只提取文字消息，忽略图片、表情、时间分隔、系统提示
3. 按从上到下时间顺序
4. 尽量提取可见文字，不要编造不存在的长对话`
    : `你是聊天截图解析器。截图已去掉左侧会话列表和底部输入框，**顶部仍保留当前聊天对象的昵称栏**。
已知前台应用：${hint.appName || '未知'}，窗口标题：${hint.windowTitle || '未知'}${channelGuess !== 'unknown' ? `，渠道推测：${channelGuess}` : ''}。
注意：Mac 微信窗口标题经常只是「微信」，**contactName 必须从截图顶部昵称栏读取**（聊天气泡上方那一行名字），不要留空。

请只输出 JSON（不要解释），格式：
{
  "channel": "wechat" | "qq" | "unknown",
  "contactName": "顶部昵称栏里的名字",
  "messages": [
    { "role": "them" | "me", "content": "纯文字内容" }
  ]
}

规则：
1. contactName 必填：读聊天区顶部居中/偏左的昵称，不要用「微信」「WeChat」
2. role=them 左侧气泡，role=me 右侧气泡
3. 只提取文字消息，忽略图片、表情、时间分隔、系统提示
4. 按从上到下时间顺序
5. 尽量提取可见文字，不要编造`

  const content = await chatCompletion(
    settings,
    {
      model,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:${image.mime};base64,${image.base64}` }
            }
          ]
        }
      ]
    },
    signal,
    'reply_vision'
  )

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
  let contactName = titleHint || (parsed.contactName || '').trim()
  if (!contactName || isGenericContactName(contactName)) {
    const fromTitle = parseContactNameFromWindowTitle(hint.windowTitle, hint.appName)
    if (fromTitle) contactName = fromTitle
  }
  if (!contactName) {
    throw new Error(
      hint.windowTitle
        ? '未能识别联系人名称：请确保已打开与某人的聊天窗口（不要停在微信主界面）'
        : '未能识别联系人名称：请把聊天窗口置于最前后再试'
    )
  }

  const messages = (parsed.messages || [])
    .filter((m) => m && (m.role === 'me' || m.role === 'them') && String(m.content || '').trim())
    .map((m) => ({ role: m.role, content: String(m.content).trim() }))

  return { channel, contactName, messages }
}

export async function generateReply(
  settings: AppSettings,
  contact: Contact,
  history: Message[],
  signal?: AbortSignal
): Promise<GenerateReplyResult> {
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

  const hasContactPersona = Boolean(contact.personaPrompt?.trim() || contact.personaTitle?.trim())
  const pack = getPersonaPack(settings.personaPackId)
  const scenario = matchScenario(pack, history)

  const contactPersona = [
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

  const packHardRules =
    pack?.hardRules?.length
      ? `【性格包硬规则】\n${pack.hardRules.map((r) => `- ${r}`).join('\n')}`
      : ''

  const packPersonaBlock = pack
    ? hasContactPersona
      ? `【行业性格补充（联系人人设优先，以下仅作底色）】
人设名称：${pack.defaultPersona.title}
人设描述：${pack.defaultPersona.prompt}
人设标签：${pack.defaultPersona.tags.join('，')}`
      : `【默认性格（性格包）】
人设名称：${pack.defaultPersona.title}
人设描述：${pack.defaultPersona.prompt}
人设标签：${pack.defaultPersona.tags.join('，')}`
    : ''

  const scenarioBlock = scenario ? formatScenarioPromptBlock(scenario) : ''

  const historyText = history
    .map((m) => `${m.role === 'me' ? '我' : '对方'}：${m.contentText}`)
    .join('\n')

  const deAi = settings.deAiToneEnabled !== false
  const deAiBlock = deAi
    ? `
【去除 AI 味儿 — 必须遵守】
- 像真人微信/QQ 私聊随手回，不像助手、客服、作文或点评
- 优先短句；能一句话说完就不要两句；偶尔可以语气词（嗯、哈哈、行、好呀），但不要堆砌
- 禁止：排比句、总分结构、「首先/其次/最后」、总结陈词、过度共情套话
- 禁止：完美语法长句、书面词（「或许」「此外」「综上所述」「值得一提」）、空洞鼓励鸡汤
- 禁止：复述对方整段话再回答；直接接话即可
- 标点随意一点：可用省略号、问号，少用感叹号堆叠；不要用 markdown 或列表
- 语气贴齐我在历史里已有的说话习惯（用词长短、是否卖萌、是否简短）`
    : `
【语气】
- 自然亲切，像真人私聊，不要官方腔，不要提及你是 AI`

  const system = `你是「即刻对话」里的回复助手。请严格以「我」的身份回复对方。
要求：
1. 只输出一条可直接发送的中文回复，不要引号，不要分析过程，不要前后说明
2. 结合历史上下文，不要忘记之前聊过的事
3. 联系人专属人设优先于性格包默认人设；若命中场景技巧，按场景目标与禁忌来回
4. 不要提及你是 AI、助手、模型或「性格包/剧本」
${deAiBlock}`

  const user = `当前联系人：${contact.displayName}（渠道：${contact.channel}）

${packHardRules ? `${packHardRules}\n\n` : ''}${packPersonaBlock ? `${packPersonaBlock}\n\n` : ''}【我对这个人的人设与对方画像】
${contactPersona || '（未设置联系人人设）'}

${scenarioBlock ? `${scenarioBlock}\n\n` : ''}【最近对话】
${historyText || '（暂无历史，根据截屏识别到的最新内容合理开场/接话）'}

请生成下一条「我」要发送的回复${deAi ? '（去 AI 味，像随手打的字）' : ''}：`

  const text = await chatCompletion(
    settings,
    {
      model: runtime.modelName,
      temperature: deAi ? 0.85 : 0.7,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    },
    signal,
    'reply'
  )

  return {
    text,
    scenarioShortName: scenario?.shortName
  }
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
  }, undefined, 'chat')

  try {
    return extractJson(content) as ProfileRefreshResult
  } catch {
    throw new Error('画像解析失败，请换模型后重试')
  }
}

/**
 * 看屏幕问答：整屏截图 + 用户口述问题 → 自然语言回答
 */
export async function answerScreenQuestion(
  settings: AppSettings,
  image: { base64: string; mime: string },
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  signal?: AbortSignal
): Promise<string> {
  const runtime = resolveRuntime(settings)
  const model = runtime.visionModelName || runtime.modelName
  const q = question.trim()
  if (!q) throw new Error('没有听清问题，请再说一次')

  const historyBlock =
    history.length > 0
      ? `以下是本会话更早的对话（仅文字，供连贯；当前任务以最新截图为准）：\n${history
          .map((h) => `${h.role === 'user' ? '用户' : '助手'}：${h.content}`)
          .join('\n')}\n\n`
      : ''

  const prompt = `你是桌面屏幕助手。用户刚截取了当前整个屏幕，并用语音提出了请求。
请根据截图内容直接回答或完成任务。
${historyBlock}用户这次说：
${q}

规则：
1. 只根据截图里能看到的信息作答；看不清就如实说
2. 用简洁口语，分点也可；不要编造屏幕上没有的内容
3. 若用户要总结/解释文档或代码，抓住要点即可
4. 不要输出 JSON、不要套「作为 AI」之类开场白
5. 回答使用与用户问题相同的语言（中文问就用中文答）
6. 若与上文相关，可承接，但优先看清当前截图
7. 读列表/卡片时：名称与旁边数字必须成对核对（禁止把 A 的人数安到 B 名下）。问「最多/最少」时，先在心里对照几条带数字的项，再给出结论；易混校名/机构名要逐字看清`

  return chatCompletion(
    settings,
    {
      model,
      temperature: 0.3,
      max_tokens: 1200,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:${image.mime};base64,${image.base64}` }
            }
          ]
        }
      ]
    },
    signal,
    'screen_ask'
  )
}

/** 看屏幕答题 · 步骤1：视觉模型只读题（题干+选项），不给答案 */
export async function extractScreenQuizText(
  settings: AppSettings,
  image: { base64: string; mime: string },
  signal?: AbortSignal
): Promise<string> {
  const runtime = resolveRuntime(settings)
  const model = runtime.visionModelName || runtime.modelName
  const prompt = `你是考试截图读题器。用户截取了当前整个屏幕。

任务：只把屏幕上的题目原文转写出来。不要答题、不要解析、不要猜测答案、不要客套。

规则：
1. 保留题号、题干、全部选项（A/B/C/D 等）和题型（单选/多选/判断/填空）
2. 多题按题号分行；看不清的字用【？】标出
3. 忽略与题目无关的浏览器栏、广告、桌面图标
4. 没有题目时只输出：屏幕上没有题目
5. 用题目所用语言原样输出
6. 若屏幕是报名榜/统计表等非考题列表，原样转写「名称 + 对应数字」，名称与数字必须同一条目，勿错位`

  const raw = await chatCompletion(
    settings,
    {
      model,
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:${image.mime};base64,${image.base64}` }
            }
          ]
        }
      ]
    },
    signal,
    'screen_quiz'
  )
  return raw.trim()
}

/** 看屏幕答题 · 步骤2：文字模型对照知识库作答（无图） */
export async function answerScreenQuizFromText(
  settings: AppSettings,
  questionText: string,
  signal?: AbortSignal,
  knowledgeBase?: string
): Promise<string> {
  const runtime = resolveRuntime(settings)
  const model = runtime.modelName || runtime.visionModelName
  const q = questionText.trim()
  if (!q) throw new Error('没有读到题目')
  if (/屏幕上没有题目/.test(q) && q.length < 40) {
    return '屏幕上没有题目'
  }

  const kb = (knowledgeBase || '').trim()
  const kbBlock = kb
    ? `\n\n—— 以下为内置「Datawhale×魔搭 AI Agent Engineer」考试知识库，答题时优先对照；与题目无关则忽略 ——\n${kb}\n—— 知识库结束 ——\n`
    : ''

  const prompt = `你是答题助手。下面是从考试截图转写的题目原文（可能含【？】表示看不清）。
${kbBlock}
题目：
${q}

任务：只输出正确答案。不要解释、不要步骤、不要客套、不要鼓励。

规则：
1. 有题号按题号列，如「1. A」「2. 光合作用」；多题换行
2. 选择题只写选项字母或最终答案；填空只写应填内容；判断写「对/错」或 True/False
3. 尽量短；禁止长篇解析
4. 知识库能命中考点时优先按知识库结论答；知识库与题干冲突时以题干为准
5. 题干严重残缺无法判断时写「看不清题目」
6. 用题目所用语言作答（中文题用中文）`

  const raw = await chatCompletion(
    settings,
    {
      model,
      temperature: 0.1,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    },
    signal,
    'screen_quiz'
  )
  return raw.trim()
}

/** 看屏幕答题：视觉读题 → 文字作答 */
export async function answerScreenQuiz(
  settings: AppSettings,
  image: { base64: string; mime: string },
  signal?: AbortSignal,
  knowledgeBase?: string,
  onPhase?: (phase: 'reading' | 'answering') => void
): Promise<{ answer: string; questionText: string }> {
  onPhase?.('reading')
  const questionText = await extractScreenQuizText(settings, image, signal)
  onPhase?.('answering')
  // 读题与作答连打两次 API，稍等降低 RPM 撞限流概率
  if (settings.inferenceMode !== 'local') {
    await sleep(800, signal)
  }
  const answer = await answerScreenQuizFromText(settings, questionText, signal, knowledgeBase)
  return { answer, questionText }
}

const EMPTY_SCREEN_CONTEXT = '无相关上下文'

function unwrapPromptBody(raw: string): string {
  let text = raw.trim()
  const fenced = text.match(/^```[a-zA-Z0-9_-]*\s*\r?\n([\s\S]*?)\r?\n```$/i)
  if (fenced?.[1]) text = fenced[1].trim()
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith('「') && text.endsWith('」'))
  ) {
    text = text.slice(1, -1).trim()
  }
  return text
}

/** 有图时：视觉模型只抽与写提示词有关的事实，不写说明书。 */
async function extractPromptScreenContext(
  settings: AppSettings,
  image: { base64: string; mime: string },
  signal?: AbortSignal
): Promise<string> {
  const runtime = resolveRuntime(settings)
  const model = runtime.visionModelName || runtime.modelName
  const prompt = `用户正要对屏幕上的 AI 输入框说话。请只根据截图列出对「写给那个 AI 的任务说明」有用的事实。

输出规则：
1. 若有报错、文件路径、选中代码、表格数字、文档标题、对话里上一句 AI 回复：每条一行短事实
2. 最多 10 条；忽略浏览器栏、桌面图标、与任务无关的壳
3. 若只是空输入框、聊天软件界面、或与即将要做的事无关：只输出一行「${EMPTY_SCREEN_CONTEXT}」
4. 不要回答用户、不要写提示词、不要猜测看不见的内容`

  const raw = await chatCompletion(
    settings,
    {
      model,
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:${image.mime};base64,${image.base64}` }
            }
          ]
        }
      ]
    },
    signal,
    'reply_vision'
  )
  const notes = unwrapPromptBody(raw)
  return notes || EMPTY_SCREEN_CONTEXT
}

async function rewriteSpokenAsAiPrompt(
  settings: AppSettings,
  spokenText: string,
  screenNotes: string,
  signal?: AbortSignal
): Promise<string> {
  const runtime = resolveRuntime(settings)
  const scene = matchPromptScene(spokenText, screenNotes)
  const sceneBlock = formatPromptSceneBlock(scene)
  const prompt = `你是给其它 AI（Cursor、ChatGPT、WorkBuddy 等）写任务说明书的助手。
用户刚口述了一个意图。请改写成一条可直接粘贴给那个 AI 去执行的提示词。

屏幕摘要：
${screenNotes}

用户口述：
${spokenText}

${sceneBlock}

通用规则：
1. 只输出提示词正文。不要开场白、不要「好的，提示词如下」、不要分析过程、不要用 markdown 代码围栏包住整段
2. 不要替那个 AI 回答问题，不要写代码实现，不要写成微信/QQ 私聊回复
3. 把「我是…我想做…」改成对 Agent 的祈使任务（请你 / 为我做 …）
4. 按语境修正口误
5. 屏幕摘要里若有报错、文件名、代码、表格：必须写进提示词，且这些细节不得编造
6. 屏幕摘要为「${EMPTY_SCREEN_CONTEXT}」时不要编造路径或报错；不要编造用户没提过的品牌、具体数字
7. 必须遵守上面的【本轮场景】骨架、允许补全与禁止；不要串用其它场景的模块（例如修 Bug 不要写购物车，做 PPT 不要写官网）
8. 使用与用户口述相同的语言
9. 不要写「请发送」或催促回车`

  const raw = await chatCompletion(
    settings,
    {
      model: runtime.modelName,
      temperature: 0.65,
      max_tokens: 1400,
      messages: [{ role: 'user', content: prompt }]
    },
    signal,
    'reply'
  )
  const out = unwrapPromptBody(raw)
  if (!out) throw new Error('提示词增强没有写出内容，请重试')
  return out
}

/**
 * 按住即刻对话：口述（+ 可选整屏）→ 场景路由 + 场景包 → 可粘贴的 AI 任务说明书。
 * 有图时先抽屏幕事实；文字模型按 website/ppt/debug/brief/generic 扩写。
 */
export async function enhancePromptForAi(
  settings: AppSettings,
  image: { base64: string; mime: string } | null,
  spoken: string,
  signal?: AbortSignal,
  onPhase?: (phase: 'reading' | 'writing') => void
): Promise<string> {
  const spokenText = spoken.trim()
  if (!spokenText) throw new Error('没有听清你说的话，请再按住说一次')

  let screenNotes = EMPTY_SCREEN_CONTEXT
  if (image) {
    onPhase?.('reading')
    try {
      screenNotes = await extractPromptScreenContext(settings, image, signal)
    } catch {
      screenNotes = EMPTY_SCREEN_CONTEXT
    }
    if (settings.inferenceMode !== 'local') {
      await sleep(800, signal)
    }
  }

  onPhase?.('writing')
  return rewriteSpokenAsAiPrompt(settings, spokenText, screenNotes, signal)
}

/** 口语水词：嗯/啊/呃 以及停顿里的「那个/就是」。有实义的指代不在此硬删，交给模型拿不准时保留。 */
export function stripSpokenFillers(text: string): string {
  let s = text.replace(/\u3000/g, ' ')
  s = s.replace(/[嗯呃额唔唉]+/g, '')
  s = s.replace(/(^|[^\u4e00-\u9fff])啊+(?=[^\u4e00-\u9fff]|$)/g, '$1')
  s = s.replace(/(?:那个){2,}/g, '')
  s = s.replace(/(?:就是){2,}/g, '')
  s = s.replace(/(^|[\s，,。！？、；;：:])那个(?=[\s，,。！？、；;：:]|$)/g, '$1')
  s = s.replace(/(^|[\s，,。！？、；;：:])就是(?=[\s，,。！？、；;：:]|$)/g, '$1')
  s = s.replace(/[ \t]{2,}/g, ' ')
  s = s.replace(/[，,]{2,}/g, '，')
  s = s.replace(/^[，,\s]+|[，,\s]+$/g, '')
  s = s.replace(/\s+([，。！？、；;])/g, '$1')
  return s.trim()
}

/**
 * 即刻对话转写后处理：去水词（规则）+ 改错别字（回复模型，可选）。
 * 失败时回退，不抛错。两开关都关则原样返回。
 */
export async function cleanVoiceTranscript(
  settings: AppSettings,
  spoken: string,
  signal?: AbortSignal
): Promise<string> {
  const raw = spoken.trim()
  if (!raw) return spoken

  const strip = settings.voiceStripFillersEnabled !== false
  const fix = settings.voiceFixSttTyposEnabled === true
  if (!strip && !fix) return spoken

  const afterFillers = strip ? stripSpokenFillers(raw) : raw
  const fallback = afterFillers.trim() ? afterFillers : raw
  if (!fix) return fallback

  try {
    const runtime = resolveRuntime(settings)
    const fillerRule = strip
      ? '同时去掉口语水词（嗯、啊、呃、那个、就是等无意义填充）。「那个/就是」若有实义（指代、解释）必须保留。'
      : '不要删减口语词，除非它明显是识别错误的一部分。'
    const prompt = `你是语音转写校对器。只修正识别错误，不要扩写、不要解释、不要换语气。

规则：
1. 只输出校对后的原文，不要引号、不要前缀、不要 Markdown。
2. 可改：同音错字、明显错别字、中英混听（把词听成别的字）。
3. 禁止发明原文没有的信息、禁止补充细节、禁止改成书面语。
4. 拿不准就保持原词。
5. ${fillerRule}

原文：
${fallback}`
    const maxTokens = Math.min(800, Math.max(64, Math.ceil(fallback.length * 1.5) + 32))
    const out = unwrapPromptBody(
      await chatCompletion(
        settings,
        {
          model: runtime.modelName,
          temperature: 0,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }]
        },
        signal,
        'reply'
      )
    )
    if (!out) return fallback
    if (out.length > fallback.length * 1.4 + 24) return fallback
    return out
  } catch {
    return fallback
  }
}

export function isLocalMode(settings: AppSettings): boolean {
  return settings.inferenceMode === 'local'
}
