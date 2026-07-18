import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BRAND } from '../../../shared/brand'
import { SILICONFLOW_RECOMMEND, type SlotId } from '../../../shared/model-slots'
import {
  AppSettings,
  DEFAULT_SETTINGS,
  LOCAL_DEFAULTS,
  PROVIDER_PRESETS,
  STT_PROVIDER_PRESETS
} from '../../../shared/types'

type Dashboard = Awaited<ReturnType<typeof window.vipChat.getModelDashboard>>
type Mode = 'local' | 'cloud'
type Feedback = { type: 'ok' | 'err'; text: string }

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

export default function ModelsPage() {
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [form, setForm] = useState<AppSettings>({ ...DEFAULT_SETTINGS })
  const [sfKey, setSfKey] = useState('')
  const [pageStatus, setPageStatus] = useState<Feedback | null>(null)
  const [slotFeedback, setSlotFeedback] = useState<Partial<Record<SlotId, Feedback>>>({})
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState('')
  const [expanded, setExpanded] = useState<Record<SlotId, boolean>>({
    asr: true,
    vision: true,
    chat: true
  })

  async function refresh() {
    const [d, s] = await Promise.all([
      window.vipChat.getModelDashboard(),
      window.vipChat.getSettings()
    ])
    setDash(d)
    setForm(s)
    if (s.sttApiKey) setSfKey(s.sttApiKey)
    else if (s.apiKey && s.apiKey !== 'ollama') setSfKey(s.apiKey)
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

  async function saveAll(next?: AppSettings) {
    const payload = next || form
    setBusy('save')
    setPageStatus(null)
    try {
      await window.vipChat.saveSettings(payload)
      setForm(payload)
      await refresh()
      setPageStatus({ type: 'ok', text: '模型配置已保存' })
    } catch (e) {
      setPageStatus({ type: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy('')
    }
  }

  async function onSiliconflow() {
    if (!sfKey.trim()) {
      setPageStatus({ type: 'err', text: '请先填写硅基流动 API Key' })
      return
    }
    setBusy('sf')
    setPageStatus(null)
    try {
      const res = await window.vipChat.applySiliconflow(sfKey.trim())
      setDash(res.dashboard)
      setForm(res.settings)
      setSfKey(sfKey.trim())
      setPageStatus({ type: 'ok', text: '已套用硅基推荐：下方三槽已同步为硅基流动' })
    } catch (e) {
      setPageStatus({ type: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy('')
    }
  }

  async function onLocalSuite() {
    setBusy('local')
    setPageStatus(null)
    setProgress('开始安装本地套件…')
    try {
      const o = await window.vipChat.getOllamaStatus()
      if (!o.installed) {
        await window.vipChat.openOllamaDownload()
        setPageStatus({
          type: 'err',
          text: '请先安装并打开 Ollama，然后回到这里再点「一键安装本地套件」'
        })
        return
      }
      const res = await window.vipChat.installLocalSuite()
      setDash(res.dashboard)
      setForm(res.settings)
      setPageStatus({ type: 'ok', text: '本地套件已就绪，三槽已切到本地' })
      setProgress('')
    } catch (e) {
      setPageStatus({ type: 'err', text: e instanceof Error ? e.message : String(e) })
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
      setSlotFeedback((prev) => ({
        ...prev,
        [slot]: { type: 'ok', text: msg }
      }))
      await refresh()
    } catch (e) {
      setSlotFeedback((prev) => ({
        ...prev,
        [slot]: {
          type: 'err',
          text: e instanceof Error ? e.message : String(e)
        }
      }))
    } finally {
      setBusy('')
    }
  }

  async function onSaveSlot(slot: SlotId) {
    setBusy(`save-${slot}`)
    setSlotFeedback((prev) => ({ ...prev, [slot]: undefined }))
    try {
      await window.vipChat.saveSettings(form)
      await refresh()
      setSlotFeedback((prev) => ({
        ...prev,
        [slot]: { type: 'ok', text: '本槽配置已保存' }
      }))
    } catch (e) {
      setSlotFeedback((prev) => ({
        ...prev,
        [slot]: {
          type: 'err',
          text: e instanceof Error ? e.message : String(e)
        }
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

  function setAsrMode(mode: Mode) {
    if (mode === 'local') {
      patch({
        sttInferenceMode: 'local',
        localSttBaseUrl: 'builtin://local-asr',
        localSttModel: form.localSttModel || 'whisper-base',
        localSttApiKey: 'local'
      })
    } else {
      patch({ sttInferenceMode: 'cloud' })
    }
  }

  function setReplyMode(mode: Mode) {
    if (mode === 'local') {
      patch({
        inferenceMode: 'local',
        provider: 'local',
        baseUrl: LOCAL_DEFAULTS.openaiBase,
        apiKey: LOCAL_DEFAULTS.apiKeyPlaceholder,
        modelName: form.localModelName || LOCAL_DEFAULTS.textModel,
        visionModelName: form.localVisionModelName || LOCAL_DEFAULTS.visionModel
      })
    } else {
      patch({
        inferenceMode: 'cloud',
        provider: form.provider === 'local' ? 'siliconflow' : form.provider
      })
    }
  }

  const slotsOrder: SlotId[] = ['asr', 'vision', 'chat']
  const readyCount = dash?.readyCount ?? 0
  const slotReady = (id: SlotId) => Boolean(dash?.slots.find((s) => s.id === id)?.ready)
  const slotDetail = (id: SlotId) => dash?.slots.find((s) => s.id === id)?.detail || ''

  return (
    <section className="models-page">
      <h2 className="page-title">模型</h2>
      <p className="page-desc">
        三个能力各自配置：{BRAND.voice.name}（语音）· {BRAND.reply.name}（截图理解 + 回复）。
        可先用快捷推荐，再按槽微调。
      </p>

      <div className="models-status-bar">
        <div>
          <strong>{readyCount}/3 已就绪</strong>
          <span className="status" style={{ marginLeft: 10 }}>
            {readyCount === 3
              ? '可以去首页试用了'
              : `还差：${dash?.slots.filter((s) => !s.ready).map((s) => s.label).join('、') || '—'}`}
          </span>
        </div>
        <button className="btn secondary" disabled={Boolean(busy)} onClick={() => void refresh()}>
          刷新状态
        </button>
      </div>

      <div className="progress-3">
        {slotsOrder.map((id) => (
          <div key={id} className={`progress-segment ${slotReady(id) ? 'ready' : ''}`} />
        ))}
      </div>

      {/* 快捷上手 */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <h3 className="settings-section-header" style={{ marginTop: 0 }}>
          快捷上手（可选）
        </h3>
        <p className="status" style={{ marginTop: 0 }}>
          不想逐项填时，二选一即可把三槽写好；之后仍可在下方单独改。
        </p>
        <div className="grid-2" style={{ marginTop: 12 }}>
          <div className="recommend-box">
            <h4>
              在线 · 硅基流动
              <span className="badge">最快上手</span>
            </h4>
            <p className="status">填 Key 后一点，三槽同步为：</p>
            <ul className="recommend-models">
              <li>
                <strong>语音</strong> {SILICONFLOW_RECOMMEND.asr}
              </li>
              <li>
                <strong>截图</strong> {SILICONFLOW_RECOMMEND.vision}
              </li>
              <li>
                <strong>回复</strong> {SILICONFLOW_RECOMMEND.chat}
              </li>
            </ul>
            <input
              type="password"
              value={sfKey}
              onChange={(e) => setSfKey(e.target.value)}
              placeholder="硅基流动 API Key"
              style={{ width: '100%' }}
            />
            <button className="btn" disabled={busy === 'sf'} onClick={() => void onSiliconflow()}>
              {busy === 'sf' ? '套用中…' : '使用硅基推荐并同步下方'}
            </button>
            {pageStatus && busy !== 'local' ? (
              <p className={`status slot-inline-feedback ${pageStatus.type}`}>{pageStatus.text}</p>
            ) : null}
          </div>
          <div className="recommend-box">
            <h4>
              本地套件
              <span className="badge">无需 Key</span>
            </h4>
            <p className="status">安装本地语音（Whisper）+ 本地对话（Ollama）</p>
            <button className="btn" disabled={busy === 'local'} onClick={() => void onLocalSuite()}>
              {busy === 'local' ? '安装中…' : '一键安装并启用'}
            </button>
            {progress ? <p className="status">{progress}</p> : null}
            {pageStatus && busy === 'local' ? (
              <p className={`status slot-inline-feedback ${pageStatus.type}`}>{pageStatus.text}</p>
            ) : null}
          </div>
        </div>
      </div>

      <h3 className="models-section-title">三个模型配置</h3>
      <p className="status" style={{ marginTop: -4, marginBottom: 12 }}>
        截图理解与回复生成共用「对话服务」的地址与 Key，模型名可分别填写。
      </p>

      {/* —— 槽 A：语音 —— */}
      <SlotPanel
        id="asr"
        title="1 · 语音识别"
        brand={BRAND.voice.name}
        blurb={BRAND.voice.blurb}
        ready={slotReady('asr')}
        detail={slotDetail('asr')}
        expanded={expanded.asr}
        onToggle={() => setExpanded((e) => ({ ...e, asr: !e.asr }))}
        busy={busy}
        onTest={() => void onTest('asr')}
        onSave={() => void onSaveSlot('asr')}
        feedback={slotFeedback.asr}
      >
        <div className="mode-toggle">
          <button
            type="button"
            className={form.sttInferenceMode === 'local' ? 'active' : ''}
            onClick={() => setAsrMode('local')}
          >
            本地
          </button>
          <button
            type="button"
            className={form.sttInferenceMode === 'cloud' ? 'active' : ''}
            onClick={() => setAsrMode('cloud')}
          >
            在线
          </button>
        </div>

        {form.sttInferenceMode === 'local' ? (
          <>
            <div className="field">
              <label>本地引擎</label>
              <select
                value={
                  form.localSttBaseUrl.startsWith('builtin://') ? 'builtin' : 'custom'
                }
                onChange={(e) => {
                  if (e.target.value === 'builtin') {
                    patch({
                      localSttBaseUrl: 'builtin://local-asr',
                      localSttModel: 'whisper-base',
                      localSttApiKey: 'local'
                    })
                  } else {
                    patch({
                      localSttBaseUrl: LOCAL_DEFAULTS.sttBase,
                      localSttModel: LOCAL_DEFAULTS.sttModel,
                      localSttApiKey: 'local'
                    })
                  }
                }}
              >
                <option value="builtin">内置 Whisper（推荐，随本地套件安装）</option>
                <option value="custom">自定义 Whisper 兼容服务</option>
              </select>
            </div>
            {!form.localSttBaseUrl.startsWith('builtin://') ? (
              <>
                <div className="field">
                  <label>本地 Base URL</label>
                  <input
                    value={form.localSttBaseUrl}
                    onChange={(e) => patch({ localSttBaseUrl: e.target.value })}
                    placeholder="http://127.0.0.1:9000/v1"
                  />
                </div>
                <div className="field">
                  <label>模型名</label>
                  <input
                    value={form.localSttModel}
                    onChange={(e) => patch({ localSttModel: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <p className="status">使用内置 whisper-base。未安装时请点上方「一键安装本地套件」。</p>
            )}
          </>
        ) : (
          <>
            <div className="field">
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
            <div className="field">
              <label>Base URL</label>
              <input
                value={form.sttBaseUrl}
                onChange={(e) => patch({ sttBaseUrl: e.target.value })}
                placeholder="https://api.siliconflow.cn/v1"
              />
            </div>
            <div className="field">
              <label>API Key</label>
              <input
                type="password"
                value={form.sttApiKey}
                onChange={(e) => patch({ sttApiKey: e.target.value })}
                placeholder="语音转写 Key"
              />
            </div>
            <div className="field">
              <label>模型名</label>
              <input
                value={form.sttModel}
                onChange={(e) => patch({ sttModel: e.target.value })}
                placeholder="FunAudioLLM/SenseVoiceSmall"
              />
            </div>
          </>
        )}
      </SlotPanel>

      {/* —— 槽 B：截图 —— */}
      <SlotPanel
        id="vision"
        title="2 · 截图理解"
        brand={BRAND.reply.name}
        blurb="看懂当前聊天窗口里的联系人与对话"
        ready={slotReady('vision')}
        detail={slotDetail('vision')}
        expanded={expanded.vision}
        onToggle={() => setExpanded((e) => ({ ...e, vision: !e.vision }))}
        busy={busy}
        onTest={() => void onTest('vision')}
        onSave={() => void onSaveSlot('vision')}
        feedback={slotFeedback.vision}
      >
        <div className="mode-toggle">
          <button
            type="button"
            className={form.inferenceMode === 'local' ? 'active' : ''}
            onClick={() => setReplyMode('local')}
          >
            本地
          </button>
          <button
            type="button"
            className={form.inferenceMode === 'cloud' ? 'active' : ''}
            onClick={() => setReplyMode('cloud')}
          >
            在线
          </button>
        </div>
        <p className="status" style={{ marginTop: 0 }}>
          与「回复生成」共用对话服务地址与 Key；此处只配视觉模型名。
        </p>

        {form.inferenceMode === 'local' ? (
          <div className="field">
            <label>本地视觉模型（Ollama）</label>
            <input
              value={form.localVisionModelName}
              onChange={(e) =>
                patch({
                  localVisionModelName: e.target.value,
                  visionModelName: e.target.value
                })
              }
              placeholder="moondream"
            />
          </div>
        ) : (
          <>
            <div className="field">
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
            <div className="field">
              <label>Base URL（对话服务共用）</label>
              <input
                value={form.baseUrl}
                onChange={(e) => patch({ baseUrl: e.target.value })}
              />
            </div>
            <div className="field">
              <label>API Key（对话服务共用）</label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => patch({ apiKey: e.target.value })}
              />
            </div>
            <div className="field">
              <label>视觉模型名</label>
              <input
                value={form.visionModelName}
                onChange={(e) => patch({ visionModelName: e.target.value })}
                placeholder={SILICONFLOW_RECOMMEND.vision}
              />
            </div>
          </>
        )}
      </SlotPanel>

      {/* —— 槽 C：回复 —— */}
      <SlotPanel
        id="chat"
        title="3 · 回复生成"
        brand={BRAND.reply.name}
        blurb="按人设与记忆写出下一条回复"
        ready={slotReady('chat')}
        detail={slotDetail('chat')}
        expanded={expanded.chat}
        onToggle={() => setExpanded((e) => ({ ...e, chat: !e.chat }))}
        busy={busy}
        onTest={() => void onTest('chat')}
        onSave={() => void onSaveSlot('chat')}
        feedback={slotFeedback.chat}
      >
        <div className="mode-toggle">
          <button
            type="button"
            className={form.inferenceMode === 'local' ? 'active' : ''}
            onClick={() => setReplyMode('local')}
          >
            本地
          </button>
          <button
            type="button"
            className={form.inferenceMode === 'cloud' ? 'active' : ''}
            onClick={() => setReplyMode('cloud')}
          >
            在线
          </button>
        </div>
        <p className="status" style={{ marginTop: 0 }}>
          与「截图理解」共用对话服务；此处只配文本回复模型名。
        </p>

        {form.inferenceMode === 'local' ? (
          <div className="field">
            <label>本地文本模型（Ollama）</label>
            <input
              value={form.localModelName}
              onChange={(e) =>
                patch({
                  localModelName: e.target.value,
                  modelName: e.target.value
                })
              }
              placeholder="qwen2.5:3b"
            />
          </div>
        ) : (
          <>
            <div className="field">
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
            <div className="field">
              <label>文本模型名</label>
              <input
                value={form.modelName}
                onChange={(e) => patch({ modelName: e.target.value })}
                placeholder="deepseek-ai/DeepSeek-V3"
              />
            </div>
          </>
        )}
        {form.inferenceMode === 'cloud' ? (
          <p className="status">
            当前服务：{form.baseUrl || '（未填 Base URL）'} · Key{' '}
            {form.apiKey && form.apiKey !== 'ollama' ? '已填写' : '未填写'}
            （在「截图理解」槽可改）
          </p>
        ) : null}
      </SlotPanel>

      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn" disabled={Boolean(busy)} onClick={() => void saveAll()}>
          {busy === 'save' ? '保存中…' : '保存全部配置'}
        </button>
      </div>
      {pageStatus && busy !== 'sf' && busy !== 'local' ? (
        <p className={`status slot-inline-feedback ${pageStatus.type}`}>{pageStatus.text}</p>
      ) : null}

      <p className="status" style={{ marginTop: 18 }}>
        快捷键与权限说明在 <Link to="/settings">设置</Link>。
      </p>
    </section>
  )
}

function SlotPanel(props: {
  id: SlotId
  title: string
  brand: string
  blurb: string
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
  const {
    title,
    brand,
    blurb,
    ready,
    detail,
    expanded,
    onToggle,
    busy,
    onTest,
    onSave,
    feedback,
    children,
    id
  } = props

  return (
    <div className={`slot-config-card ${ready ? 'ready' : ''}`}>
      <button type="button" className="slot-config-head" onClick={onToggle}>
        <div className="slot-title">
          <span className={`dot ${ready ? 'on' : 'off'}`} />
          <span>{title}</span>
          <span className="badge">{brand}</span>
          <span className={`badge ${ready ? 'ok' : 'warn'}`}>
            {ready ? '已就绪' : '未就绪'}
          </span>
        </div>
        <span className="slot-chevron">{expanded ? '收起' : '展开'}</span>
      </button>
      <p className="slot-hint">{blurb}</p>
      {detail ? <p className="slot-status">{detail}</p> : null}

      {expanded ? (
        <div className="slot-config-body">
          {children}
          <div className="row slot-actions">
            <button
              className="btn"
              disabled={Boolean(busy)}
              onClick={onSave}
            >
              {busy === `save-${id}` ? '保存中…' : '保存本槽'}
            </button>
            <button className="btn secondary" disabled={Boolean(busy)} onClick={onTest}>
              {busy === `test-${id}` ? '检测中…' : '测一下'}
            </button>
          </div>
          {feedback ? (
            <p className={`status slot-inline-feedback ${feedback.type}`}>{feedback.text}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
