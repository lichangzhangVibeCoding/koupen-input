import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Contact, KeyFact, Message } from '../../../shared/types'

function splitTags(raw: string): string[] {
  return raw
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function joinTags(tags: string[]): string {
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))].join('，')
}

function parseFacts(raw: string): KeyFact[] {
  try {
    const arr = JSON.parse(raw || '[]') as KeyFact[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function formatChatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return hm
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  if (isYesterday) return `昨天 ${hm}`
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
}

function shouldShowTimeDivider(prev: Message | null, curr: Message): boolean {
  if (!prev) return true
  const a = new Date(prev.capturedAt).getTime()
  const b = new Date(curr.capturedAt).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return true
  return b - a > 5 * 60 * 1000
}

function fromLocalInputValue(local: string): string | undefined {
  if (!local) return undefined
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

export default function ContactDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const contactId = Number(id)
  const [platform, setPlatform] = useState('darwin')
  const [contact, setContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [personaTagInput, setPersonaTagInput] = useState('')
  const [profileTagInput, setProfileTagInput] = useState('')
  const [factInput, setFactInput] = useState('')
  const [fromLocal, setFromLocal] = useState('')
  const [toLocal, setToLocal] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  async function loadMessages(cid: number, from?: string, to?: string) {
    const msgs = await window.vipChat.listMessages(cid, {
      limit: 3000,
      from,
      to
    })
    setMessages(msgs)
  }

  useEffect(() => {
    void window.vipChat.getPlatform().then(setPlatform)
  }, [])

  useEffect(() => {
    if (!contactId) return
    void (async () => {
      const c = await window.vipChat.getContact(contactId)
      setContact(c)
      await loadMessages(contactId)
    })()
  }, [contactId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  function scheduleSave(next: Contact) {
    setContact(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const updated = await window.vipChat.updateContact(next.id, {
            displayName: next.displayName,
            channel: next.channel,
            tags: next.tags,
            personaTitle: next.personaTitle,
            personaPrompt: next.personaPrompt,
            personaTags: next.personaTags,
            profileSummary: next.profileSummary,
            profileTags: next.profileTags,
            keyFacts: next.keyFacts,
            notes: next.notes
          })
          if (updated) setContact(updated)
          setStatus('已自动保存')
        } catch (e) {
          setStatus(e instanceof Error ? e.message : String(e))
        }
      })()
    }, 500)
  }

  const facts = useMemo(() => (contact ? parseFacts(contact.keyFacts) : []), [contact])
  const personaTags = useMemo(
    () => (contact ? splitTags(contact.personaTags) : []),
    [contact]
  )
  const profileTags = useMemo(
    () => (contact ? splitTags(contact.profileTags || contact.tags) : []),
    [contact]
  )

  if (!contact) {
    return (
      <section>
        <p className="status">联系人不存在</p>
        <Link to="/contacts">返回列表</Link>
      </section>
    )
  }

  function addTag(
    kind: 'persona' | 'profile',
    value: string,
    clear: (v: string) => void
  ) {
    const tag = value.trim()
    if (!tag || !contact) return
    if (kind === 'persona') {
      scheduleSave({ ...contact, personaTags: joinTags([...personaTags, tag]) })
    } else {
      const nextTags = joinTags([...profileTags, tag])
      scheduleSave({ ...contact, profileTags: nextTags, tags: nextTags })
    }
    clear('')
  }

  function removeTag(kind: 'persona' | 'profile', tag: string) {
    if (!contact) return
    if (kind === 'persona') {
      scheduleSave({
        ...contact,
        personaTags: joinTags(personaTags.filter((t) => t !== tag))
      })
    } else {
      const next = joinTags(profileTags.filter((t) => t !== tag))
      scheduleSave({ ...contact, profileTags: next, tags: next })
    }
  }

  function addFact() {
    const text = factInput.trim()
    if (!text || !contact) return
    const nextFacts = [
      ...facts,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text,
        createdAt: new Date().toISOString()
      }
    ]
    scheduleSave({ ...contact, keyFacts: JSON.stringify(nextFacts) })
    setFactInput('')
  }

  function removeFact(id: string) {
    if (!contact) return
    scheduleSave({
      ...contact,
      keyFacts: JSON.stringify(facts.filter((f) => f.id !== id))
    })
  }

  async function onRefreshFromChat() {
    if (!contact) return
    setRefreshing(true)
    setStatus('')
    try {
      const updated = await window.vipChat.refreshContactProfile(contact.id)
      if (updated) setContact(updated)
      setStatus('已根据聊天记录更新人设与画像')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    } finally {
      setRefreshing(false)
    }
  }

  async function applyDateFilter() {
    await loadMessages(
      contact.id,
      fromLocalInputValue(fromLocal),
      fromLocalInputValue(toLocal)
    )
  }

  async function clearDateFilter() {
    setFromLocal('')
    setToLocal('')
    await loadMessages(contact.id)
  }

  async function onDelete() {
    if (!confirm(`确认删除「${contact.displayName}」及其全部对话？`)) return
    await window.vipChat.deleteContact(contact.id)
    navigate('/contacts')
  }

  const channelLabel =
    contact.channel === 'wechat' ? '微信' : contact.channel === 'qq' ? 'QQ' : '未知'

  return (
    <section className="contact-detail">
      <div className="contact-detail-head">
        <div>
          <p className="status" style={{ marginBottom: 6 }}>
            <Link to="/contacts">← 联系人列表</Link>
          </p>
          <h2 className="page-title" style={{ marginBottom: 4 }}>
            {contact.displayName}
          </h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            {channelLabel} · 顶部配置人设与画像 · 下方为微信风格聊天记录
          </p>
        </div>
        <div className="row">
          <button
            className="btn"
            disabled={refreshing}
            onClick={() => void onRefreshFromChat()}
          >
            {refreshing ? '分析中…' : '根据聊天更新人设/画像'}
          </button>
          <button className="btn danger" onClick={() => void onDelete()}>
            删除联系人
          </button>
        </div>
      </div>
      {status ? (
        <p className={`status ${status.includes('失败') || status.includes('Error') ? 'err' : 'ok'}`}>
          {status}
        </p>
      ) : null}

      {/* 顶部：我对 TA 的人设（独立配置区） */}
      <div className="config-block">
        <div className="config-block-head">
          <h3>我对 TA 的人设</h3>
          <span className="config-hint">
            针对此联系人的个性化人设，编辑后自动保存；可据历史聊天一键更新并打标签
          </span>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>显示名称</label>
            <input
              value={contact.displayName}
              onChange={(e) => scheduleSave({ ...contact, displayName: e.target.value })}
            />
          </div>
          <div className="field">
            <label>渠道</label>
            <select
              value={contact.channel}
              onChange={(e) =>
                scheduleSave({
                  ...contact,
                  channel: e.target.value as Contact['channel']
                })
              }
            >
              <option value="wechat">微信</option>
              <option value="qq">QQ</option>
              <option value="unknown">未知</option>
            </select>
          </div>
          <div className="field">
            <label>人设名称</label>
            <input
              value={contact.personaTitle}
              onChange={(e) => scheduleSave({ ...contact, personaTitle: e.target.value })}
              placeholder="例如：小甜妹"
            />
          </div>
          <div className="field">
            <label>人设标签</label>
            <div className="tag-row">
              {personaTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="chip"
                  onClick={() => removeTag('persona', t)}
                  title="点击删除"
                >
                  {t} ×
                </button>
              ))}
              <input
                className="tag-input"
                value={personaTagInput}
                placeholder="回车添加标签"
                onChange={(e) => setPersonaTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag('persona', personaTagInput, setPersonaTagInput)
                  }
                }}
              />
            </div>
          </div>
        </div>
        <div className="field">
          <label>人设描述</label>
          <textarea
            value={contact.personaPrompt}
            onChange={(e) => scheduleSave({ ...contact, personaPrompt: e.target.value })}
            placeholder="身份、性格、爱好、说话风格、禁忌…"
            rows={4}
          />
        </div>
      </div>

      {/* 顶部下方：联系人画像（独立配置区） */}
      <div className="config-block">
        <div className="config-block-head">
          <h3>联系人画像</h3>
          <span className="config-hint">
            关键信息随时打标签、记事实；可据聊天自动归纳总结
          </span>
        </div>
        <div className="field">
          <label>画像总结</label>
          <textarea
            value={contact.profileSummary}
            onChange={(e) => scheduleSave({ ...contact, profileSummary: e.target.value })}
            placeholder="对方是谁、偏好、习惯、雷点、关系进展…"
            rows={3}
          />
        </div>
        <div className="field">
          <label>画像 / 关键标签</label>
          <div className="tag-row">
            {profileTags.map((t) => (
              <button
                key={t}
                type="button"
                className="chip chip-profile"
                onClick={() => removeTag('profile', t)}
                title="点击删除"
              >
                {t} ×
              </button>
            ))}
            <input
              className="tag-input"
              value={profileTagInput}
              placeholder="回车添加，如：老朋友、周末约饭"
              onChange={(e) => setProfileTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag('profile', profileTagInput, setProfileTagInput)
                }
              }}
            />
          </div>
        </div>
        <div className="field">
          <label>关键事实记录</label>
          <div className="fact-list">
            {facts.length === 0 ? (
              <p className="status" style={{ margin: 0 }}>
                暂无事实。可手写，或点「根据聊天更新人设/画像」。
              </p>
            ) : (
              facts.map((f) => (
                <div key={f.id} className="fact-item">
                  <div>
                    <div className="fact-text">{f.text}</div>
                    <div className="fact-time">{formatChatTime(f.createdAt)}</div>
                  </div>
                  <button type="button" className="btn danger" onClick={() => removeFact(f.id)}>
                    删
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <input
              style={{ flex: 1, minWidth: 200 }}
              value={factInput}
              onChange={(e) => setFactInput(e.target.value)}
              placeholder="记下一条关键信息，回车添加"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addFact()
                }
              }}
            />
            <button type="button" className="btn secondary" onClick={addFact}>
              添加事实
            </button>
          </div>
        </div>
        <div className="field">
          <label>备注</label>
          <textarea
            value={contact.notes}
            onChange={(e) => scheduleSave({ ...contact, notes: e.target.value })}
            rows={2}
          />
        </div>
      </div>

      {/* 下方：微信风格聊天记录，纵向铺开，可按时间筛选 */}
      <div className="wx-chat">
        <div className="wx-chat-toolbar">
          <div className="wx-chat-title">聊天记录</div>
          <div className="wx-filter">
            <input
              type="datetime-local"
              value={fromLocal}
              onChange={(e) => setFromLocal(e.target.value)}
              title="开始时间"
            />
            <span>至</span>
            <input
              type="datetime-local"
              value={toLocal}
              onChange={(e) => setToLocal(e.target.value)}
              title="结束时间"
            />
            <button type="button" className="btn secondary" onClick={() => void applyDateFilter()}>
              筛选
            </button>
            <button type="button" className="btn secondary" onClick={() => void clearDateFilter()}>
              清除
            </button>
          </div>
        </div>

        <div className="wx-chat-body">
          {messages.length === 0 ? (
            <p className="wx-empty">
              {platform === 'win32'
                ? '该时间段暂无消息。快速双击 Alt（帮你口喷）截屏识别后会出现在这里。'
                : '该时间段暂无消息。快速双击左 Command（帮你口喷）截屏识别后会出现在这里。'}
            </p>
          ) : (
            messages.map((m, idx) => {
              const prev = idx > 0 ? messages[idx - 1] : null
              const showTime = shouldShowTimeDivider(prev, m)
              return (
                <div key={m.id}>
                  {showTime ? (
                    <div className="wx-time-divider">
                      <span>{formatChatTime(m.capturedAt)}</span>
                    </div>
                  ) : null}
                  <div className={`wx-row ${m.role}`}>
                    <div className="wx-avatar">
                      {m.role === 'me' ? '我' : contact.displayName.slice(0, 1)}
                    </div>
                    <div className="wx-bubble-wrap">
                      <div className={`wx-bubble ${m.role}`}>{m.contentText}</div>
                      <div className="wx-msg-time">{formatChatTime(m.capturedAt)}</div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={chatEndRef} />
        </div>
      </div>
    </section>
  )
}
