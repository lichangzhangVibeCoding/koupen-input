import { useEffect, useState } from 'react'
import brandIcon from '../assets/brand-icon.png'
import { useI18n } from '../i18n'

type MacPerms = {
  screen: string
  microphone: string
  accessibility: boolean
}

type Props = {
  open: boolean
  onFinished: () => void
}

function statusOk(perms: MacPerms | null, key: 'screen' | 'microphone' | 'accessibility'): boolean {
  if (!perms) return false
  if (key === 'accessibility') return perms.accessibility
  return perms[key] === 'granted'
}

export default function PermissionGuide({ open, onFinished }: Props) {
  const { t, brand } = useI18n()
  const [perms, setPerms] = useState<MacPerms | null>(null)
  const [busy, setBusy] = useState('')
  const [hint, setHint] = useState('')
  const [confirmPartial, setConfirmPartial] = useState(false)

  function statusText(key: 'screen' | 'microphone' | 'accessibility'): string {
    if (!perms) return t('permGuide.checking')
    if (key === 'accessibility') {
      return perms.accessibility ? t('permGuide.statusGranted') : t('permGuide.statusDenied')
    }
    switch (perms[key]) {
      case 'granted':
        return t('permGuide.statusGranted')
      case 'denied':
        return t('permGuide.statusDenied')
      case 'restricted':
        return t('permGuide.statusRestricted')
      case 'not-determined':
        return t('permGuide.statusPending')
      default:
        return perms[key] || t('settings.permUnknown')
    }
  }

  async function refresh() {
    try {
      setPerms(await window.vipChat.getMacPermissions())
    } catch {
      setPerms(null)
    }
  }

  useEffect(() => {
    if (!open) return
    setConfirmPartial(false)
    setHint('')
    void refresh()
    const timer = setInterval(() => void refresh(), 2000)
    return () => clearInterval(timer)
  }, [open])

  if (!open) return null

  const screenOk = statusOk(perms, 'screen')
  const micOk = statusOk(perms, 'microphone')
  const a11yOk = statusOk(perms, 'accessibility')
  // 屏幕 + 麦克风即可；辅助功能在未签名 Mac 包上不再作为必选项
  const allOk = screenOk && micOk
  const vars = { name: brand.name, voice: brand.voice.name, reply: brand.reply.name }

  async function openPane(pane: 'screen' | 'microphone' | 'accessibility') {
    setBusy(pane)
    setHint('')
    try {
      if (pane === 'microphone') {
        await window.vipChat.requestMacMicrophone()
      }
      await window.vipChat.openMacPrivacy(pane)
      setHint(t('permGuide.hintOpened', vars))
      await refresh()
    } finally {
      setBusy('')
    }
  }

  async function retryA11y() {
    setBusy('a11y')
    try {
      const res = await window.vipChat.retryAccessibility()
      await refresh()
      if (res.ok) {
        setHint(t('permGuide.a11yReady'))
      } else if (res.accessibility || res.needsRelaunch) {
        setHint(t('hud.a11yRelaunch'))
      } else {
        setHint(t('permGuide.a11yStill', vars))
      }
    } finally {
      setBusy('')
    }
  }

  async function finish(skip: boolean) {
    if (!skip && !allOk && !confirmPartial) {
      setConfirmPartial(true)
      setHint(t('permGuide.stillMissing'))
      return
    }
    setBusy('finish')
    try {
      const s = await window.vipChat.getSettings()
      await window.vipChat.saveSettings({ ...s, permissionGuideCompleted: true })
      onFinished()
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="perm-guide-overlay" role="dialog" aria-modal="true" aria-labelledby="perm-guide-title">
      <div className="perm-guide-card">
        <p className="perm-guide-eyebrow">
          <img className="brand-mark" src={brandIcon} alt="" width={28} height={28} aria-hidden />
          {t('permGuide.eyebrow')}
        </p>
        <h2 id="perm-guide-title">{t('permGuide.title', vars)}</h2>
        <p className="perm-guide-lead">{t('permGuide.lead', vars)}</p>

        <ol className="perm-guide-list">
          <li className={screenOk ? 'ok' : ''}>
            <div className="perm-guide-item-head">
              <span className="perm-guide-step">1</span>
              <div>
                <strong>{t('permGuide.screenTitle')}</strong>
                <p>{t('permGuide.screenDesc', vars)}</p>
              </div>
              <span className={`perm-guide-badge ${screenOk ? 'ok' : 'bad'}`}>
                {statusText('screen')}
              </span>
            </div>
            <button
              type="button"
              className="btn secondary"
              disabled={busy === 'screen'}
              onClick={() => void openPane('screen')}
            >
              {t('permGuide.openScreen')}
            </button>
          </li>

          <li className={micOk ? 'ok' : ''}>
            <div className="perm-guide-item-head">
              <span className="perm-guide-step">2</span>
              <div>
                <strong>{t('permGuide.micTitle')}</strong>
                <p>{t('permGuide.micDesc', vars)}</p>
              </div>
              <span className={`perm-guide-badge ${micOk ? 'ok' : 'bad'}`}>
                {statusText('microphone')}
              </span>
            </div>
            <button
              type="button"
              className="btn secondary"
              disabled={busy === 'microphone'}
              onClick={() => void openPane('microphone')}
            >
              {t('permGuide.openMic')}
            </button>
          </li>

          <li className={a11yOk ? 'ok' : ''}>
            <div className="perm-guide-item-head">
              <span className="perm-guide-step">3</span>
              <div>
                <strong>{t('permGuide.a11yTitle')}</strong>
                <p>{t('permGuide.a11yDesc')}</p>
              </div>
              <span className={`perm-guide-badge ${a11yOk ? 'ok' : 'bad'}`}>
                {statusText('accessibility')}
              </span>
            </div>
            <div className="perm-guide-actions">
              <button
                type="button"
                className="btn secondary"
                disabled={busy === 'accessibility'}
                onClick={() => void openPane('accessibility')}
              >
                {t('permGuide.openA11y')}
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={busy === 'a11y'}
                onClick={() => void retryA11y()}
              >
                {t('permGuide.retryA11y')}
              </button>
            </div>
          </li>
        </ol>

        {hint ? <p className="perm-guide-hint">{hint}</p> : null}

        <div className="perm-guide-footer">
          <button type="button" className="btn secondary" disabled={!!busy} onClick={() => void finish(true)}>
            {t('permGuide.later')}
          </button>
          <button type="button" className="btn" disabled={!!busy} onClick={() => void finish(false)}>
            {allOk ? t('permGuide.startReady') : t('permGuide.startPartial')}
          </button>
        </div>
        <p className="perm-guide-note">{t('permGuide.note')}</p>
      </div>
    </div>
  )
}
