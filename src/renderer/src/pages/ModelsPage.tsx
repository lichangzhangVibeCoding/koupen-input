import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SILICONFLOW_RECOMMEND, applyOfficialModelRoutes, type SlotId } from '../../../shared/model-slots'
import type { MembershipMe } from '../../../shared/membership'
import PlanTierBadge from '../components/PlanTierBadge'
import { useI18n } from '../i18n'
import {
  AppSettings,
  DEFAULT_SETTINGS,
  LOCAL_DEFAULTS,
  PROVIDER_PRESETS,
  STT_PROVIDER_PRESETS
} from '../../../shared/types'

type Dashboard = Awaited<ReturnType<typeof window.vipChat.getModelDashboard>>
type Scheme = 'official' | 'byok' | 'local'
type Feedback = { type: 'ok' | 'err'; text: string }

const SLOT_SHORT: Record<SlotId, string> = {
  asr: '语音',
  vision: '视觉',
  chat: '回复'
}

function detectSttPreset(form: AppSettings): string {
  if (form.sttInferenceMode === 'local') return ''
  if (form.sttBaseUrl.includes('siliconflow')) return 'siliconflow'
  if (form.sttBaseUrl.includes('openai.com')) return 'openai'
  if (form.sttBaseUrl.trim()) return 'custom'
  return 'siliconflow'
}

function detectChatPreset(form: AppSettings): string {
  if (form.inferenceMode === 'local') return ''
  if (form.baseUrl.includes('siliconflow')) return 'siliconflow'
  if (form.baseUrl.includes('openai.com')) return 'openai'
  if (form.baseUrl.includes('deepseek.com')) return 'deepseek'
  if (form.baseUrl.includes('dashscope.aliyuncs.com')) return 'qwen'
  if (form.baseUrl.includes('moonshot.cn')) return 'moonshot'
  if (form.provider === 'custom' || form.baseUrl.trim()) return 'custom'
  return 'siliconflow'
}

/** 当前生效方案：官方 / 自配 / 本地（三选一）。以表单为准，便于乐观切换立刻亮对卡片。 */
function deriveScheme(form: AppSettings): Scheme {
  if (form.inferenceMode === 'local' && form.sttInferenceMode === 'local') return 'local'
  if (form.modelRoutingMode === 'membership') return 'official'
  return 'byok'
}

function isPlaceholderKey(key: string | undefined): boolean {
  const k = (key || '').trim()
  return !k || k === LOCAL_DEFAULTS.apiKeyPlaceholder || k === 'local'
}

/** 切到自配时恢复可用的云端 Key（避免本地留下的 ollama 占位） */
function restoreCloudKeys(
  s: AppSettings,
  sfKeyHint: string
): Pick<AppSettings, 'apiKey' | 'sttApiKey' | 'provider' | 'baseUrl' | 'sttBaseUrl'> {
  const hint = sfKeyHint.trim()
  const apiKey = !isPlaceholderKey(s.apiKey)
    ? s.apiKey
    : hint || (!isPlaceholderKey(s.sttApiKey) ? s.sttApiKey : '')
  const sttApiKey = !isPlaceholderKey(s.sttApiKey) ? s.sttApiKey : apiKey
  const provider =
    s.provider === 'local' || !s.provider ? 'siliconflow' : s.provider
  const baseUrl =
    !s.baseUrl || s.baseUrl.includes('11434') || s.provider === 'local'
      ? SILICONFLOW_RECOMMEND.baseUrl
      : s.baseUrl
  const sttBaseUrl =
    !s.sttBaseUrl || s.sttInferenceMode === 'local'
      ? SILICONFLOW_RECOMMEND.baseUrl
      : s.sttBaseUrl
  return { apiKey, sttApiKey, provider, baseUrl, sttBaseUrl }
}

function toOfficialSettings(
  s: AppSettings,
  routes?: MembershipMe['modelRoutes'] | null
): AppSettings {
  return applyOfficialModelRoutes(s, routes)
}

