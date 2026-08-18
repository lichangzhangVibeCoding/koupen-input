import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BRAND_SITE } from '../../../shared/brand'
import {
  HELP_SCENARIO_GROUPS,
  pickLocaleText
} from '../../../shared/help-scenarios'
import {
  formatHotkeyLabel,
  formatVoiceHoldBindLabel,
  formatVoiceTapBindLabel
} from '../../../shared/hotkey'
import {
  compareSemver,
  localizedReleaseHighlights,
  localizedReleaseTitle,
  type ReleasesCatalog
} from '../../../shared/releases'
import { useI18n } from '../i18n'

const DOCS_URL = `${BRAND_SITE}/help/`
const SCENARIOS_URL = `${BRAND_SITE}/#scenarios`

function openUrl(url: string): void {
  void window.vipChat.openExternal(url)
}

export default function HelpPage() {
  const { t, locale, brand } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [version, setVersion] = useState('')
  const [catalog, setCatalog] = useState<ReleasesCatalog | null>(null)
  const [hotkeys, setHotkeys] = useState({
    voice: '—',
    aiTalk: '—',
    reply: '—',
    screenAsk: '—'
  })
  const [userDataPath, setUserDataPath] = useState('')

  useEffect(() => {
    void (async () => {
      const [v, c, s, p, dataPath] = await Promise.all([
        window.vipChat.getVersion(),
        window.vipChat.getReleasesCatalog(),
        window.vipChat.getSettings(),
        window.vipChat.getPlatform(),
        window.vipChat.getUserDataPath().catch(() => '')
      ])
      setVersion(v)
      setCatalog(c)
      setUserDataPath(dataPath)
      setHotkeys({
        voice: formatVoiceTapBindLabel(p, s.voiceTrigger),
        aiTalk: formatVoiceHoldBindLabel(p, s.voiceTrigger),
        reply: formatHotkeyLabel(s.hotkey, p),
        screenAsk: formatHotkeyLabel(s.screenAskHotkey, p)
      })
    })()
  }, [])

  useEffect(() => {
    if (location.hash !== '#changelog') return
    const timer = window.setTimeout(() => {
      document.getElementById('changelog')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [location.hash, catalog])

  const latest = catalog?.releases?.[0]
  const hasNewer =
    latest && version ? compareSemver(latest.version, version) > 0 : false

  const siteUrl = catalog?.siteUrl || `${BRAND_SITE}/`
  const siteWithLang =
    siteUrl + (siteUrl.includes('?') ? '&' : '?') + 'lang=' + (locale.startsWith('en') ? 'en' : 'zh')

  const groupNames = useMemo(
    () =>
      ({
        voice: brand.voice.name,
        aiTalk: brand.aiTalk.name,
        reply: brand.reply.name,
        screen: brand.screenAsk.name
      }) as Record<string, string>,
    [brand]
  )

  const hotkeyById: Record<string, string> = {
    voice: hotkeys.voice,
    aiTalk: hotkeys.aiTalk,
    reply: hotkeys.reply,
    screen: hotkeys.screenAsk
  }

  return (
    <section className="help-page">
      <h1 className="page-title">{t('help.title')}</h1>
      <p className="page-desc">{t('help.desc')}</p>

      <div className="help-actions" role="navigation" aria-label={t('help.actionsLabel')}>
        <button
          type="button"
          className="btn help-action-btn"
          onClick={() => navigate('/onboarding')}
        >
          {t('help.openOnboarding')}
        </button>
        <a
          className="btn help-action-btn"
          href="#changelog"
          onClick={(e) => {
            e.preventDefault()
            document.getElementById('changelog')?.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            })
            window.history.replaceState(null, '', '#changelog')
          }}
        >
          {t('help.openChangelog')}
          {hasNewer ? <span className="help-action-badge">{t('help.newBadge')}</span> : null}
        </a>
        <button
          type="button"
          className="btn secondary help-action-btn"
          onClick={() => openUrl(DOCS_URL + (locale.startsWith('en') ? '?lang=en' : '?lang=zh'))}
        >
          {t('help.openDocs')}
        </button>
        <button
          type="button"
          className="btn secondary help-action-btn"
          onClick={() => openUrl(SCENARIOS_URL + (locale.startsWith('en') ? '?lang=en' : ''))}
        >
          {t('help.openSiteScenarios')}
        </button>
      </div>
      <p className="help-docs-hint">{t('help.docsHint')}</p>

      <div className="help-howto">
        <h2 className="help-section-title">{t('help.howtoTitle')}</h2>
        <p className="help-section-sub">{t('help.howtoSub')}</p>
        <ol className="help-howto-steps">
          <li>
            <span className="help-howto-n">1</span>
            <div>
              <strong>{t('help.howto1Title')}</strong>
              <p>
                {t('help.howto1Body')}{' '}
                <Link to="/models">{t('nav.models')}</Link>
              </p>
            </div>
          </li>
          <li>
            <span className="help-howto-n">2</span>
            <div>
              <strong>{t('help.howto2Title')}</strong>
              <p>
                {t('help.howto2Body')}{' '}
                <Link to="/settings">{t('nav.settings')}</Link>
              </p>
            </div>
          </li>
          <li>
            <span className="help-howto-n">3</span>
            <div>
              <strong>{t('help.howto3Title')}</strong>
              <p>{t('help.howto3Body')}</p>
            </div>
          </li>
        </ol>
      </div>

      <div className="help-cap-table-wrap">
        <h2 className="help-section-title">{t('help.capTableTitle')}</h2>
        <p className="help-section-sub">{t('help.capTableSub')}</p>
        <div className="help-cap-table-scroll">
          <table className="help-cap-table">
            <thead>
              <tr>
                <th>{t('help.capTable.th1')}</th>
                <th>{t('help.capTable.th2')}</th>
                <th>{t('help.capTable.th3')}</th>
                <th>{t('help.capTable.th4')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('help.capTable.r1a')}</td>
                <td>{t('help.capTable.r1b')}</td>
                <td>{t('help.capTable.r1c')}</td>
                <td>{t('help.capTable.r1d')}</td>
              </tr>
              <tr>
                <td>{t('help.capTable.r2a')}</td>
                <td>{t('help.capTable.r2b')}</td>
                <td>{t('help.capTable.r2c')}</td>
                <td>{t('help.capTable.r2d')}</td>
              </tr>
              <tr>
                <td>{t('help.capTable.r3a')}</td>
                <td>{t('help.capTable.r3b')}</td>
                <td>{t('help.capTable.r3c')}</td>
                <td>{t('help.capTable.r3d')}</td>
              </tr>
              <tr>
                <td>{t('help.capTable.r4a')}</td>
                <td>{t('help.capTable.r4b')}</td>
                <td>{t('help.capTable.r4c')}</td>
                <td>{t('help.capTable.r4d')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="help-privacy">
        <h2 className="help-section-title">{t('help.privacyTitle')}</h2>
        <p className="help-section-sub">{t('help.privacySub')}</p>
        <div className="help-privacy-cards">
          <article className="help-privacy-card">
            <h3>{t('help.privacyLocalTitle')}</h3>
            <p>{t('help.privacyLocalBody')}</p>
          </article>
          <article className="help-privacy-card">
            <h3>{t('help.privacyNosendTitle')}</h3>
            <p>{t('help.privacyNosendBody')}</p>
          </article>
          <article className="help-privacy-card">
            <h3>{t('help.privacyPathTitle')}</h3>
            <p>{t('help.privacyPathBody', { path: userDataPath || '—' })}</p>
          </article>
        </div>
      </div>

      <div className="help-scenarios">
        <h2 className="help-section-title">{t('help.scenariosTitle')}</h2>
        <p className="help-section-sub">{t('help.scenariosSub')}</p>

        {HELP_SCENARIO_GROUPS.map((group) => {
          const how = pickLocaleText(group.how, locale).replace(
            '{hotkey}',
            hotkeyById[group.id] || '—'
          )
          return (
            <article key={group.id} className="help-scenario-group">
              <header className="help-scenario-head">
                <div>
                  <h3>{groupNames[group.id] || pickLocaleText(group.name, locale)}</h3>
                  <span className="help-scenario-chip">
                    {pickLocaleText(group.tag, locale)}
                  </span>
                </div>
                <span className="kbd help-scenario-kbd">{hotkeyById[group.id] || '—'}</span>
              </header>
              <p className="help-scenario-how">{how}</p>

              {group.banner ? (
                <div className="help-scenario-banner">
                  <p>{pickLocaleText(group.banner, locale)}</p>
                  {group.bannerTags?.length ? (
                    <div className="help-tags">
                      {group.bannerTags.map((tag) => (
                        <span key={pickLocaleText(tag, locale)} className="help-tag">
                          {pickLocaleText(tag, locale)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {group.cards?.length ? (
                <div className="help-scenario-cards">
                  {group.cards.map((card) => (
                    <div key={pickLocaleText(card.title, locale)} className="help-scenario-card">
                      <h4>{pickLocaleText(card.title, locale)}</h4>
                      <p>{pickLocaleText(card.desc, locale)}</p>
                      <div className="help-tags">
                        {card.tags.map((tag) => (
                          <span key={pickLocaleText(tag, locale)} className="help-tag">
                            {pickLocaleText(tag, locale)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>

      <div id="changelog" className="help-changelog">
        <h2 className="help-section-title">{t('help.changelogTitle')}</h2>
        <p className="help-section-sub">{t('updates.desc')}</p>

        <div className="updates-banner">
          <div>
            <strong>{t('updates.current', { version: version || '—' })}</strong>
            <div className="muted">
              {hasNewer
                ? t('updates.newerAvailable', { version: latest!.version })
                : t('updates.upToDate')}
            </div>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() =>
                openUrl(
                  catalog?.latestUrl ||
                    'https://github.com/lichangzhangVibeCoding/koupen-input/releases/latest'
                )
              }
            >
              {t('updates.openReleases')}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => openUrl(siteWithLang)}
            >
              {t('updates.openSite')}
            </button>
          </div>
        </div>

        <div className="updates-list">
          {(catalog?.releases || []).map((r) => {
            const title = localizedReleaseTitle(r, locale)
            const highlights = localizedReleaseHighlights(r, locale)
            return (
              <article key={r.version} className="updates-item">
                <div className="meta">
                  <span className="ver">v{r.version}</span>
                  <span className="date">{r.date}</span>
                  <span>{title}</span>
                </div>
                <ul>
                  {highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </article>
            )
          })}
          {!catalog ? <p className="status">{t('updates.loading')}</p> : null}
        </div>
      </div>
    </section>
  )
}
