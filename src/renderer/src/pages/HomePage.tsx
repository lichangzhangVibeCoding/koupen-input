import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  formatHotkeyLabel,
  formatVoiceHoldBindLabel,
  formatVoiceTapBindLabel
} from '../../../shared/hotkey'
import {
  clearMembershipSession,
  maskPhone,
  membershipAvatarGlyph,
  membershipDisplayLabel,
  type MembershipMe
} from '../../../shared/membership'
import type { AppSettings } from '../../../shared/types'
import PlanTierBadge from '../components/PlanTierBadge'
import { useI18n } from '../i18n'

type Dashboard = Awaited<ReturnType<typeof window.vipChat.getModelDashboard>>
type Scheme = 'official' | 'byok' | 'local'
type CmdId = 'voice' | 'aiTalk' | 'reply' | 'screenAsk'

function deriveScheme(form: AppSettings, membershipActive: boolean): Scheme {
  if (form.inferenceMode === 'local' && form.sttInferenceMode === 'local') return 'local'
  if (form.modelRoutingMode === 'membership' || membershipActive) return 'official'
  return 'byok'
}

function CmdIcon({ id }: { id: CmdId }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  }
  switch (id) {
    case 'voice':
      return (
        <svg {...common}>
          <path d="M12 3v10a3 3 0 0 1-6 0V9" />
          <path d="M12 3a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
        </svg>
      )
    case 'aiTalk':
      return (
        <svg {...common}>
          <path d="M12 3l1.2 3.6L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.4L12 3z" />
          <path d="M19 13l.7 2.1L22 16l-2.3.7L19 19l-.7-2.3L16 16l2.3-.9L19 13z" />
          <path d="M5 15h7a3 3 0 0 1 0 6H8l-3 2v-2H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z" />
        </svg>
      )
    case 'reply':
      return (
        <svg {...common}>
          <path d="M5 6h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H11l-4 3v-3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" />
        </svg>
      )
    case 'screenAsk':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="12" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      )
  }
}