function toByokSettings(s: AppSettings, sfKeyHint: string): AppSettings {
  const keys = restoreCloudKeys(s, sfKeyHint)
  return {
    ...s,
    ...keys,
    modelRoutingMode: 'byok',
    inferenceMode: 'cloud',
    sttInferenceMode: 'cloud',
    modelName: s.modelName || SILICONFLOW_RECOMMEND.chat,
    visionModelName: s.visionModelName || SILICONFLOW_RECOMMEND.vision,
    sttModel: s.sttModel || SILICONFLOW_RECOMMEND.asr
  }
}

function toLocalSettings(s: AppSettings): AppSettings {
  return {
    ...s,
    modelRoutingMode: 'byok', // 本地优先于会员代理；路由标记为 byok 避免仪表盘误判官方
    inferenceMode: 'local',
    provider: 'local',
    baseUrl: LOCAL_DEFAULTS.openaiBase,
    apiKey: LOCAL_DEFAULTS.apiKeyPlaceholder,
    modelName: s.localModelName || LOCAL_DEFAULTS.textModel,
    visionModelName: s.localVisionModelName || LOCAL_DEFAULTS.visionModel,
    localModelName: s.localModelName || LOCAL_DEFAULTS.textModel,
    localVisionModelName: s.localVisionModelName || LOCAL_DEFAULTS.visionModel,
    sttInferenceMode: 'local',
    localSttBaseUrl: 'builtin://local-asr',
    localSttApiKey: 'local',
    localSttModel: s.localSttModel || 'whisper-base'
  }
}

