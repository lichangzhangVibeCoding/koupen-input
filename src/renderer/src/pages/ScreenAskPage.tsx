import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ScreenAskMessage, ScreenAskSession } from '../../../shared/types'
import { useI18n } from '../i18n'

function formatRelTime(iso: string, locale: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return locale.startsWith('zh') ? '刚刚' : 'Just now'
  if (min < 60) return locale.startsWith('zh') ? `${min} 分钟前` : `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return locale.startsWith('zh') ? `${hr} 小时前` : `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return locale.startsWith('zh') ? `${day} 天前` : `${day}d ago`
  return new Date(iso).toLocaleDateString(locale.startsWith('zh') ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric'
  })
}

function formatMsgTime(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(locale.startsWith('zh') ? 'zh-CN' : 'en-US', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function ShotThumb({ path }: { path: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void window.vipChat.readScreenAskImage(path).then((url) => {
      if (alive) setSrc(url)
    })
    return () => {
      alive = false
    }
  }, [path])
  if (!src) {
    return <div className="sa-shot sa-shot-loading" aria-hidden />
  }
  return <img className="sa-shot" src={src} alt="" />
}

export default function ScreenAskPage() {
  const { t, brand, locale } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const sessionId = id ? Number(id) : null
  const threadRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const [sessions, setSessions] = useState<ScreenAskSession[]>([])
  const [messages, setMessages] = useState<ScreenAskMessage[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [session, setSession] = useState<ScreenAskSession | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState('')
  const [composerMsg, setComposerMsg] = useState('')

  async function refreshList() {
    setSessions(await window.vipChat.listScreenAskSessions())
    setActiveId(await window.vipChat.getActiveScreenAskSession())
  }

  async function refreshDetail(sid: number) {
    const [s, msgs] = await Promise.all([
      window.vipChat.getScreenAskSession(sid),
      window.vipChat.listScreenAskMessages(sid)
    ])
    setSession(s)
    setMessages(msgs)
  }

  useEffect(() => {
    void refreshList()
    return window.vipChat.onScreenAskUpdated((sid) => {
      void refreshList()
      if (sessionId === sid) void refreshDetail(sid)
      else if (!sessionId) navigate(`/chats/${sid}`)
    })
  }, [sessionId, navigate])

  useEffect(() => {
    if (!sessionId || Number.isNaN(sessionId)) {
      setSession(null)
      setMessages([])
      return
    }
    void (async () => {
      await window.vipChat.setActiveScreenAskSession(sessionId)
      setActiveId(sessionId)
      await refreshDetail(sessionId)
      inputRef.current?.focus()
    })()
  }, [sessionId])

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length, sessionId])

  async function onNew() {
    const sid = await window.vipChat.newScreenAskSession()
    await refreshList()
    navigate(`/chats/${sid}`)
  }

  async function onDelete(sid: number, e?: MouseEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    if (!window.confirm(t('screenAsk.deleteConfirm'))) return
    const idx = sessions.findIndex((s) => s.id === sid)
    const neighbor = idx >= 0 ? sessions[idx + 1] || sessions[idx - 1] : undefined
    await window.vipChat.deleteScreenAskSession(sid)
    await refreshList()
    if (sessionId === sid) {
      if (neighbor) navigate(`/chats/${neighbor.id}`)
      else navigate('/chats')
    }
  }

  function isCancelledError(e: unknown): boolean {
    if (!e || typeof e !== 'object') return false
    const err = e as { name?: string; message?: string }
    if (err.name === 'TaskCancelledError' || err.name === 'AbortError') return true
    return typeof err.message === 'string' && /aborted|CANCELLED/i.test(err.message)
  }

  async function onSendText() {
    const q = draft.trim()
    if (!q || busy) return
    setBusy('text')
    setComposerMsg('')
    try {
      if (sessionId) {
        await window.vipChat.setActiveScreenAskSession(sessionId)
      }
      const ok = await window.vipChat.askScreenText(q)
      if (!ok) return
      setDraft('')
      if (sessionId) await refreshDetail(sessionId)
      await refreshList()
      inputRef.current?.focus()
    } catch (e) {
      if (isCancelledError(e)) return
      setComposerMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  async function onVoiceContinue() {
    if (busy) return
    setBusy('voice')
    setComposerMsg('')
    try {
      if (sessionId) {
        await window.vipChat.setActiveScreenAskSession(sessionId)
      }
      await window.vipChat.runScreenAsk()
    } catch (e) {
      setComposerMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  const hasSession = Boolean(sessionId && session)

  return (
    <section className="sa-layout">
      <aside className="sa-sidebar">
        <div className="sa-sidebar-head">
          <div>
            <h2 className="sa-sidebar-title">{t('nav.chats')}</h2>
            <p className="sa-sidebar-sub">{brand.screenAsk.name}</p>
          </div>
          <button type="button" className="btn sm sa-new-btn" onClick={() => void onNew()}>
            {t('screenAsk.newChat')}
          </button>
        </div>
        {sessions.length === 0 ? (
          <div className="sa-empty-list">
            <p>{t('screenAsk.listEmpty')}</p>
            <button type="button" className="btn sm" onClick={() => void onNew()}>
              {t('screenAsk.newChat')}
            </button>
          </div>
        ) : (
          <ul className="sa-session-list">
            {sessions.map((s) => {
              const selected = sessionId === s.id
              const live = activeId === s.id
              return (
                <li key={s.id}>
                  <Link
                    to={`/chats/${s.id}`}
                    className={`sa-session-item${selected ? ' active' : ''}${live ? ' live' : ''}`}
                  >
                    <div className="sa-session-top">
                      <strong>{s.title || t('screenAsk.newTitle')}</strong>
                      <time>{formatRelTime(s.updatedAt || s.createdAt, locale)}</time>
                    </div>
                    <span className="sa-session-preview">
                      {s.preview || t('screenAsk.noPreview')}
                    </span>
                    <div className="sa-session-meta">
                      {live ? <em className="sa-active-tag">{t('screenAsk.activeBadge')}</em> : null}
                      <button
                        type="button"
                        className="sa-session-del"
                        title={t('screenAsk.delete')}
                        aria-label={t('screenAsk.delete')}
                        onClick={(e) => void onDelete(s.id, e)}
                      >
                        ×
                      </button>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      <div className="sa-main">
        {!hasSession ? (
          <div className="sa-empty-main">
            <div className="sa-empty-card">
              <span className="sa-empty-mark" aria-hidden />
              <h3>{t('screenAsk.emptyTitle')}</h3>
              <p>{t('screenAsk.selectHint')}</p>
              <div className="sa-empty-actions">
                <button type="button" className="btn" onClick={() => void onNew()}>
                  {t('screenAsk.newChat')}
                </button>
                <p className="sa-empty-tip">{t('screenAsk.emptyTip')}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="sa-main-head">
              <div className="sa-main-head-copy">
                <h2 className="sa-main-title">{session!.title || t('screenAsk.newTitle')}</h2>
                <p className="sa-main-hint">{t('screenAsk.continueHint')}</p>
              </div>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => void onDelete(session!.id)}
              >
                {t('screenAsk.delete')}
              </button>
            </div>

            <div className="sa-thread" ref={threadRef}>
              {messages.length === 0 ? (
                <div className="sa-thread-empty">
                  <p>{t('screenAsk.emptyThread')}</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`sa-turn ${m.role === 'user' ? 'user' : 'assistant'}`}
                  >
                    {m.screenshotPath ? (
                      <div className="sa-shot-wrap">
                        <div className="sa-shot-label">{t('screenAsk.screenshot')}</div>
                        <ShotThumb path={m.screenshotPath} />
                      </div>
                    ) : null}
                    <div className="sa-bubble">{m.contentText}</div>
                    <div className="sa-time">{formatMsgTime(m.capturedAt, locale)}</div>
                  </div>
                ))
              )}
            </div>

            <div className="sa-composer">
              <div className="sa-composer-box">
                <textarea
                  ref={inputRef}
                  className="sa-composer-input"
                  rows={2}
                  value={draft}
                  disabled={Boolean(busy)}
                  placeholder={t('screenAsk.composerPlaceholder')}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void onSendText()
                    }
                  }}
                />
                <div className="sa-composer-bar">
                  <button
                    type="button"
                    className="btn secondary sm"
                    disabled={Boolean(busy)}
                    onClick={() => void onVoiceContinue()}
                  >
                    {busy === 'voice' ? t('screenAsk.sending') : t('screenAsk.voiceContinue')}
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    disabled={Boolean(busy) || !draft.trim()}
                    onClick={() => void onSendText()}
                  >
                    {busy === 'text' ? t('screenAsk.sending') : t('screenAsk.sendText')}
                  </button>
                </div>
              </div>
              {composerMsg ? <p className="status err sa-composer-msg">{composerMsg}</p> : null}
              <p className="sa-composer-hint">{t('screenAsk.composerHint')}</p>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
