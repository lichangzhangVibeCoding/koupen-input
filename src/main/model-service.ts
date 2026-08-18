import { getSettings, saveSettings } from './db'
import { getOllamaStatus, ensureLocalModels, startOllama } from './ollama'
import { ensureLocalAsr, isLocalAsrInstalled, AsrProgress } from './local-asr'
import { testConnection } from './llm'
import {
  applyLocalSuiteRecommend,
  applyOfficialModelRoutes,
  applySiliconflowRecommend,
  getSlotBindings,
  LOCAL_RECOMMEND,
  ProviderId,
  SLOT_META,
  SlotId,
  SlotStatus,
  providerLabel
} from '../shared/model-slots'
import { AppSettings, LOCAL_DEFAULTS } from '../shared/types'
import { membershipGetMe, intendsOfficialMembership, usesMembershipCloud } from './membership'

export interface ModelDashboard {
  slots: SlotStatus[]
  providers: {
    id: ProviderId
    label: string
    ready: boolean
    detail: string
  }[]
  readyCount: number
  total: number
  /** 当前云端是否走官方会员代理 */
  routingMode: 'membership' | 'byok' | 'local-mixed'
  membershipActive: boolean
}

export async function getModelDashboard(): Promise<ModelDashboard> {
  let settings = getSettings()
  const intendsOfficial = intendsOfficialMembership(settings)
  const membershipActive = usesMembershipCloud(settings)

  // 官方会员：把服务端三槽模型同步到本地，避免仍显示/请求自配模型名
  if (membershipActive) {
    try {
      const me = await membershipGetMe(settings)
      const synced = applyOfficialModelRoutes(settings, me.modelRoutes)
      if (
        synced.modelName !== settings.modelName ||
        synced.visionModelName !== settings.visionModelName ||
        synced.sttModel !== settings.sttModel
      ) {
        saveSettings(synced)
        settings = synced
      }
    } catch {
      /* 同步失败不挡仪表盘 */
    }
  }

  const bindings = getSlotBindings(settings)
  const ollama = await getOllamaStatus(
    settings.localModelName || LOCAL_DEFAULTS.textModel,
    settings.localVisionModelName || LOCAL_DEFAULTS.visionModel
  )
  const localAsr = isLocalAsrInstalled()
  const localChatReady = Boolean(ollama.running && ollama.textModelReady && ollama.visionModelReady)

  const slotReady = (id: SlotId): { ready: boolean; detail: string } => {
    const b = bindings[id]
    // 官方会员：云端槽位免 Key，由服务端路由；未登录则未就绪
    if (intendsOfficial && b.providerId !== 'local') {
      if (!membershipActive) {
        return {
          ready: false,
          detail: '请先注册或登录官方会员'
        }
      }
      return {
        ready: true,
        detail: `官方套餐 · ${SLOT_META[id].label}`
      }
    }
    if (b.providerId === 'local') {
      if (id === 'asr') {
        return localAsr
          ? { ready: true, detail: '本地语音已安装' }
          : { ready: false, detail: '未安装本地语音模型' }
      }
      return localChatReady
        ? { ready: true, detail: 'Ollama 本地对话就绪' }
        : { ready: false, detail: ollama.running ? '请拉取本地文本/视觉模型' : 'Ollama 未运行' }
    }
    if (id === 'asr') {
      const key = settings.sttApiKey.trim()
      const label = `${providerLabel(b.providerId)} · ${b.modelName}`
      return key
        ? { ready: true, detail: label }
        : { ready: false, detail: `${label} · 未填 Key` }
    }
    const key = settings.apiKey.trim()
    const label = `${providerLabel(b.providerId)} · ${b.modelName}`
    const ok =
      key &&
      key !== LOCAL_DEFAULTS.apiKeyPlaceholder &&
      settings.inferenceMode === 'cloud'
    return ok
      ? { ready: true, detail: label }
      : {
          ready: false,
          detail:
            settings.inferenceMode === 'local'
              ? `${label} · 当前为本地模式`
              : `${label} · 未填 Key`
        }
  }

  const slots: SlotStatus[] = (['asr', 'vision', 'chat'] as SlotId[]).map((id) => {
    const b = bindings[id]
    const st = slotReady(id)
    return {
      id,
      label: SLOT_META[id].label,
      hint: SLOT_META[id].hint,
      providerId: b.providerId,
      modelName: b.modelName,
      ready: st.ready,
      detail: st.detail
    }
  })

  const sfKey = Boolean(settings.sttApiKey.trim() || (settings.apiKey.trim() && settings.apiKey !== 'ollama'))
  const providers: ModelDashboard['providers'] = [
    {
      id: 'siliconflow',
      label: '硅基流动',
      ready: sfKey && settings.sttBaseUrl.includes('siliconflow'),
      detail: sfKey ? '已配置 Key' : '未配置'
    },
    {
      id: 'openai',
      label: 'OpenAI',
      ready: Boolean(settings.apiKey.startsWith('sk-') && settings.baseUrl.includes('openai.com')),
      detail: settings.baseUrl.includes('openai.com') ? '已指向 OpenAI' : '未使用'
    },
    {
      id: 'local',
      label: '本地套件',
      ready: localAsr && localChatReady,
      detail: `语音${localAsr ? '✓' : '○'} 对话${localChatReady ? '✓' : '○'}`
    },
    {
      id: 'custom',
      label: '自定义',
      ready: Boolean(settings.baseUrl && settings.apiKey && settings.provider === 'custom'),
      detail: settings.provider === 'custom' ? '自定义中' : '可选'
    }
  ]

  const readyCount = slots.filter((s) => s.ready).length
  const allLocal = slots.every((s) => s.providerId === 'local')
  const routingMode: ModelDashboard['routingMode'] = intendsOfficial
    ? 'membership'
    : allLocal
      ? 'local-mixed'
      : 'byok'
  return { slots, providers, readyCount, total: 3, routingMode, membershipActive }
}