export default function ModelsPage() {
  const { brand } = useI18n()
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [form, setForm] = useState<AppSettings>({ ...DEFAULT_SETTINGS })
  const [me, setMe] = useState<MembershipMe | null>(null)
  const [sfKey, setSfKey] = useState('')
  const [pageStatus, setPageStatus] = useState<Feedback | null>(null)
  const [slotFeedback, setSlotFeedback] = useState<Partial<Record<SlotId, Feedback>>>({})
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  /** 切换进行中时先亮目标方案，避免等仪表盘才动 */
  const [pendingScheme, setPendingScheme] = useState<Scheme | null>(null)
  const [expanded, setExpanded] = useState<Record<SlotId, boolean>>({
    asr: false,
    vision: false,
    chat: false
  })
  const switchLock = useRef(false)

  async function refresh() {
    const [d, s] = await Promise.all([
      window.vipChat.getModelDashboard(),
      window.vipChat.getSettings()
    ])
    setDash(d)
    setForm(s)
    setPendingScheme(null)
    if (s.sttApiKey) setSfKey(s.sttApiKey)
    else if (s.apiKey && s.apiKey !== 'ollama') setSfKey(s.apiKey)

    if (s.membershipAccessToken) {
      try {
        setMe((await window.vipChat.membershipGetMe()) as MembershipMe)
      } catch {
        setMe(null)
      }
    } else {
      setMe(null)
    }
  }

  useEffect(() => {
    void refresh()
    const off = window.vipChat.onInstallProgress((p) => {
      setProgress(
        `${p.message}${typeof p.percent === 'number' ? ` ${p.percent}%` : ''}`
      )
    })
    return off
  }, [])

  function patch(p: Partial<AppSettings>) {
    setForm((prev) => ({ ...prev, ...p }))
  }

  async function persist(next: AppSettings, okText: string) {
    await window.vipChat.saveSettings(next)
    setForm(next)
    await refresh()
    setPageStatus({ type: 'ok', text: okText })
  }

  async function switchScheme(target: Scheme) {
    if (switchLock.current) return
    setPageStatus(null)

    // 先按当前表单判断，避免点当前方案还去拉仪表盘
    if (target === deriveScheme(form)) {
      setPendingScheme(null)
      return
    }

    if (target === 'official' && !form.membershipAccessToken?.trim()) {
      setPageStatus({
        type: 'err',
        text: '请先到「个人中心」登录，再切换官方会员（免 Key · 扣积分）'
      })
      return
    }

    switchLock.current = true
    setBusy('scheme')
    setPendingScheme(target)

    let latest = form
    try {
      latest = await window.vipChat.getSettings()
      if (target === 'official' && !latest.membershipAccessToken?.trim()) {
        setPendingScheme(null)
        setPageStatus({
          type: 'err',
          text: '请先到「个人中心」登录，再切换官方会员（免 Key · 扣积分）'
        })
        return
      }

      const next =
        target === 'official'
          ? toOfficialSettings(
              latest,
              (
                await window.vipChat.membershipGetMe().catch(() => null)
              )?.modelRoutes
            )
          : target === 'local'
            ? toLocalSettings(latest)
            : toByokSettings(latest, sfKey)

      const okText =
        target === 'official'
          ? '已切换：官方会员 · 官方优化模型 · 免 Key · 扣积分'
          : target === 'local'
            ? '已切换：本地模型 · 数据不出机 · 本地不费钱'
            : '已切换：自配 Key · 不消耗积分 · 自费模型'

      // 立刻亮目标卡片与面板，后台再落盘 / 刷仪表盘
      setForm(next)
      if (next.apiKey && !isPlaceholderKey(next.apiKey)) setSfKey(next.apiKey)
      setAdvancedOpen(false)

      await window.vipChat.saveSettings(next)
      await refresh()
      setPageStatus({ type: 'ok', text: okText })
    } catch (e) {
      setPendingScheme(null)
      setForm(latest)
      setPageStatus({ type: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      switchLock.current = false
      setBusy('')
    }
  }

  async function onSiliconflow() {
    if (!sfKey.trim()) {
      setPageStatus({ type: 'err', text: '请先填写 API Key' })
      return
    }
    setBusy('sf')
    setPageStatus(null)
    try {
      const res = await window.vipChat.applySiliconflow(sfKey.trim())
      const next = toByokSettings({ ...res.settings, modelRoutingMode: 'byok' }, sfKey.trim())
      await persist(next, '已用硅基推荐填好三槽（自配 Key · 不扣积分）')
    } catch (e) {
      setPageStatus({ type: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy('')
    }
  }

  async function onLocalInstall() {
    setBusy('local')
    setPageStatus(null)
    setProgress('开始安装本地套件…')
    try {
      const latest = await window.vipChat.getSettings()
      // 确保处于本地模式
      await window.vipChat.saveSettings(toLocalSettings(latest))

      const o = await window.vipChat.getOllamaStatus()
      if (!o.installed) {
        await window.vipChat.openOllamaDownload()
        setPageStatus({
          type: 'err',
          text: '请先安装并打开 Ollama，然后回到这里再安装'
        })
        await refresh()
        return
      }
      const res = await window.vipChat.installLocalSuite()
      const next = toLocalSettings(res.settings)
      await window.vipChat.saveSettings(next)
      setForm(next)
      await refresh()
      setPageStatus({
        type: res.warning ? 'err' : 'ok',
        text: res.warning || '本地套件已就绪 · 数据不出机 · 本地不费钱'
      })
      setProgress('')
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e)
      setPageStatus({
        type: 'err',
        text: /sharp|libvips|dlopen/i.test(raw)
          ? '本地语音组件未正确安装。可先用官方会员或自配 Key。'
          : raw.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/i, '').trim() || raw
      })
    } finally {
      setBusy('')
    }
  }

  async function onTest(slot: SlotId) {
    setBusy(`test-${slot}`)
    setSlotFeedback((prev) => ({ ...prev, [slot]: undefined }))
    try {
      await window.vipChat.saveSettings(form)
      const msg = await window.vipChat.testModelSlot(slot)
      setSlotFeedback((prev) => ({ ...prev, [slot]: { type: 'ok', text: msg } }))
      await refresh()
    } catch (e) {
      setSlotFeedback((prev) => ({
        ...prev,
        [slot]: { type: 'err', text: e instanceof Error ? e.message : String(e) }
      }))
    } finally {
      setBusy('')
    }
  }

  async function onSaveSlot(slot: SlotId) {
    setBusy(`save-${slot}`)
    setSlotFeedback((prev) => ({ ...prev, [slot]: undefined }))
    try {
      const next = { ...form, modelRoutingMode: 'byok' as const }
      await window.vipChat.saveSettings(next)
      setForm(next)
      await refresh()
      setSlotFeedback((prev) => ({
        ...prev,
        [slot]: { type: 'ok', text: '已保存' }
      }))
    } catch (e) {
      setSlotFeedback((prev) => ({
        ...prev,
        [slot]: { type: 'err', text: e instanceof Error ? e.message : String(e) }
      }))
    } finally {
      setBusy('')
    }
  }

  function applySttPreset(id: string) {
    const p = STT_PROVIDER_PRESETS.find((x) => x.id === id)
    if (!p) return
    patch({
      sttInferenceMode: 'cloud',
      sttBaseUrl: p.baseUrl || form.sttBaseUrl,
      sttModel: p.modelName || form.sttModel
    })
  }

  function applyChatPreset(id: string) {
    const p = PROVIDER_PRESETS.find((x) => x.id === id)
    if (!p) return
    patch({
      inferenceMode: 'cloud',
      provider: p.id === 'custom' ? 'custom' : p.id === 'siliconflow' ? 'siliconflow' : 'custom',
      baseUrl: p.baseUrl || form.baseUrl,
      modelName: p.modelName || form.modelName,
      visionModelName: p.visionModelName || form.visionModelName
    })
  }

  const slotsOrder: SlotId[] = ['asr', 'vision', 'chat']
  const readyCount = dash?.readyCount ?? 0
  const slotReady = (id: SlotId) => Boolean(dash?.slots.find((s) => s.id === id)?.ready)
  const slotDetail = (id: SlotId) => dash?.slots.find((s) => s.id === id)?.detail || ''
  const loggedIn = Boolean(form.membershipAccessToken?.trim())
  const credits = me?.balance ?? null
  const scheme = deriveScheme(form)
  const switching = busy === 'scheme'

  const schemeHint =
    scheme === 'official'
      ? '官方优化模型 · 免 Key · 按次扣积分'
      : scheme === 'local'
        ? '本地模型 · 数据不出机 · 本地不费钱（不扣积分）'
        : '自配 Key · 不消耗积分 · 模型费用自理'

  return (
    <section className="models-page">
      <h2 className="page-title">模型</h2>
      <p className="page-desc models-desc">
        默认官方会员：先注册登录，三槽走官方优化模型。也可改自配 Key 或本地，不必重复配置三遍。
      </p>

      {/* ① 方案三选一 */}
      <div className="models-scheme" role="radiogroup" aria-label="模型跑法">
        {(
          [
            {
              id: 'official' as const,
              title: '官方会员',
              sub: '官方优化模型 · 免 Key · 扣积分',
              badge: '推荐'
            },
            {
              id: 'byok' as const,
              title: '自配 Key',
              sub: '不消耗积分 · 自费模型'
            },
            {
              id: 'local' as const,
              title: '本地模型',
              sub: '数据不出机 · 本地不费钱'
            }
          ] as const
        ).map((opt) => {
          const selected = scheme === opt.id
          const pending = pendingScheme === opt.id && switching
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`models-scheme-tab${selected ? ' active' : ''}${
                pending ? ' is-pending' : ''
              }`}
              onClick={() => void switchScheme(opt.id)}
            >
              <span className="models-scheme-title">
                <span className={`models-scheme-dot${selected ? ' on' : ''}`} aria-hidden />
                {opt.title}
                {'badge' in opt && opt.badge ? <span className="badge">{opt.badge}</span> : null}
                {selected ? <span className="badge ok">使用中</span> : null}
              </span>
              <span className="models-scheme-sub">{opt.sub}</span>
            </button>
          )
        })}
      </div>

      <p className="models-scheme-hint status">{schemeHint}</p>

      {/* ② 当前方案面板（只显示一个） */}
      <div className="models-panel">
        {scheme === 'official' ? (
          <>
            <p className="models-panel-lead">
              {loggedIn
                ? `当前：官方优化模型${me?.phone ? ` · ${me.phone}` : ''}${
                    credits != null ? ` · 剩余 ${credits} 积分` : ''
                  }`
                : '请先注册或登录，登录后默认使用官方优化模型'}
              {loggedIn && me?.plan ? (
                <>
                  {' · '}
                  <PlanTierBadge planId={me.plan.id} planName={me.plan.name} />
                </>
              ) : null}
            </p>
            <p className="status">
              {loggedIn
                ? '免填 API Key，语音 / 视觉 / 回复走官方优化模型，按次扣积分。不消耗你自己的第三方额度。'
                : '注册即开体验积分。免填 API Key，按次扣积分。也可改用自配 Key 或本地模型。'}
            </p>
            <div className="row models-panel-actions">
              {loggedIn ? (
                <Link className="btn secondary sm" to="/account">
                  套餐与用量
                </Link>
              ) : (
                <Link className="btn" to="/account">
                  去注册 / 登录
                </Link>
              )}
            </div>
          </>
        ) : null}

        {scheme === 'byok' ? (
          <>
            <p className="models-panel-lead">
              自配 Key · 不消耗本产品积分 · 模型费用按你的服务商账单自理。
            </p>
            <p className="status">填一个硅基流动 Key，可一键同步三槽推荐模型；也可在高级里改别家。</p>
            <div className="models-byok-form">
              <input
                type="password"
                value={sfKey}
                onChange={(e) => setSfKey(e.target.value)}
                placeholder="硅基流动 API Key"
              />
              <button className="btn" disabled={busy === 'sf'} onClick={() => void onSiliconflow()}>
                {busy === 'sf' ? '套用中…' : '一键套用推荐'}
              </button>
            </div>
            <ul className="recommend-models compact">
              <li>
                <strong>语音</strong> {SILICONFLOW_RECOMMEND.asr}
              </li>
              <li>
                <strong>视觉</strong> {SILICONFLOW_RECOMMEND.vision}
              </li>
              <li>
                <strong>回复</strong> {SILICONFLOW_RECOMMEND.chat}
              </li>
            </ul>
          </>
        ) : null}

        {scheme === 'local' ? (
          <>
            <p className="models-panel-lead">
              本地模型 · 数据不出机 · 本地不费钱（不扣积分、不耗云端 Key）。
            </p>
            <p className="status">本机 Whisper（语音）+ Ollama（视觉 / 回复）。未就绪时点下方安装。</p>
            <div className="row models-panel-actions">
              <button
                className="btn"
                disabled={busy === 'local' || busy === 'scheme'}
                onClick={() => void onLocalInstall()}
              >
                {busy === 'local' ? '安装中…' : '一键安装 / 修复本地套件'}
              </button>
            </div>
            {progress ? <p className="status">{progress}</p> : null}
          </>
        ) : null}

        {pageStatus ? (
          <p className={`status slot-inline-feedback ${pageStatus.type}`}>{pageStatus.text}</p>
        ) : null}
      </div>

      {/* ③ 三槽 = 当前方案下的能力状态（不是第四种配置） */}
      <div className="models-caps">
        <div className="models-caps-head">
          <h3>能力状态</h3>
          <span className="status">
            当前使用：
            {scheme === 'official' ? '官方会员' : scheme === 'local' ? '本地模型' : '自配 Key'}
            {' · '}
            {readyCount}/3 就绪
            {readyCount === 3 ? ' · 可去首页试用' : ''}
          </span>
          <button className="btn ghost sm" disabled={Boolean(busy)} onClick={() => void refresh()}>
            刷新
          </button>
        </div>
        <div className="models-caps-grid">
          {slotsOrder.map((id) => {
            const ready = slotReady(id)
            const detail =
              scheme === 'official' && ready
                ? '官方优化模型'
                : scheme === 'local' && ready
                  ? slotDetail(id) || '本地就绪'
                  : slotDetail(id) || (ready ? '已配置' : '未就绪')
            return (
              <div key={id} className={`models-cap ${ready ? 'on' : ''}`}>
                <div className="models-cap-top">
                  <span className={`dot ${ready ? 'on' : 'off'}`} />
                  <strong>{SLOT_SHORT[id]}</strong>
                  <span className={`badge ${ready ? 'ok' : 'warn'}`}>
                    {ready ? '就绪' : '未就绪'}
                  </span>
                </div>
                <p className="models-cap-detail">{detail}</p>
                {scheme !== 'official' ? (
                  <button
                    type="button"
                    className="btn ghost sm"
                    disabled={Boolean(busy)}
                    onClick={() => void onTest(id)}
                  >
                    {busy === `test-${id}` ? '检测…' : '测一下'}
                  </button>
                ) : null}
                {slotFeedback[id] ? (
                  <p className={`status slot-inline-feedback ${slotFeedback[id]!.type}`}>
                    {slotFeedback[id]!.text}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {/* ④ 高级：仅自配时暴露；官方/本地不强迫看三槽表单 */}
      {scheme === 'byok' ? (
        <details
          className="models-custom"
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary>
            <span>高级：按槽自定义</span>
            <span className="status">一般不用 · 换服务商 / 改模型名</span>
          </summary>
          <p className="status models-custom-hint">
            视觉与回复共用同一对话服务的地址与 Key。{brand.voice.name} · {brand.reply.name}
          </p>

          <SlotPanel
            id="asr"
            title="语音识别"
            ready={slotReady('asr')}
            detail={slotDetail('asr')}
            expanded={expanded.asr}
            onToggle={() => setExpanded((e) => ({ ...e, asr: !e.asr }))}
            busy={busy}
            onTest={() => void onTest('asr')}
            onSave={() => void onSaveSlot('asr')}
            feedback={slotFeedback.asr}
          >
            <div className="field compact">
              <label>服务商</label>
              <select
                value={detectSttPreset(form)}
                onChange={(e) => {
                  if (e.target.value) applySttPreset(e.target.value)
                }}
              >
                {STT_PROVIDER_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <div className="field compact">
                <label>Base URL</label>
                <input
                  value={form.sttBaseUrl}
                  onChange={(e) => patch({ sttBaseUrl: e.target.value })}
                />
              </div>
              <div className="field compact">
                <label>模型名</label>
                <input
                  value={form.sttModel}
                  onChange={(e) => patch({ sttModel: e.target.value })}
                />
              </div>
            </div>
            <div className="field compact">
              <label>API Key</label>
              <input
                type="password"
                value={form.sttApiKey}
                onChange={(e) => patch({ sttApiKey: e.target.value })}
              />
            </div>
          </SlotPanel>

          <SlotPanel
            id="vision"
            title="视觉理解"
            ready={slotReady('vision')}
            detail={slotDetail('vision')}
            expanded={expanded.vision}
            onToggle={() => setExpanded((e) => ({ ...e, vision: !e.vision }))}
            busy={busy}
            onTest={() => void onTest('vision')}
            onSave={() => void onSaveSlot('vision')}
            feedback={slotFeedback.vision}
          >
            <div className="field compact">
              <label>服务商</label>
              <select
                value={detectChatPreset(form)}
                onChange={(e) => {
                  if (e.target.value) applyChatPreset(e.target.value)
                }}
              >
                {PROVIDER_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <div className="field compact">
                <label>Base URL</label>
                <input value={form.baseUrl} onChange={(e) => patch({ baseUrl: e.target.value })} />
              </div>
              <div className="field compact">
                <label>视觉模型</label>
                <input
                  value={form.visionModelName}
                  onChange={(e) => patch({ visionModelName: e.target.value })}
                />
              </div>
            </div>
            <div className="field compact">
              <label>API Key（与回复共用）</label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => patch({ apiKey: e.target.value })}
              />
            </div>
          </SlotPanel>

          <SlotPanel
            id="chat"
            title="回复生成"
            ready={slotReady('chat')}
            detail={slotDetail('chat')}
            expanded={expanded.chat}
            onToggle={() => setExpanded((e) => ({ ...e, chat: !e.chat }))}
            busy={busy}
            onTest={() => void onTest('chat')}
            onSave={() => void onSaveSlot('chat')}
            feedback={slotFeedback.chat}
          >
            <div className="field-row">
              <div className="field compact">
                <label>服务商</label>
                <select
                  value={detectChatPreset(form)}
                  onChange={(e) => {
                    if (e.target.value) applyChatPreset(e.target.value)
                  }}
                >
                  {PROVIDER_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field compact">
                <label>文本模型</label>
                <input
                  value={form.modelName}
                  onChange={(e) => patch({ modelName: e.target.value })}
                />
              </div>
            </div>
            <p className="status">对话地址与 Key 在「视觉理解」里改。</p>
          </SlotPanel>

          <div className="row" style={{ margin: '4px 14px 12px' }}>
            <button
              className="btn secondary sm"
              disabled={Boolean(busy)}
              onClick={() =>
                void (async () => {
                  setBusy('save')
                  try {
                    await persist({ ...form, modelRoutingMode: 'byok' }, '高级配置已保存')
                  } catch (e) {
                    setPageStatus({
                      type: 'err',
                      text: e instanceof Error ? e.message : String(e)
                    })
                  } finally {
                    setBusy('')
                  }
                })()
              }
            >
              {busy === 'save' ? '保存中…' : '保存高级配置'}
            </button>
          </div>
        </details>
      ) : null}

      {scheme === 'local' ? (
        <details className="models-custom">
          <summary>
            <span>本地模型名（可选）</span>
            <span className="status">一般保持默认即可</span>
          </summary>
          <div className="models-local-names">
            <div className="field compact">
              <label>本地语音</label>
              <input
                value={form.localSttModel}
                onChange={(e) => patch({ localSttModel: e.target.value })}
              />
            </div>
            <div className="field compact">
              <label>本地视觉（Ollama）</label>
              <input
                value={form.localVisionModelName}
                onChange={(e) =>
                  patch({
                    localVisionModelName: e.target.value,
                    visionModelName: e.target.value
                  })
                }
                placeholder={LOCAL_DEFAULTS.visionModel}
              />
            </div>
            <div className="field compact">
              <label>本地文本（Ollama）</label>
              <input
                value={form.localModelName}
                onChange={(e) =>
                  patch({
                    localModelName: e.target.value,
                    modelName: e.target.value
                  })
                }
                placeholder={LOCAL_DEFAULTS.textModel}
              />
            </div>
            <button
              className="btn secondary sm"
              disabled={Boolean(busy)}
              onClick={() =>
                void (async () => {
                  setBusy('save')
                  try {
                    await persist(
                      {
                        ...form,
                        modelRoutingMode: 'byok',
                        inferenceMode: 'local',
                        sttInferenceMode: 'local',
                        provider: 'local'
                      },
                      '本地模型名已保存'
                    )
                  } catch (e) {
                    setPageStatus({
                      type: 'err',
                      text: e instanceof Error ? e.message : String(e)
                    })
                  } finally {
                    setBusy('')
                  }
                })()
              }
            >
              保存
            </button>
          </div>
        </details>
      ) : null}

      <p className="status models-footer">
        快捷键与权限在 <Link to="/settings">设置</Link>
        {' · '}
        套餐与登录在 <Link to="/account">个人中心</Link>
      </p>
    </section>
  )
}

function SlotPanel(props: {
  id: SlotId
  title: string
  ready: boolean
  detail: string
  expanded: boolean
  onToggle: () => void
  busy: string
  onTest: () => void
  onSave: () => void
  feedback?: Feedback
  children: ReactNode
}) {
  const { title, ready, detail, expanded, onToggle, busy, onTest, onSave, feedback, children, id } =
    props

  return (
    <div className={`slot-config-card compact ${ready ? 'ready' : ''}`}>
      <button type="button" className="slot-config-head" onClick={onToggle}>
        <div className="slot-title">
          <span className={`dot ${ready ? 'on' : 'off'}`} />
          <span>{title}</span>
          <span className={`badge ${ready ? 'ok' : 'warn'}`}>{ready ? '就绪' : '未就绪'}</span>
        </div>
        <span className="slot-chevron">{expanded ? '收起' : '展开'}</span>
      </button>
      {!expanded ? (
        <p className="slot-status one-line">{detail}</p>
      ) : (
        <div className="slot-config-body">
          {children}
          <div className="row slot-actions">
            <button className="btn sm" disabled={Boolean(busy)} onClick={onSave}>
              {busy === `save-${id}` ? '保存中…' : '保存本槽'}
            </button>
            <button className="btn secondary sm" disabled={Boolean(busy)} onClick={onTest}>
              {busy === `test-${id}` ? '检测中…' : '测一下'}
            </button>
          </div>
          {feedback ? (
            <p className={`status slot-inline-feedback ${feedback.type}`}>{feedback.text}</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
