import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import type { AppSettings } from '../../../shared/types'
import type {
  MembershipLedgerEntry,
  MembershipMe
} from '../../../shared/membership'
import {
  maskPhone,
  membershipAvatarGlyph,
  membershipDisplayLabel,
  membershipPlanRank
} from '../../../shared/membership'
import { applyOfficialModelRoutes } from '../../../shared/model-slots'
import {
  buildPlanFeatureLines,
  isPlanFeatured,
  planBlurbKey,
  sortPlansByCatalog
} from '../../../shared/plan-catalog'
import PlanTierBadge from '../components/PlanTierBadge'
import { useI18n } from '../i18n'

type AuthTab = 'login' | 'register'
type LedgerDays = 1 | 7 | 30

type PlanRow = {
  id: string
  name: string
  monthlyCredits: number
  baseCredits?: number
  giftCredits?: number
  priceMonthCents: number
  priceYearCents: number
}

type PlansPayload = {
  plans: PlanRow[]
  topup: { credits: number; priceCents: number }
  ops: { paymentHint: string; supportContact: string }
  prices: Record<string, number>
  stripeEnabled?: boolean
}

function extractWechatId(contact: string): string {
  const s = (contact || '').trim()
  if (!s) return ''
  const m =
    s.match(/(?:客服)?微信\s*[：:]\s*([^\s，,；;]+)/) ||
    s.match(/wechat\s*[：:]\s*([^\s,;]+)/i) ||
    s.match(/wx\s*[：:]\s*([^\s,;]+)/i)
  if (m?.[1]) return m[1]
  return s.replace(/^(?:客服)?微信\s*[：:]\s*/i, '').trim() || s
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

function formatCycleTime(iso: string): string {
  const raw = (iso || '').trim()
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    return raw.replace('T', ' ').replace(/\.\d+Z?$/, '').slice(0, 19)
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function reasonLabel(
  reason: string,
  t: (k: Parameters<ReturnType<typeof useI18n>['t']>[0]) => string
): string {
  const map: Record<string, Parameters<ReturnType<typeof useI18n>['t']>[0]> = {
    voice: 'membership.reason.voice',
    reply: 'membership.reason.reply',
    screen_ask: 'membership.reason.screen_ask',
    screen_quiz: 'membership.reason.screen_quiz',
    monthly_reset: 'membership.reason.monthly_reset',
    redeem: 'membership.reason.redeem',
    offline_topup: 'membership.reason.offline_topup'
  }
  return t(map[reason] || 'membership.reason.other')
}

/** 个人中心：登录/注册 + 套餐与用量 */
export default function AccountPage() {
  const { t } = useI18n()
  const location = useLocation()
  const [form, setForm] = useState<AppSettings | null>(null)
  const [me, setMe] = useState<MembershipMe | null>(null)
  const [authTab, setAuthTab] = useState<AuthTab>('login')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [redeem, setRedeem] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [billing, setBilling] = useState<'month' | 'year'>('month')
  const [plans, setPlans] = useState<PlansPayload | null>(null)
  const [ledgerDays, setLedgerDays] = useState<LedgerDays>(7)
  const [ledger, setLedger] = useState<MembershipLedgerEntry[]>([])
  const [ledgerBusy, setLedgerBusy] = useState(false)
  const [editingNick, setEditingNick] = useState(false)
  const [nickDraft, setNickDraft] = useState('')
  const [nickBusy, setNickBusy] = useState(false)
  const [meLoading, setMeLoading] = useState(false)
  const [meError, setMeError] = useState('')
  const [supportOpen, setSupportOpen] = useState(false)
  const [supportWechat, setSupportWechat] = useState('')
  const [supportCopied, setSupportCopied] = useState(false)
  const [supportCopyHint, setSupportCopyHint] = useState('')
  const [supportIntent, setSupportIntent] = useState<{
    kind: 'open' | 'upgrade' | 'downgrade' | 'renew'
    planName?: string
  }>({ kind: 'open' })

  const loadLedger = useCallback(async (days: LedgerDays): Promise<void> => {
    const s = await window.vipChat.getSettings()
    if (!s.membershipAccessToken) {
      setLedger([])
      return
    }
    const getLedger = window.vipChat.membershipGetLedger
    if (typeof getLedger !== 'function') {
      setLedger([])
      return
    }
    setLedgerBusy(true)
    try {
      const res = await getLedger({ days })
      setLedger(res.ledger || [])
    } catch {
      setLedger([])
    } finally {
      setLedgerBusy(false)
    }
  }, [])

  const isAuthError = (e: unknown): boolean => {
    const msg = e instanceof Error ? e.message : String(e || '')
    return /401|UNAUTHORIZED|鉴权|未授权|登录态|重新登录|admin auth|auth required/i.test(msg)
  }

  const refresh = useCallback(async (settings?: AppSettings): Promise<void> => {
    const s = settings || (await window.vipChat.getSettings())
    setForm(s)
    try {
      setPlans((await window.vipChat.membershipGetPlans()) as PlansPayload)
    } catch {
      setPlans(null)
    }
    if (s.membershipAccessToken) {
      setMeLoading(true)
      setMeError('')
      try {
        const profile = await window.vipChat.membershipGetMe()
        setMe(profile)
        setMeError('')
        if (s.modelRoutingMode === 'membership' && profile.modelRoutes) {
          const synced = applyOfficialModelRoutes(s, profile.modelRoutes)
          if (
            synced.modelName !== s.modelName ||
            synced.visionModelName !== s.visionModelName ||
            synced.sttModel !== s.sttModel
          ) {
            await window.vipChat.saveSettings(synced)
            setForm(synced)
          }
        }
        // 明细与资料拆开：旧 preload 无 ledger API 时不拖垮整页
        void loadLedger(ledgerDays)
      } catch (e) {
        setLedger([])
        if (isAuthError(e)) {
          const next = {
            ...s,
            membershipAccessToken: '',
            modelRoutingMode: 'byok' as const
          }
          await window.vipChat.saveSettings(next)
          setForm(next)
          setMe(null)
          setMeError('')
          setMsg(t('membership.tokenStale'))
          window.dispatchEvent(new CustomEvent('typenow:account-changed'))
        } else {
          setMe(null)
          setMeError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        setMeLoading(false)
      }
    } else {
      setMe(null)
      setMeError('')
      setMeLoading(false)
      setLedger([])
    }
  }, [ledgerDays, loadLedger, t])

  useEffect(() => {
    void refresh()
    const onChanged = (): void => {
      void refresh()
    }
    window.addEventListener('typenow:account-changed', onChanged)
    return () => window.removeEventListener('typenow:account-changed', onChanged)
  }, [refresh])

  useEffect(() => {
    if (location.hash !== '#plans') return
    const timer = window.setTimeout(() => {
      document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [location.hash, meLoading, plans])

  const savePatch = async (patch: Partial<AppSettings>): Promise<AppSettings> => {
    const s = form || (await window.vipChat.getSettings())
    const next = { ...s, ...patch }
    await window.vipChat.saveSettings(next)
    setForm(next)
    return next
  }

  const orderedPlans = useMemo(() => sortPlansByCatalog(plans?.plans || []), [plans])

  if (!form) {
    return (
      <section className="membership-page">
        <header className="ms-hero">
          <h1 className="ms-title">{t('account.title')}</h1>
          <p className="ms-sub">{t('membership.loading')}</p>
        </header>
      </section>
    )
  }

  const loggedIn = Boolean(form.membershipAccessToken)
  const currentPlanId = me?.plan?.id || (me ? 'trial' : '')
  const periodQuota = me?.usage?.periodQuota ?? me?.plan?.monthlyCredits ?? 0
  const periodUsed = me?.usage?.periodUsed ?? 0
  const periodRemaining =
    me?.usage?.periodRemaining ?? Math.max(0, periodQuota - periodUsed)
  const balance = me?.balance ?? me?.usage?.walletBalance ?? 0
  const usedPct =
    periodQuota > 0
      ? Math.max(0, Math.min(100, Math.round((periodUsed / periodQuota) * 100)))
      : 0
  const meterTone = usedPct >= 90 ? 'danger' : usedPct >= 70 ? 'warn' : 'ok'
  const planName = me?.plan?.name || (me ? t('membership.defaultTrial') : '')
  const displayName = me ? membershipDisplayLabel(me) : ''
  const phoneText = me?.phone ? maskPhone(me.phone) : ''
  const nickIsCustom = Boolean(
    me?.displayName &&
      me.displayName.trim() &&
      me.displayName.trim() !== (me.phone || '').trim()
  )

  const formatPrice = (p: PlanRow): string => {
    if (p.priceMonthCents === 0) return t('membership.limitedFree')
    if (billing === 'year' && p.priceYearCents > 0) {
      return `¥${(p.priceYearCents / 100).toFixed(0)}/${t('membership.yearUnit')}`
    }
    const yuan = p.priceMonthCents / 100
    return `¥${yuan % 1 ? yuan.toFixed(1) : yuan.toFixed(0)}/${t('membership.month')}`
  }

  const strikePrice = (p: PlanRow): string | null => {
    if (p.priceMonthCents === 0) return null
    if (billing === 'year' && p.priceYearCents > 0) {
      return `¥${((p.priceMonthCents * 12) / 100).toFixed(0)}`
    }
    // 月付展示参考原价（约 7 折前）
    const list = Math.round((p.priceMonthCents / 0.7) / 100)
    if (list > p.priceMonthCents / 100) return `¥${list}`
    return null
  }

  const creditBreakdown = (p: PlanRow): string => {
    const base = p.baseCredits ?? Math.max(0, p.monthlyCredits - (p.giftCredits || 0))
    const gift = p.giftCredits ?? 0
    if (gift > 0) {
      return t('membership.creditBreakdown', {
        base: String(base),
        gift: String(gift),
        total: String(p.monthlyCredits)
      })
    }
    return t('membership.feat.baseCredits', { n: String(base || p.monthlyCredits) })
  }

  const requestCode = async (): Promise<void> => {
    const p = phone.trim()
    if (p.length < 6) {
      setMsg(t('account.errPhone'))
      return
    }
    setBusy(true)
    setMsg('')
    try {
      await savePatch({ membershipServerUrl: form.membershipServerUrl })
      await window.vipChat.membershipRequestCode(p)
      setMsg(t('account.codeSent'))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const doLogin = async (): Promise<void> => {
    const p = phone.trim()
    const c = code.trim()
    if (p.length < 6) {
      setMsg(t('account.errPhone'))
      return
    }
    if (!c) {
      setMsg(t('account.errCode'))
      return
    }
    setBusy(true)
    setMsg('')
    try {
      await savePatch({ membershipServerUrl: form.membershipServerUrl })
      const res = await window.vipChat.membershipLogin(p, c)
      const next = await savePatch(
        applyOfficialModelRoutes(
          {
            ...(form as AppSettings),
            membershipAccessToken: res.accessToken
          },
          res.me.modelRoutes
        )
      )
      setMe(res.me)
      setCode('')
      setMsg(authTab === 'register' ? t('account.registerOk') : t('account.loginOk'))
      await refresh(next)
      window.dispatchEvent(new CustomEvent('typenow:account-changed'))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const logout = async (): Promise<void> => {
    await savePatch({ membershipAccessToken: '', modelRoutingMode: 'byok' })
    setMe(null)
    setLedger([])
    setEditingNick(false)
    setNickDraft('')
    setMsg(t('account.loggedOut'))
    window.dispatchEvent(new CustomEvent('typenow:account-changed'))
  }

  const startEditNick = (): void => {
    const raw = (me?.displayName || '').trim()
    const phone = (me?.phone || '').trim()
    setNickDraft(raw && raw !== phone ? raw : '')
    setEditingNick(true)
    setMsg('')
  }

  const saveNick = async (): Promise<void> => {
    const name = nickDraft.trim()
    if (!name) {
      setMsg(t('account.nickHint'))
      return
    }
    if (Array.from(name).length > 32) {
      setMsg(t('account.nickHint'))
      return
    }
    setNickBusy(true)
    setMsg('')
    try {
      const next = await window.vipChat.membershipUpdateProfile(name)
      setMe(next)
      setEditingNick(false)
      setMsg(t('account.nickOk'))
      window.dispatchEvent(new CustomEvent('typenow:account-changed'))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setNickBusy(false)
    }
  }

  const resolveSupportWechat = (): string => {
    const contact =
      (me || plans)?.ops?.supportContact || t('membership.supportWechatFallback')
    return extractWechatId(contact) || contact || 'weblee'
  }

  const copySupportWechat = async (wechat: string): Promise<boolean> => {
    const ok = await copyText(wechat)
    setSupportCopied(ok)
    setSupportCopyHint(
      ok
        ? t('membership.supportModal.copiedToast', { wechat })
        : t('membership.wechatCopyFail', { wechat })
    )
    return ok
  }

  const openSupportModal = (
    kind: 'open' | 'upgrade' | 'downgrade' | 'renew' = 'open',
    planName?: string
  ): void => {
    void (async () => {
      setBusy(true)
      setMsg('')
      setSupportIntent({ kind, planName })
      const wechat = resolveSupportWechat()
      setSupportWechat(wechat)
      setSupportOpen(true)
      await copySupportWechat(wechat)
      setBusy(false)
    })()
  }

  const requestIntent = openSupportModal

  const startStripeCheckout = async (body: {
    planId?: string
    interval?: 'month' | 'year'
    changeType?: string
    credits?: number
    amountCents?: number
  }): Promise<void> => {
    setBusy(true)
    setMsg('')
    try {
      const res = await window.vipChat.membershipCreateStripeCheckout(body)
      await window.vipChat.openExternal(res.checkoutUrl)
      setMsg(t('membership.stripeOpened'))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t('membership.stripeFail'))
    } finally {
      setBusy(false)
    }
  }

  const payOrSupport = (
    kind: 'open' | 'upgrade' | 'downgrade' | 'renew',
    plan?: PlanRow
  ): void => {
    if (kind === 'downgrade' || !plan || plan.priceMonthCents === 0) {
      requestIntent(kind, plan?.name)
      return
    }
    if (plans?.stripeEnabled === false) {
      requestIntent(kind, plan.name)
      return
    }
    void startStripeCheckout({
      planId: plan.id,
      interval: billing,
      changeType: kind
    })
  }

  const supportModalTitle =
    supportIntent.kind === 'upgrade'
      ? t('membership.supportModal.titleUpgrade')
      : supportIntent.kind === 'downgrade'
        ? t('membership.supportModal.titleDowngrade')
        : supportIntent.kind === 'renew'
          ? t('membership.supportModal.titleRenew')
          : t('membership.supportModal.title')

  const supportModalLead =
    supportIntent.kind === 'upgrade'
      ? t('membership.supportModal.leadUpgrade', { plan: supportIntent.planName || '' })
      : supportIntent.kind === 'downgrade'
        ? t('membership.supportModal.leadDowngrade', { plan: supportIntent.planName || '' })
        : supportIntent.kind === 'renew'
          ? t('membership.supportModal.leadRenew', { plan: supportIntent.planName || '' })
          : t('membership.supportModal.lead')

  const supportModalStep3 =
    supportIntent.kind === 'open'
      ? t('membership.supportModal.step3')
      : t('membership.supportModal.step3Change')

  return (
    <section className="membership-page">
      {supportOpen
        ? createPortal(
            <div
              className="ms-support-overlay"
              role="presentation"
              onClick={() => setSupportOpen(false)}
            >
              <div
                className="ms-support-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ms-support-title"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="ms-support-head">
                  <h3 id="ms-support-title">{supportModalTitle}</h3>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setSupportOpen(false)}
                  >
                    {t('account.close')}
                  </button>
                </header>
                <p className="ms-support-lead">{supportModalLead}</p>
                <ol className="ms-support-steps">
                  <li>{t('membership.supportModal.step1')}</li>
                  <li>{t('membership.supportModal.step2')}</li>
                  <li>{supportModalStep3}</li>
                </ol>
                <div className="ms-support-wechat">
                  <span className="ms-support-wechat-label">
                    {t('membership.supportModal.wechatLabel')}
                  </span>
                  <code className="ms-support-wechat-id">{supportWechat}</code>
                  <button
                    type="button"
                    className="ms-support-copy-btn"
                    title={t('membership.supportModal.copy')}
                    aria-label={t('membership.supportModal.copy')}
                    onClick={() => void copySupportWechat(supportWechat)}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                      <rect
                        x="9"
                        y="9"
                        width="11"
                        height="11"
                        rx="2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M5 15V5a2 2 0 0 1 2-2h10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
                <p className={`ms-support-copy-hint${supportCopied ? ' ok' : ' err'}`}>
                  {supportCopyHint ||
                    (supportCopied
                      ? t('membership.supportModal.copiedToast', { wechat: supportWechat })
                      : '')}
                </p>
                <div className="ms-support-actions">
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => void copySupportWechat(supportWechat)}
                  >
                    {t('membership.supportModal.copyAgain')}
                  </button>
                  <button type="button" className="btn" onClick={() => setSupportOpen(false)}>
                    {t('membership.supportModal.done')}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <div className="ms-main ms-main-in">
        <header className="ms-hero">
          <p className="ms-kicker">TalkNow</p>
          <h1 className="ms-title">{t('account.title')}</h1>
          <p className="ms-sub">{t('account.pageDesc')}</p>
        </header>

        {!loggedIn ? (
          <div className="ac-auth">
            <div className="account-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={authTab === 'login' ? 'active' : ''}
                aria-selected={authTab === 'login'}
                onClick={() => {
                  setAuthTab('login')
                  setMsg('')
                }}
              >
                {t('account.tabLogin')}
              </button>
              <button
                type="button"
                role="tab"
                className={authTab === 'register' ? 'active' : ''}
                aria-selected={authTab === 'register'}
                onClick={() => {
                  setAuthTab('register')
                  setMsg('')
                }}
              >
                {t('account.tabRegister')}
              </button>
            </div>
            <p className="account-tab-note">
              {authTab === 'register' ? t('account.registerNote') : t('account.loginNote')}
            </p>
            <div className="ac-auth-grid">
              <label className="account-field">
                <span>{t('account.phone')}</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="13800138000"
                  autoComplete="tel"
                />
              </label>
              <label className="account-field">
                <span>{t('account.code')}</span>
                <div className="account-code-row">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="888888"
                    autoComplete="one-time-code"
                  />
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => void requestCode()}
                  >
                    {t('account.requestCode')}
                  </button>
                </div>
              </label>
            </div>
            <button type="button" className="btn" disabled={busy} onClick={() => void doLogin()}>
              {authTab === 'register' ? t('account.doRegister') : t('account.doLogin')}
            </button>
            <p className="ms-hint" style={{ marginTop: 12 }}>
              {t('account.authHint')}
            </p>
          </div>
        ) : (
          <div className="ms-usage">
            {meError ? (
              <div className="ms-banner err">
                <div>
                  <strong>{t('membership.profileLoadFail')}</strong>
                  <p>{meError}</p>
                </div>
                <div className="ms-usage-actions">
                  <button
                    type="button"
                    className="btn sm"
                    disabled={meLoading}
                    onClick={() => void refresh()}
                  >
                    {meLoading ? t('membership.loading') : t('account.refresh')}
                  </button>
                  <button type="button" className="btn ghost sm" onClick={() => void logout()}>
                    {t('account.logout')}
                  </button>
                </div>
              </div>
            ) : null}

            <div className={`ms-profile${meLoading && !me ? ' loading' : ''}`}>
              <div className="ms-profile-main">
                <span className="ms-profile-avatar" aria-hidden>
                  {me ? membershipAvatarGlyph(me) : meLoading ? '…' : '我'}
                </span>
                <div className="ms-profile-copy">
                  <p className="ms-usage-label">
                    {meLoading && !me ? t('membership.loading') : t('account.signedIn')}
                  </p>
                  {editingNick ? (
                    <div className="ms-nick-edit">
                      <input
                        value={nickDraft}
                        maxLength={32}
                        placeholder={t('account.nickPlaceholder')}
                        disabled={nickBusy || !me}
                        onChange={(e) => setNickDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void saveNick()
                          if (e.key === 'Escape') setEditingNick(false)
                        }}
                        autoFocus
                      />
                      <p className="ms-hint">{t('account.nickHint')}</p>
                    </div>
                  ) : (
                    <p className="ms-profile-name">
                      {meLoading && !me
                        ? t('membership.loading')
                        : displayName || t('account.nickUnset')}
                      {me && !nickIsCustom && !meLoading ? (
                        <em className="ms-profile-nick-tip">{t('account.nickSuggest')}</em>
                      ) : null}
                    </p>
                  )}
                  <div className="ms-profile-meta">
                    <span>
                      {t('account.phoneLabel')}{' '}
                      <strong>{phoneText || (meLoading ? '…' : '—')}</strong>
                    </span>
                    <PlanTierBadge
                      planId={me?.plan?.id}
                      planName={planName || (meLoading ? '…' : t('membership.defaultTrial'))}
                      showUpgrade={Boolean(me)}
                    />
                    {me?.subscription?.periodEnd ? (
                      <span>
                        {t('membership.expiresAt', {
                          time: formatCycleTime(me.subscription.periodEnd).slice(0, 10)
                        })}
                      </span>
                    ) : null}
                    {me?.subscription?.pendingPlanId ? (
                      <span className="ms-pending-plan">
                        {t('membership.pendingDowngrade', {
                          plan: me.subscription.pendingPlanId
                        })}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="ms-usage-actions">
                {editingNick ? (
                  <>
                    <button
                      type="button"
                      className="btn sm"
                      disabled={nickBusy || !me}
                      onClick={() => void saveNick()}
                    >
                      {nickBusy ? t('settings.saving') : t('account.nickSave')}
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      disabled={nickBusy}
                      onClick={() => setEditingNick(false)}
                    >
                      {t('account.nickCancel')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn secondary sm"
                    disabled={!me || meLoading}
                    onClick={startEditNick}
                  >
                    {nickIsCustom ? t('account.nickEdit') : t('account.nickSet')}
                  </button>
                )}
                <button
                  type="button"
                  className="btn secondary sm"
                  disabled={meLoading}
                  onClick={() => void refresh()}
                >
                  {meLoading ? t('membership.loading') : t('account.refresh')}
                </button>
                <button type="button" className="btn ghost sm" onClick={() => void logout()}>
                  {t('account.logout')}
                </button>
              </div>
            </div>

            <div className="ms-meter">
              <div className="ms-meter-head">
                <span>{t('membership.usageTitle')}</span>
                {me?.subscription?.periodEnd ? (
                  <span className="ms-meter-cycle">
                    {t('membership.nextCycle', {
                      time: formatCycleTime(me.subscription.periodEnd)
                    })}
                  </span>
                ) : null}
              </div>
              <div className="ms-meter-stats">
                <strong>
                  {meLoading && !me
                    ? t('membership.loading')
                    : t('membership.usageUsed', {
                        used: String(periodUsed),
                        quota: String(periodQuota > 0 ? periodQuota : 0)
                      })}
                  <em> · {t('membership.usageBase')}</em>
                </strong>
                <span>
                  {me
                    ? t('membership.usageRemaining', { n: String(periodRemaining) })
                    : meLoading
                      ? '…'
                      : t('membership.usageRemaining', { n: '0' })}
                </span>
              </div>
              <div
                className={`ms-meter-track tone-${me ? meterTone : 'ok'}`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={me ? usedPct : 0}
                aria-label={t('membership.usageTitle')}
              >
                <div className="ms-meter-fill" style={{ width: `${me ? usedPct : 0}%` }} />
              </div>
              <p className="ms-meter-hint">
                {me
                  ? `${t('membership.usageWallet', { n: String(balance) })} · ${t(
                      'membership.estimate',
                      {
                        voice: String(me.estimate?.voiceMinutes ?? 0),
                        reply: String(me.estimate?.replyTimes ?? 0),
                        screen: String(me.estimate?.screenAskTimes ?? 0)
                      }
                    )}`
                  : meLoading
                    ? t('membership.loading')
                    : t('membership.profileLoadFail')}
              </p>
            </div>

            <div className="ms-ledger">
              <div className="ms-ledger-head">
                <h3>{t('membership.ledgerTitle')}</h3>
                <div className="ms-ledger-tabs" role="tablist" aria-label={t('membership.ledgerTitle')}>
                  {(
                    [
                      { d: 1 as const, label: t('membership.ledgerToday') },
                      { d: 7 as const, label: t('membership.ledger7d') },
                      { d: 30 as const, label: t('membership.ledger30d') }
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.d}
                      type="button"
                      role="tab"
                      aria-selected={ledgerDays === tab.d}
                      className={`ms-ledger-tab${ledgerDays === tab.d ? ' active' : ''}`}
                      disabled={ledgerBusy}
                      onClick={() => {
                        setLedgerDays(tab.d)
                        void loadLedger(tab.d)
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              {ledger.length === 0 ? (
                <p className="ms-ledger-empty">
                  {ledgerBusy ? t('membership.loading') : t('membership.ledgerEmpty')}
                </p>
              ) : (
                <div className="ms-ledger-table-wrap">
                  <table className="ms-ledger-table">
                    <thead>
                      <tr>
                        <th>{t('membership.ledgerTime')}</th>
                        <th>{t('membership.ledgerDelta')}</th>
                        <th>{t('membership.ledgerType')}</th>
                        <th>{t('membership.ledgerModel')}</th>
                        <th>{t('membership.ledgerRequest')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((row) => (
                        <tr key={row.id}>
                          <td className="mono">{formatCycleTime(row.createdAt)}</td>
                          <td className={row.delta < 0 ? 'debit' : 'credit'}>
                            {row.delta > 0 ? `+${row.delta}` : row.delta}
                          </td>
                          <td>{reasonLabel(row.reason, t)}</td>
                          <td className="mono">{row.note || '—'}</td>
                          <td className="mono dim">{row.requestId ? row.requestId.slice(0, 10) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="ms-mode" role="group" aria-label={t('membership.mode')} style={{ marginTop: 14 }}>
              <button
                type="button"
                className={`ms-seg${
                  form.modelRoutingMode !== 'membership' || form.inferenceMode === 'local'
                    ? ' active'
                    : ''
                }`}
                onClick={() =>
                  void savePatch({
                    modelRoutingMode: 'byok',
                    inferenceMode: 'cloud',
                    sttInferenceMode: 'cloud'
                  })
                }
              >
                {t('membership.modeByok')}
              </button>
              <button
                type="button"
                className={`ms-seg${
                  form.modelRoutingMode === 'membership' && form.inferenceMode !== 'local'
                    ? ' active'
                    : ''
                }`}
                onClick={() => {
                  void (async () => {
                    try {
                      const profile = await window.vipChat.membershipGetMe()
                      await savePatch(
                        applyOfficialModelRoutes(
                          {
                            ...(form as AppSettings),
                            membershipAccessToken: form!.membershipAccessToken
                          },
                          profile.modelRoutes
                        )
                      )
                      setMe(profile)
                    } catch (e) {
                      setMsg(e instanceof Error ? e.message : String(e))
                    }
                  })()
                }}
              >
                {t('membership.modeOfficial')}
              </button>
            </div>
            <p className="ms-hint" style={{ marginBottom: 0 }}>
              {t('membership.modeHint')}{' '}
              <Link to="/models">{t('nav.models')}</Link>
            </p>
          </div>
        )}

        <h2 id="plans" className="ms-section" style={{ marginTop: 28 }}>
          {t('membership.whichPlan')}
        </h2>
        <p className="ms-hint">{t('membership.desc')}</p>

        <div className="ms-billing" role="tablist" aria-label={t('membership.billing')}>
          <button
            type="button"
            role="tab"
            aria-selected={billing === 'month'}
            className={`ms-bill-tab${billing === 'month' ? ' active' : ''}`}
            onClick={() => setBilling('month')}
          >
            {t('membership.billingMonth')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={billing === 'year'}
            className={`ms-bill-tab${billing === 'year' ? ' active' : ''}`}
            onClick={() => setBilling('year')}
          >
            {t('membership.billingYearDisc')}
          </button>
        </div>

        {plans ? (
          <>
            <div className="ms-plan-grid ms-plan-grid-4">
              {orderedPlans.map((p) => {
                const popular = isPlanFeatured(p.id)
                const current = loggedIn && currentPlanId === p.id
                const feats = buildPlanFeatureLines(p, t)
                const strike = strikePrice(p)
                const isFree = p.priceMonthCents === 0
                const curRank = membershipPlanRank(currentPlanId || '')
                const targetRank = membershipPlanRank(p.id)
                const hasPaid =
                  loggedIn && currentPlanId && membershipPlanRank(currentPlanId) > 0
                let ctaLabel = isFree ? t('membership.contactSupport') : t('membership.payStripe')
                let ctaKind: 'open' | 'upgrade' | 'downgrade' | 'renew' = 'open'
                if (current) {
                  ctaLabel = t('membership.current')
                } else if (isFree) {
                  ctaLabel = hasPaid ? t('membership.switchTo') : t('membership.tryFree')
                  ctaKind = hasPaid ? 'downgrade' : 'open'
                } else if (loggedIn && currentPlanId) {
                  if (targetRank > curRank) {
                    ctaLabel = t('membership.upgradeTo')
                    ctaKind = 'upgrade'
                  } else if (targetRank < curRank) {
                    ctaLabel = t('membership.switchTo')
                    ctaKind = 'downgrade'
                  } else {
                    ctaLabel = t('membership.payStripe')
                    ctaKind = 'open'
                  }
                }
                return (
                  <article
                    key={p.id}
                    className={`ms-plan-card${popular ? ' popular' : ''}${current ? ' current' : ''}`}
                  >
                    {popular ? <div className="ms-plan-badge">{t('membership.popular')}</div> : null}
                    {current ? <div className="ms-plan-current">{t('membership.current')}</div> : null}
                    <h3 className="ms-plan-name">{p.name}</h3>
                    <p className="ms-plan-blurb">
                      {t(planBlurbKey(p.id) as 'membership.blurb.trial')}
                    </p>
                    <div className="ms-plan-price">
                      <span className="ms-plan-price-main">{formatPrice(p)}</span>
                      {strike ? <span className="ms-plan-price-strike">{strike}</span> : null}
                    </div>
                    <p className="ms-plan-quota">{creditBreakdown(p)}</p>
                    <button
                      type="button"
                      className={`btn${popular ? '' : ' secondary'} ms-plan-cta`}
                      disabled={busy || current}
                      onClick={() => {
                        if (current) return
                        if (isFree && !hasPaid) {
                          if (!loggedIn) {
                            setMsg(t('membership.loginFirst'))
                            return
                          }
                          setMsg(t('membership.trialHint'))
                          return
                        }
                        if (!loggedIn && !isFree) {
                          setMsg(t('membership.loginToBuy'))
                          return
                        }
                        payOrSupport(ctaKind, p)
                      }}
                    >
                      {ctaLabel}
                    </button>
                    {current && loggedIn && !isFree ? (
                      <button
                        type="button"
                        className="btn ghost sm ms-plan-renew"
                        disabled={busy}
                        onClick={() => payOrSupport('renew', p)}
                      >
                        {t('membership.renewExtend')}
                      </button>
                    ) : null}
                    <ul className="ms-plan-feats">
                      {feats.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </article>
                )
              })}
            </div>

            <div className="ms-compare">
              <h3 className="ms-compare-title">{t('membership.compareTitle')}</h3>
              <div className="ms-compare-wrap">
                <table className="ms-compare-table">
                  <thead>
                    <tr>
                      <th>{t('membership.compareFeature')}</th>
                      {orderedPlans.map((p) => (
                        <th key={p.id} className={p.id === 'advanced' ? 'hot' : ''}>
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{t('membership.compareBase')}</td>
                      {orderedPlans.map((p) => (
                        <td key={p.id}>
                          {p.baseCredits ?? Math.max(0, p.monthlyCredits - (p.giftCredits || 0))}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td>{t('membership.compareGift')}</td>
                      {orderedPlans.map((p) => (
                        <td key={p.id}>{p.giftCredits ? p.giftCredits : '—'}</td>
                      ))}
                    </tr>
                    <tr>
                      <td>{t('membership.compareTotal')}</td>
                      {orderedPlans.map((p) => (
                        <td key={p.id}>
                          <strong>{p.monthlyCredits}</strong>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td>{t('membership.compareModels')}</td>
                      {orderedPlans.map((p) => (
                        <td key={p.id}>{t('membership.compareModelsVal')}</td>
                      ))}
                    </tr>
                    <tr>
                      <td>{t('membership.compareByok')}</td>
                      {orderedPlans.map((p) => (
                        <td key={p.id} className="check">
                          ✓
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td>{t('membership.compareSupport')}</td>
                      {orderedPlans.map((p) => (
                        <td key={p.id}>
                          {p.id === 'flagship'
                            ? t('membership.supportPriority')
                            : p.id === 'trial'
                              ? t('membership.supportBasic')
                              : t('membership.supportStd')}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <p className="ms-hint">{t('membership.serverUnreachable')}</p>
        )}

        {plans ? (
          <div className="ms-topup">
            <div>
              <strong>{t('membership.topup')}</strong>
              <span>
                {plans.topup.credits} {t('membership.credits')} · ¥
                {(plans.topup.priceCents / 100).toFixed(0)}
              </span>
            </div>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => {
                if (!loggedIn) {
                  setMsg(t('membership.loginToBuy'))
                  return
                }
                if (plans?.stripeEnabled === false) {
                  requestIntent('open')
                  return
                }
                void startStripeCheckout({
                  credits: plans.topup.credits,
                  amountCents: plans.topup.priceCents
                })
              }}
            >
              {t('membership.topupStripe')}
            </button>
          </div>
        ) : null}

        <p className="ms-hint">{t('membership.priceHint')}</p>

        {loggedIn ? (
          <div className="ms-ops">
            <h2 className="ms-section">{t('membership.offline')}</h2>
            <p className="ms-ops-copy">{t('membership.offlineWechatHint')}</p>
            {(me || plans)?.ops?.supportContact ? (
              <p className="ms-ops-contact">{(me || plans)?.ops?.supportContact}</p>
            ) : null}
            <div className="row" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => requestIntent('open')}
              >
                {t('membership.contactSupport')}
              </button>
            </div>
            <div className="ms-redeem">
              <input
                value={redeem}
                onChange={(e) => setRedeem(e.target.value)}
                placeholder={t('membership.redeem')}
                aria-label={t('membership.redeem')}
              />
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    if (!redeem.trim()) {
                      setMsg(t('account.errCode'))
                      return
                    }
                    setBusy(true)
                    setMsg('')
                    try {
                      const nextMe = await window.vipChat.membershipRedeem(redeem.trim())
                      setMe(nextMe)
                      setMsg(t('membership.redeemOk'))
                      setRedeem('')
                      window.dispatchEvent(new CustomEvent('typenow:account-changed'))
                    } catch (e) {
                      setMsg(e instanceof Error ? e.message : String(e))
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                {t('membership.doRedeem')}
              </button>
            </div>
          </div>
        ) : null}

        <details className="ms-advanced">
          <summary>{t('membership.serverUrl')}</summary>
          <input
            value={form.membershipServerUrl}
            onChange={(e) => setForm({ ...form, membershipServerUrl: e.target.value })}
            onBlur={() => void savePatch({ membershipServerUrl: form.membershipServerUrl })}
          />
        </details>

        {msg ? <pre className="ms-msg">{msg}</pre> : null}
      </div>
    </section>
  )
}