export default function HomePage() {
  const { t, brand, locale, isDev } = useI18n()
  const [platform, setPlatform] = useState('darwin')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [hotkeys, setHotkeys] = useState({
    voice: '',
    aiTalk: '',
    reply: '',
    screenAsk: ''
  })
  const [busy, setBusy] = useState<CmdId | ''>('')
  const [aiTalkLive, setAiTalkLive] = useState(false)
  const [msg, setMsg] = useState<{ id: CmdId; text: string; ok: boolean } | null>(null)
  const [account, setAccount] = useState<MembershipMe | null>(null)
  const [accountLoaded, setAccountLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const [p, s, d] = await Promise.all([
      window.vipChat.getPlatform(),
      window.vipChat.getSettings(),
      window.vipChat.getModelDashboard().catch(() => null)
    ])
    setPlatform(p)
    setSettings(s)
    setDash(d)
    setHotkeys({
      voice: formatVoiceTapBindLabel(p, s.voiceTrigger),
      aiTalk: formatVoiceHoldBindLabel(p, s.voiceTrigger),
      reply: formatHotkeyLabel(s.hotkey, p),
      screenAsk: formatHotkeyLabel(s.screenAskHotkey, p)
    })
    if (s.membershipAccessToken) {
      try {
        setAccount(await window.vipChat.membershipGetMe())
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e || '')
        if (/401|UNAUTHORIZED/i.test(msg)) {
          const next = clearMembershipSession(s)
          await window.vipChat.saveSettings(next)
          setSettings(next)
          window.dispatchEvent(new CustomEvent('typenow:account-changed'))
        }
        setAccount(null)
      }
    } else {
      setAccount(null)
    }
    setAccountLoaded(true)
  }, [])

  useEffect(() => {
    void refresh()
    const onChanged = (): void => {
      void refresh()
    }
    window.addEventListener('typenow:account-changed', onChanged)
    return () => window.removeEventListener('typenow:account-changed', onChanged)
  }, [locale, refresh])

  async function run(id: CmdId, action: () => Promise<void>, okText: string) {
    setBusy(id)
    setMsg(null)
    try {
      await action()
      setMsg({ id, text: okText, ok: true })
    } catch (e) {
      setMsg({
        id,
        text: e instanceof Error ? e.message : String(e),
        ok: false
      })
    } finally {
      setBusy('')
    }
  }

  const scheme: Scheme = settings
    ? deriveScheme(settings, Boolean(dash?.membershipActive))
    : 'official'
  const needLogin = Boolean(
    settings &&
      settings.modelRoutingMode === 'membership' &&
      settings.inferenceMode !== 'local' &&
      !settings.membershipAccessToken?.trim()
  )
  const readyCount = dash?.readyCount ?? 0
  const ready = readyCount >= 3 && !needLogin
  const schemeLabel =
    scheme === 'official'
      ? t('home.schemeOfficial')
      : scheme === 'local'
        ? t('home.schemeLocal')
        : t('home.schemeByok')

  const commands: {
    id: CmdId
    name: string
    blurb: string
    kbd: string
    primary?: boolean
    runLabel: string
    onRun: () => void
  }[] = [
    {
      id: 'voice',
      name: brand.voice.name,
      blurb: t('home.cmd.voiceBlurb'),
      kbd: hotkeys.voice,
      primary: true,
      runLabel: t('home.cmd.voiceRun'),
      onRun: () =>
        void run('voice', () => window.vipChat.toggleVoiceInput(), t('home.cmd.voiceOk'))
    },
    {
      id: 'aiTalk',
      name: brand.aiTalk.name,
      blurb: t('home.cmd.aiTalkBlurb'),
      kbd: hotkeys.aiTalk,
      runLabel: aiTalkLive ? t('home.cmd.aiTalkStop') : t('home.cmd.aiTalkRun'),
      onRun: () =>
        void (async () => {
          setBusy('aiTalk')
          setMsg(null)
          try {
            const phase = await window.vipChat.toggleVoiceHold()
            setAiTalkLive(phase === 'started')
            setMsg({
              id: 'aiTalk',
              text: phase === 'started' ? t('home.cmd.aiTalkStarted') : t('home.cmd.aiTalkOk'),
              ok: true
            })
          } catch (e) {
            setAiTalkLive(false)
            setMsg({
              id: 'aiTalk',
              text: e instanceof Error ? e.message : String(e),
              ok: false
            })
          } finally {
            setBusy('')
          }
        })()
    },
    {
      id: 'reply',
      name: brand.reply.name,
      blurb: t('home.cmd.replyBlurb'),
      kbd: hotkeys.reply,
      runLabel: t('home.cmd.replyRun'),
      onRun: () =>
        void run(
          'reply',
          () => window.vipChat.runPipeline(),
          t('home.replyTriggered', { name: brand.reply.name })
        )
    },
    {
      id: 'screenAsk',
      name: brand.screenAsk.name,
      blurb: t('home.cmd.screenAskBlurb'),
      kbd: hotkeys.screenAsk,
      runLabel: t('home.cmd.screenAskRun'),
      onRun: () =>
        void run(
          'screenAsk',
          () => window.vipChat.runScreenAsk(),
          t('home.screenAskTriggered', { name: brand.screenAsk.name })
        )
    }
  ]

  return (
    <section className="home">
      <header className="home-hero-band">
        <div className="home-hero-copy">
          <h1 className="home-title">
            <span className="home-title-main">{brand.name}</span>
            <span className="home-title-en">
              {locale.startsWith('zh') ? t('brand.nameEn') : '即刻对话'}
            </span>
            {isDev ? <span className="dev-pill">{t('brand.devBadge')}</span> : null}
          </h1>
          <p className="home-tagline">{brand.tagline}</p>
          <p className="home-site">{t('brand.site')}</p>
        </div>
        <p className="home-esc-chip">
          <span className="kbd">Esc</span>
          {t('home.escHintShort')}
        </p>
      </header>

      <div className="home-status" role="status">
        <div className="home-status-main">
          <span className={`home-status-dot ${ready ? 'on' : 'off'}`} aria-hidden />
          <div>
            <strong>
              {ready
                ? t('home.statusReady')
                : needLogin
                  ? t('home.statusNeedLogin')
                  : t('home.statusNeedSetup')}
              <em>
                {' · '}
                {schemeLabel}
                {dash ? ` · ${readyCount}/3` : ''}
              </em>
            </strong>
            <p>
              {ready
                ? t('home.statusReadyHint')
                : needLogin
                  ? t('home.statusLoginHint')
                  : t('home.statusSetupHint')}
            </p>
          </div>
        </div>
        <div className="home-status-actions">
          {needLogin ? (
            <Link className="btn sm" to="/account">
              {t('home.accountSignIn')}
            </Link>
          ) : (
            <Link className="btn secondary sm" to="/models">
              {t('nav.models')}
            </Link>
          )}
        </div>
      </div>

      {accountLoaded && account && settings && !settings.skillGuideCompleted ? (
        <div className="home-skill-hint">
          <p>{t('home.skillGuideHint')}</p>
          <Link className="btn sm" to="/onboarding">
            {t('home.skillGuideCta')}
          </Link>
        </div>
      ) : null}

      {accountLoaded ? (
        <div className={`home-account${account ? ' in' : ''}`}>
          {account ? (
            <>
              <div className="home-account-main">
                <span className="home-account-avatar" aria-hidden>
                  {membershipAvatarGlyph(account)}
                </span>
                <div>
                  <strong>
                    {t('home.accountSignedIn', { name: membershipDisplayLabel(account) })}
                  </strong>
                  <p className="home-account-sub">
                    <PlanTierBadge planId={account.plan?.id} planName={account.plan?.name} />
                    {account.phone ? (
                      <span className="home-account-phone"> · {maskPhone(account.phone)}</span>
                    ) : null}
                  </p>
                </div>
              </div>
              <Link className="btn ghost sm" to="/account">
                {t('home.accountManage')}
              </Link>
            </>
          ) : (
            <>
              <div className="home-account-main">
                <span className="home-account-avatar muted" aria-hidden>
                  我
                </span>
                <div>
                  <strong>{t('account.signedOut')}</strong>
                  <p>{t('account.pageDesc')}</p>
                </div>
              </div>
              <Link className="btn sm" to="/account">
                {t('home.accountSignIn')}
              </Link>
            </>
          )}
        </div>
      ) : null}

      <div className="home-console" aria-label={t('home.consoleLabel')}>
        <div className="home-console-head">
          <span>{t('home.consoleCapability')}</span>
          <span className="home-console-kbd-h">{t('home.consoleHotkey')}</span>
          <span className="home-console-run-h">{t('home.consoleRun')}</span>
        </div>
        <ul className="home-cmd-list">
          {commands.map((cmd) => {
            const rowMsg = msg?.id === cmd.id ? msg : null
            const running = busy === cmd.id
            return (
              <li
                key={cmd.id}
                className={`home-cmd${cmd.primary ? ' primary' : ''}${running ? ' busy' : ''}`}
              >
                <div className="home-cmd-icon" aria-hidden>
                  <CmdIcon id={cmd.id} />
                </div>
                <div className="home-cmd-body">
                  <div className="home-cmd-title">
                    <strong>{cmd.name}</strong>
                    {cmd.primary ? <span className="badge">{t('home.primaryBadge')}</span> : null}
                  </div>
                  <p>{cmd.blurb}</p>
                  {rowMsg ? (
                    <p className={`home-cmd-feedback ${rowMsg.ok ? 'ok' : 'err'}`}>{rowMsg.text}</p>
                  ) : null}
                </div>
                <span className="kbd home-cmd-kbd">{cmd.kbd || '—'}</span>
                <button
                  type="button"
                  className={`btn${cmd.primary ? '' : ' secondary'} sm home-cmd-run`}
                  disabled={Boolean(busy)}
                  onClick={cmd.onRun}
                >
                  {running ? t('home.processing') : cmd.runLabel}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {!ready ? (
        <div className="home-setup">
          <h2>{t('home.setupTitle')}</h2>
          <ol className="home-setup-steps">
            <li>
              <span className="home-setup-n">1</span>
              <div>
                <strong>{t('home.setupModelsTitle')}</strong>
                <p>{t('home.setupModelsBody')}</p>
                <Link className="btn sm" to={needLogin ? '/account' : '/models'}>
                  {needLogin ? t('home.accountSignIn') : t('home.configModels')}
                </Link>
              </div>
            </li>
            <li>
              <span className="home-setup-n">2</span>
              <div>
                <strong>{t('home.setupPermTitle')}</strong>
                <p>
                  {platform === 'win32' ? t('home.permWin') : t('home.permMac')}{' '}
                  <Link to="/settings">{t('home.seeSettings')}</Link>
                </p>
              </div>
            </li>
          </ol>
        </div>
      ) : (
        <p className="home-perm-quiet">
          {platform === 'win32' ? t('home.permWin') : t('home.permMac')}{' '}
          <Link to="/settings">{t('home.seeSettings')}</Link>
        </p>
      )}
    </section>
  )
}
