import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DOUBLE_ALT_HOTKEY,
  DOUBLE_COMMAND_HOTKEY,
  DEFAULT_VOICE_TRIGGER,
  defaultHotkeySettings,
  defaultScreenAskHotkey,
  formatHotkeyLabel,
  formatMacCommandLabel,
  formatVoiceHoldBindLabel,
  formatVoiceTapBindLabel,
  formatVoiceTriggerLabel,
  hotkeyLabelChips,
  isModifierDoubleHotkey,
  normalizeVoiceTrigger
} from '../../../shared/hotkey'
import { LOCALE_OPTIONS, type LocalePreference } from '../../../shared/i18n'
import { listPersonaPackOptions } from '../../../shared/persona-packs'
import type { PersonaPackId } from '../../../shared/persona-packs'
import { AppSettings, DEFAULT_SETTINGS } from '../../../shared/types'
import { ComboHotkeyCapture, VoiceTriggerCapture } from '../components/HotkeyCapture'
import { useI18n } from '../i18n'

type EditRow = null | 'voice' | 'reply' | 'screenAsk'

function ToggleRow({
  checked,
  onChange,
  title,
  hint
}: {
  checked: boolean
  onChange: (next: boolean) => void
  title: string
  hint?: string
}) {
  return (
    <label className="settings-toggle">
      <span className="settings-toggle-copy">
        <strong>{title}</strong>
        {hint ? <span>{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="settings-switch" aria-hidden />
    </label>
  )
}

function KeyChips({ label }: { label: string }) {
  const chips = hotkeyLabelChips(label)
  if (!chips.length) return <span className="settings-kbd-empty">—</span>
  return (
    <span className="settings-kbd-row" title={label}>
      {chips.map((c, i) => (
        <kbd key={`${c}-${i}`} className="kbd settings-kbd">
          {c}
        </kbd>
      ))}
    </span>
  )
}

export default function SettingsPage() {
  const { t, brand, setPreference, refreshFromSettings } = useI18n()
  const [platform, setPlatform] = useState('darwin')
  const [form, setForm] = useState<AppSettings>({ ...DEFAULT_SETTINGS })
  const [status, setStatus] = useState<{ type: '' | 'ok' | 'err'; text: string }>({
    type: '',
    text: ''
  })
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState('')
  const [includeSecrets, setIncludeSecrets] = useState(false)
  const [userDataPath, setUserDataPath] = useState('')
  const [editing, setEditing] = useState<EditRow>(null)
  const [macPerms, setMacPerms] = useState<{
    screen: string
    microphone: string
    accessibility: boolean
  } | null>(null)

  const isWin = platform === 'win32'
  const plat = (isWin ? 'win32' : 'darwin') as NodeJS.Platform
  const defaultDouble = isWin ? DOUBLE_ALT_HOTKEY : DOUBLE_COMMAND_HOTKEY
  const voiceTrigger = normalizeVoiceTrigger(form.voiceTrigger)
  const recommendedReplyLabel = formatHotkeyLabel(defaultDouble, plat)

  useEffect(() => {
    void (async () => {
      const p = await window.vipChat.getPlatform()
      setPlatform(p)
      setForm(await window.vipChat.getSettings())
      try {
        setUserDataPath(await window.vipChat.getUserDataPath())
      } catch {
        setUserDataPath('')
      }
      if (p === 'darwin') {
        try {
          setMacPerms(await window.vipChat.getMacPermissions())
        } catch {
          setMacPerms(null)
        }
      }
    })()
  }, [])

  function permLabel(status: string): string {
    switch (status) {
      case 'granted':
        return t('settings.permGranted')
      case 'denied':
        return t('settings.permDenied')
      case 'restricted':
        return t('settings.permRestricted')
      case 'not-determined':
        return t('settings.permNotDetermined')
      default:
        return status || t('settings.permUnknown')
    }
  }

  function permTone(status: string): 'ok' | 'bad' | 'warn' {
    if (status === 'granted') return 'ok'
    if (status === 'denied' || status === 'restricted') return 'bad'
    return 'warn'
  }

  async function refreshMacPerms() {
    if (platform !== 'darwin') return
    await window.vipChat.retryAccessibility()
    const snap = await window.vipChat.getMacPermissions()
    setMacPerms(snap)
  }

  async function persist(next: AppSettings, okMsg: string, failMsg: string) {
    setSaving(true)
    setStatus({ type: '', text: '' })
    try {
      const res = await window.vipChat.saveSettings(next)
      setForm(next)
      await refreshFromSettings()
      setStatus({
        type: res.ok ? 'ok' : 'err',
        text: res.ok ? okMsg : failMsg
      })
      return res.ok
    } catch (e) {
      setStatus({ type: 'err', text: e instanceof Error ? e.message : String(e) })
      return false
    } finally {
      setSaving(false)
    }
  }

  async function onSave() {
    const hotkey = formatHotkeyLabel(form.hotkey, plat)
    await persist(
      form,
      t('settings.saveOk', { name: brand.reply.name, hotkey }),
      t('settings.saveHotkeyFail', { hotkey })
    )
    setEditing(null)
  }

  async function onExport() {
    setBusy('export')
    setStatus({ type: '', text: '' })
    try {
      const res = await window.vipChat.exportSettings(includeSecrets)
      if ('canceled' in res && res.canceled) {
        setStatus({ type: '', text: '' })
        return
      }
      if (res.ok) {
        setStatus({
          type: 'ok',
          text: includeSecrets
            ? t('settings.exportOkSecrets', { path: res.path })
            : t('settings.exportOkRedacted', { path: res.path })
        })
      } else {
        setStatus({
          type: 'err',
          text: 'error' in res ? res.error : t('settings.exportFail')
        })
      }
    } catch (e) {
      setStatus({ type: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy('')
    }
  }

  async function onReset() {
    const ok = window.confirm(t('settings.resetConfirm'))
    if (!ok) return
    setBusy('reset')
    setStatus({ type: '', text: '' })
    try {
      const res = await window.vipChat.resetSettingsDefaults()
      setForm(res.settings)
      setEditing(null)
      await refreshFromSettings()
      const hotkey = formatHotkeyLabel(res.hotkey, plat)
      setStatus({
        type: res.ok ? 'ok' : 'err',
        text: res.ok ? t('settings.resetOk', { hotkey }) : t('settings.resetHotkeyFail', { hotkey })
      })
    } catch (e) {
      setStatus({ type: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy('')
    }
  }

  async function onOpenUserData() {
    setBusy('openData')
    try {
      const res = await window.vipChat.openUserData()
      if (!res.ok) {
        setStatus({ type: 'err', text: t('settings.dataOpenFail') })
      }
    } catch (e) {
      setStatus({ type: 'err', text: e instanceof Error ? e.message : t('settings.dataOpenFail') })
    } finally {
      setBusy('')
    }
  }

  async function onResetAllHotkeys() {
    const ok = window.confirm(t('settings.hotkeys.resetAllConfirm'))
    if (!ok) return
    const next = { ...form, ...defaultHotkeySettings(plat) }
    setEditing(null)
    await persist(next, t('settings.hotkeys.resetAllOk'), t('settings.hotkeys.resetAllFail'))
  }

  function resetRow(row: Exclude<EditRow, null>) {
    const defaults = defaultHotkeySettings(plat)
    if (row === 'voice') {
      setForm({ ...form, voiceTrigger: defaults.voiceTrigger })
    } else if (row === 'reply') {
      setForm({ ...form, hotkey: defaults.hotkey })
    } else if (row === 'screenAsk') {
      setForm({ ...form, screenAskHotkey: defaults.screenAskHotkey })
    }
    setEditing(null)
  }

  const personaBlurb =
    listPersonaPackOptions().find((p) => p.id === (form.personaPackId || 'none'))?.blurb || ''

  const voiceTapBindLabel = formatVoiceTapBindLabel(
    plat,
    isWin ? DEFAULT_VOICE_TRIGGER : voiceTrigger
  )
  const voiceHoldBindLabel = formatVoiceHoldBindLabel(
    plat,
    isWin ? DEFAULT_VOICE_TRIGGER : voiceTrigger
  )
  const replyBindLabel = formatHotkeyLabel(form.hotkey, plat)
  const askBindLabel = formatHotkeyLabel(
    form.screenAskHotkey || defaultScreenAskHotkey(plat),
    plat
  )

  const shortcutRows: {
    id: Exclude<EditRow, null> | 'esc' | 'aiTalk'
    name: string
    blurb: string
    editable: boolean
  }[] = [
    {
      id: 'voice',
      name: brand.voice.name,
      blurb: brand.voice.blurb,
      editable: !isWin
    },
    {
      id: 'aiTalk',
      name: brand.aiTalk.name,
      blurb: brand.aiTalk.blurb,
      editable: false
    },
    {
      id: 'reply',
      name: brand.reply.name,
      blurb: brand.reply.blurb,
      editable: true
    },
    {
      id: 'screenAsk',
      name: brand.screenAsk.name,
      blurb: brand.screenAsk.blurb,
      editable: true
    },
    {
      id: 'esc',
      name: t('settings.hotkeys.esc'),
      blurb: t('settings.hotkeys.escBlurb'),
      editable: false
    }
  ]

  function bindLabelFor(id: (typeof shortcutRows)[number]['id']): string {
    if (id === 'voice') return voiceTapBindLabel
    if (id === 'aiTalk') return voiceHoldBindLabel
    if (id === 'reply') return replyBindLabel
    if (id === 'screenAsk') return askBindLabel
    return 'Esc'
  }

  return (
    <section className="settings-page">
      <header className="settings-hero">
        <div className="settings-hero-copy">
          <h2 className="page-title">{t('settings.title')}</h2>
          <p className="page-desc">{t('settings.pageDesc')}</p>
        </div>
        <Link className="btn secondary sm" to="/models">
          {t('home.configModels')}
        </Link>
      </header>

      <nav className="settings-toc" aria-label={t('settings.title')}>
        <a href="#settings-hotkeys">{t('settings.group.hotkeys')}</a>
        <a href="#settings-caps">{t('settings.group.caps')}</a>
        <a href="#settings-reply">{t('settings.group.replyPrefs')}</a>
        <a href="#settings-language">{t('settings.group.language')}</a>
        <a href="#settings-data">{t('settings.group.data')}</a>
        <a href="#settings-perms">{isWin ? t('settings.permWinTitle') : t('settings.permMacTitle')}</a>
      </nav>

      <div className="settings-stack">
        <section className="settings-card" id="settings-hotkeys">
          <div className="settings-card-head settings-card-head-row">
            <div>
              <h3>{t('settings.group.hotkeys')}</h3>
              <p>{t('settings.group.hotkeysHint')}</p>
            </div>
            <button
              type="button"
              className="btn ghost sm"
              disabled={Boolean(busy) || saving}
              onClick={() => void onResetAllHotkeys()}
            >
              {t('settings.hotkeys.resetAll')}
            </button>
          </div>

          <div className="settings-hotkey-table" role="table">
            <div className="settings-hotkey-head" role="row">
              <span role="columnheader">{t('settings.hotkeys.colCommand')}</span>
              <span role="columnheader">{t('settings.hotkeys.colBinding')}</span>
              <span role="columnheader">{t('settings.hotkeys.colAction')}</span>
            </div>

            {shortcutRows.map((row) => {
              const isEdit = editing === row.id
              return (
                <div className="settings-hotkey-row" role="row" key={row.id}>
                  <div className="settings-hotkey-cmd" role="cell">
                    <strong>{row.name}</strong>
                    <span>{row.blurb}</span>
                  </div>
                  <div className="settings-hotkey-bind" role="cell">
                    {isEdit && row.id === 'voice' && !isWin ? (
                      <VoiceTriggerCapture
                        value={voiceTrigger}
                        onChange={(id) => {
                          setForm({ ...form, voiceTrigger: id })
                          setEditing(null)
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    ) : null}

                    {isEdit && row.id === 'reply' ? (
                      <ComboHotkeyCapture
                        platform={plat}
                        value={isModifierDoubleHotkey(form.hotkey) ? '' : form.hotkey}
                        onChange={(accel) => {
                          setForm({ ...form, hotkey: accel })
                          setEditing(null)
                        }}
                        onCancel={() => setEditing(null)}
                        recommendedLabel={recommendedReplyLabel}
                        onUseRecommended={() => {
                          setForm({ ...form, hotkey: defaultDouble })
                          setEditing(null)
                        }}
                      />
                    ) : null}

                    {isEdit && row.id === 'screenAsk' ? (
                      <ComboHotkeyCapture
                        platform={plat}
                        value={form.screenAskHotkey || ''}
                        onChange={(accel) => {
                          setForm({ ...form, screenAskHotkey: accel })
                          setEditing(null)
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    ) : null}

                    {!isEdit ? <KeyChips label={bindLabelFor(row.id)} /> : null}
                  </div>
                  <div className="settings-hotkey-actions" role="cell">
                    {row.id === 'esc' ? (
                      <span className="settings-hotkey-fixed">{t('settings.hotkeys.fixed')}</span>
                    ) : row.id === 'aiTalk' ? (
                      <span className="settings-hotkey-fixed">
                        {t('settings.hotkeys.sameAsVoice')}
                      </span>
                    ) : isEdit ? (
                      <>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setEditing(null)}
                        >
                          {t('settings.hotkeys.done')}
                        </button>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => resetRow(row.id as Exclude<EditRow, null>)}
                        >
                          {t('settings.hotkeys.restoreRow')}
                        </button>
                      </>
                    ) : (
                      <>
                        {row.editable ? (
                          <button
                            type="button"
                            className="btn ghost sm"
                            onClick={() => setEditing(row.id as Exclude<EditRow, null>)}
                          >
                            {t('settings.hotkeys.edit')}
                          </button>
                        ) : (
                          <span className="settings-hotkey-fixed">{t('settings.hotkeys.fixed')}</span>
                        )}
                        {row.editable ? (
                          <button
                            type="button"
                            className="btn ghost sm"
                            onClick={() => resetRow(row.id as Exclude<EditRow, null>)}
                          >
                            {t('settings.hotkeys.restoreRow')}
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="settings-hint settings-map-hint">
            {isWin
              ? t('settings.hotkey.mapWin', {
                  reply: brand.reply.name,
                  screenAsk: brand.screenAsk.name,
                  askKey: formatHotkeyLabel(defaultScreenAskHotkey('win32'), 'win32')
                })
              : t('settings.hotkey.mapMac', {
                  reply: brand.reply.name,
                  screenAsk: brand.screenAsk.name,
                  askKey: formatMacCommandLabel(defaultScreenAskHotkey('darwin'))
                })}
          </p>
          {!isWin ? (
            <p className="settings-hint">
              {t('settings.hotkey.voiceNote', { name: brand.voice.name })}
            </p>
          ) : null}
        </section>

        <section className="settings-card" id="settings-caps">
          <div className="settings-card-head">
            <h3>{t('settings.group.caps')}</h3>
            <p>{t('settings.group.capsHint')}</p>
          </div>
          <ToggleRow
            checked={form.voiceInputEnabled}
            onChange={(checked) => setForm({ ...form, voiceInputEnabled: checked })}
            title={t('settings.voiceEnabled', { name: brand.voice.name })}
            hint={t('settings.voiceTriggerNote', {
              trigger: formatVoiceTriggerLabel(plat, voiceTrigger)
            })}
          />
          <div className="settings-divider" />
          <ToggleRow
            checked={form.voiceStripFillersEnabled !== false}
            onChange={(checked) => setForm({ ...form, voiceStripFillersEnabled: checked })}
            title={t('settings.voiceStripFillers')}
            hint={t('settings.voiceStripFillersHint')}
          />
          <div className="settings-divider" />
          <ToggleRow
            checked={form.voiceFixSttTyposEnabled === true}
            onChange={(checked) => setForm({ ...form, voiceFixSttTyposEnabled: checked })}
            title={t('settings.voiceFixTypos')}
            hint={t('settings.voiceFixTyposHint')}
          />
          <div className="settings-divider" />
          <ToggleRow
            checked={form.screenAskEnabled !== false}
            onChange={(checked) => setForm({ ...form, screenAskEnabled: checked })}
            title={brand.screenAsk.name}
            hint={brand.screenAsk.blurb}
          />
        </section>

        <section className="settings-card" id="settings-reply">
          <div className="settings-card-head">
            <h3>{t('settings.group.replyPrefs')}</h3>
            <p>{brand.reply.blurb}</p>
          </div>
          <div className="field">
            <label htmlFor="settings-persona">{t('settings.persona.title')}</label>
            <p className="settings-hint">{t('settings.persona.longHint')}</p>
            <select
              id="settings-persona"
              value={form.personaPackId || 'none'}
              onChange={(e) =>
                setForm({ ...form, personaPackId: e.target.value as PersonaPackId })
              }
            >
              {listPersonaPackOptions().map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {personaBlurb ? <p className="settings-hint">{personaBlurb}</p> : null}
          </div>
          <ToggleRow
            checked={form.deAiToneEnabled !== false}
            onChange={(checked) => setForm({ ...form, deAiToneEnabled: checked })}
            title={t('settings.deAi.title')}
            hint={t('settings.deAi.longHint')}
          />
        </section>

        <section className="settings-card" id="settings-language">
          <div className="settings-card-head">
            <h3>{t('settings.group.language')}</h3>
          </div>
          <div className="field">
            <label htmlFor="settings-locale">{t('settings.locale.title')}</label>
            <p className="settings-hint">{t('settings.locale.hint')}</p>
            <select
              id="settings-locale"
              value={form.locale || 'system'}
              onChange={(e) => {
                const locale = e.target.value as LocalePreference
                setForm({ ...form, locale })
                void setPreference(locale)
              }}
            >
              {LOCALE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="settings-card" id="settings-advanced">
          <div className="settings-card-head">
            <h3>{t('settings.group.advanced')}</h3>
          </div>
          <div className="field">
            <label htmlFor="settings-context">{t('settings.contextWindow')}</label>
            <input
              id="settings-context"
              type="number"
              min={10}
              max={200}
              value={form.contextWindowSize}
              onChange={(e) =>
                setForm({ ...form, contextWindowSize: Number(e.target.value) || 40 })
              }
            />
          </div>
        </section>

        <section className="settings-card" id="settings-data">
          <div className="settings-card-head">
            <h3>{t('settings.group.data')}</h3>
            <p>{t('settings.dataPrivacy')}</p>
          </div>
          {userDataPath ? (
            <div className="settings-data-path">
              <div>
                <strong>{t('settings.dataPathLabel')}</strong>
                <code>{userDataPath}</code>
              </div>
              <button
                type="button"
                className="btn secondary sm"
                disabled={Boolean(busy)}
                onClick={() => void onOpenUserData()}
              >
                {busy === 'openData' ? t('home.processing') : t('settings.dataOpenFolder')}
              </button>
            </div>
          ) : null}
          <p className="settings-hint">{t('settings.resetHint')}</p>
          <ToggleRow
            checked={includeSecrets}
            onChange={setIncludeSecrets}
            title={t('settings.exportSecrets')}
            hint={t('settings.exportSecretsHint')}
          />
          <div className="settings-actions">
            <button
              type="button"
              className="btn secondary sm"
              disabled={Boolean(busy)}
              onClick={() => void onExport()}
            >
              {busy === 'export' ? t('home.processing') : t('settings.export')}
            </button>
            <button
              type="button"
              className="btn ghost sm"
              disabled={Boolean(busy)}
              onClick={() => void onReset()}
            >
              {busy === 'reset' ? t('settings.resetting') : t('settings.reset')}
            </button>
          </div>
        </section>

        <section className="settings-card" id="settings-perms">
          <div className="settings-card-head">
            <h3>{isWin ? t('settings.permWinTitle') : t('settings.permMacTitle')}</h3>
            <p>
              {isWin
                ? t('settings.permWinIntro')
                : t('settings.permMacIntro', { name: brand.name })}
            </p>
          </div>

          {isWin ? (
            <ul className="settings-perm-list">
              <li>
                <span>{t('settings.permMic')}</span>
                <em>{brand.voice.name}</em>
              </li>
              <li>
                <span>{t('settings.permScreen')}</span>
                <em>{brand.reply.name}</em>
              </li>
            </ul>
          ) : (
            <>
              {macPerms ? (
                <ul className="settings-perm-list">
                  <li>
                    <div className="settings-perm-main">
                      <span>{t('settings.permScreen')}</span>
                      <em className={`settings-perm-chip ${permTone(macPerms.screen)}`}>
                        {permLabel(macPerms.screen)}
                      </em>
                    </div>
                    <button
                      type="button"
                      className="btn secondary sm"
                      onClick={() =>
                        void window.vipChat.openMacPrivacy('screen').then(refreshMacPerms)
                      }
                    >
                      {t('settings.permOpen')}
                    </button>
                  </li>
                  <li>
                    <div className="settings-perm-main">
                      <span>{t('settings.permMic')}</span>
                      <em className={`settings-perm-chip ${permTone(macPerms.microphone)}`}>
                        {permLabel(macPerms.microphone)}
                      </em>
                    </div>
                    <button
                      type="button"
                      className="btn secondary sm"
                      onClick={() =>
                        void window.vipChat
                          .requestMacMicrophone()
                          .then(() => window.vipChat.openMacPrivacy('microphone'))
                          .then(refreshMacPerms)
                      }
                    >
                      {t('settings.permOpen')}
                    </button>
                  </li>
                  <li>
                    <div className="settings-perm-main">
                      <span>{t('settings.permA11y')}</span>
                      <em
                        className={`settings-perm-chip ${
                          macPerms.accessibility ? 'ok' : 'bad'
                        }`}
                      >
                        {macPerms.accessibility
                          ? t('settings.permA11yOk')
                          : t('settings.permA11yBad')}
                      </em>
                    </div>
                    <div className="settings-perm-actions">
                      <button
                        type="button"
                        className="btn secondary sm"
                        onClick={() =>
                          void window.vipChat
                            .openMacPrivacy('accessibility')
                            .then(refreshMacPerms)
                        }
                      >
                        {t('settings.permOpen')}
                      </button>
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() => void refreshMacPerms()}
                      >
                        {t('settings.permRetry')}
                      </button>
                    </div>
                  </li>
                </ul>
              ) : (
                <ul className="settings-perm-list">
                  <li>
                    <span>{t('settings.permMic')}</span>
                    <em>{brand.voice.name}</em>
                  </li>
                  <li>
                    <span>{t('settings.permScreen')}</span>
                    <em>{brand.reply.name}</em>
                  </li>
                  <li>
                    <span>{t('settings.permA11y')}</span>
                  </li>
                </ul>
              )}
              <div className="settings-actions">
                <button
                  type="button"
                  className="btn secondary sm"
                  onClick={() => {
                    void (async () => {
                      const s = await window.vipChat.getSettings()
                      const next = { ...s, permissionGuideCompleted: false }
                      await window.vipChat.saveSettings(next)
                      setForm(next)
                      window.dispatchEvent(new Event('typenow:open-permission-guide'))
                    })()
                  }}
                >
                  {t('settings.permGuideReopen')}
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      <footer className="settings-dock">
        <div className="settings-dock-copy">
          {status.text ? (
            <p className={`status ${status.type}`}>{status.text}</p>
          ) : (
            <p className="settings-hint">{t('settings.dockHint')}</p>
          )}
        </div>
        <button type="button" className="btn" disabled={saving} onClick={() => void onSave()}>
          {saving ? t('settings.saving') : t('settings.save')}
        </button>
      </footer>
    </section>
  )
}