export async function applySiliconflow(
  apiKey: string
): Promise<{ settings: AppSettings; dashboard: ModelDashboard }> {
  const next = applySiliconflowRecommend(getSettings(), apiKey)
  saveSettings(next)
  return { settings: next, dashboard: await getModelDashboard() }
}

export async function installLocalSuite(
  onProgress?: (p: { phase: string; message: string; percent?: number }) => void
): Promise<{ settings: AppSettings; dashboard: ModelDashboard; warning?: string }> {
  onProgress?.({ phase: 'ollama', message: '检查并启动 Ollama…' })
  const started = await startOllama()
  if (!started.ok) {
    // continue — ensureLocalModels will try again
  }

  onProgress?.({ phase: 'ollama', message: '安装本地对话模型（文本+视觉）…' })
  await ensureLocalModels(LOCAL_RECOMMEND.chat, LOCAL_RECOMMEND.vision, (p) => {
    onProgress?.({
      phase: 'ollama',
      message: `${p.model}: ${p.status}`,
      percent: p.percent
    })
  })

  onProgress?.({ phase: 'asr', message: '安装本地语音模型（Whisper）…' })
  let asrWarning: string | undefined
  try {
    await ensureLocalAsr((p: AsrProgress) => {
      onProgress?.({
        phase: 'asr',
        message: p.file ? `${p.status} ${p.file}` : p.status,
        percent: p.progress
      })
    })
  } catch (err) {
    asrWarning = err instanceof Error ? err.message : String(err)
  }

  const prev = getSettings()
  const next = applyLocalSuiteRecommend(prev)
  if (asrWarning) {
    // 对话半边已就绪；语音失败时不要强行把 STT 切到坏掉的本地
    next.sttInferenceMode = prev.sttInferenceMode
    next.localSttBaseUrl = prev.localSttBaseUrl
    next.localSttApiKey = prev.localSttApiKey
    next.localSttModel = prev.localSttModel
    next.sttBaseUrl = prev.sttBaseUrl
    next.sttApiKey = prev.sttApiKey
    next.sttModel = prev.sttModel
  }
  saveSettings(next)

  if (asrWarning) {
    onProgress?.({ phase: 'done', message: '对话模型已就绪；本地语音未装上', percent: 100 })
    return {
      settings: next,
      dashboard: await getModelDashboard(),
      warning: `本地对话已就绪，但本地语音失败：${asrWarning}`
    }
  }

  onProgress?.({ phase: 'done', message: '本地套件已就绪', percent: 100 })
  return { settings: next, dashboard: await getModelDashboard() }
}

export async function testSlot(slot: SlotId): Promise<string> {
  const settings = getSettings()
  const bindings = getSlotBindings(settings)
  const b = bindings[slot]

  if (slot === 'asr') {
    if (b.providerId === 'local') {
      if (!isLocalAsrInstalled()) throw new Error('本地语音未安装')
      await ensureLocalAsr()
      return '本地语音模型可用'
    }
    if (!settings.sttApiKey.trim()) throw new Error('请先填写语音 API Key')
    // lightweight: just check tags/models endpoint or a tiny fake — use transcriptions with empty fails
    // Instead hit GET models if available
    const base = settings.sttBaseUrl.replace(/\/+$/, '')
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${settings.sttApiKey.trim()}` }
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`语音服务不可用 (${res.status}): ${t.slice(0, 160)}`)
    }
    return '在线语音服务可用'
  }

  // vision / chat share LLM endpoint
  if (b.providerId === 'local') {
    const ollama = await getOllamaStatus(
      settings.localModelName || LOCAL_DEFAULTS.textModel,
      settings.localVisionModelName || LOCAL_DEFAULTS.visionModel
    )
    if (!ollama.running) throw new Error('Ollama 未运行')
    if (slot === 'vision' && !ollama.visionModelReady) throw new Error('本地视觉模型未就绪')
    if (slot === 'chat' && !ollama.textModelReady) throw new Error('本地文本模型未就绪')
    return `本地${slot === 'vision' ? '视觉' : '文本'}模型可用`
  }

  const reply = await testConnection({
    ...settings,
    inferenceMode: 'cloud',
    modelName: slot === 'chat' ? b.modelName : settings.modelName,
    visionModelName: slot === 'vision' ? b.modelName : settings.visionModelName
  })
  return `连接成功：${reply}`
}
