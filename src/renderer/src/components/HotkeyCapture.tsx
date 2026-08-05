import { useEffect, useRef, useState } from 'react'
import {
  formatHotkeyLabel,
  formatVoiceTriggerShortLabel,
  hotkeyLabelChips,
  type VoiceTriggerId
} from '../../../shared/hotkey'
import { useI18n } from '../i18n'
import { eventToAccelerator, eventToVoiceTrigger } from '../lib/hotkey-capture'

function Chips({ label }: { label: string }) {
  const chips = hotkeyLabelChips(label)
  if (!chips.length) return null
  return (
    <span className="settings-kbd-row">
      {chips.map((c, i) => (
        <kbd key={`${c}-${i}`} className="kbd settings-kbd">
          {c}
        </kbd>
      ))}
    </span>
  )
}

/** 组合键录制（帮我对话自定义 / 看屏幕 / 答题） */
export function ComboHotkeyCapture({
  platform,
  value,
  onChange,
  onCancel,
  recommendedLabel,
  onUseRecommended
}: {
  platform: string
  value: string
  onChange: (accel: string) => void
  onCancel: () => void
  recommendedLabel?: string
  onUseRecommended?: () => void
}) {
  const { t } = useI18n()
  const [hint, setHint] = useState('')
  const onChangeRef = useRef(onChange)
  const onCancelRef = useRef(onCancel)
  onChangeRef.current = onChange
  onCancelRef.current = onCancel

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const next = eventToAccelerator(e, platform)
      if (next === '__cancel__') {
        onCancelRef.current()
        return
      }
      if (!next) {
        setHint(t('settings.hotkeys.captureWaitKey'))
        return
      }
      setHint('')
      onChangeRef.current(next)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [platform, t])

  const display = value ? formatHotkeyLabel(value, platform as NodeJS.Platform) : ''

  return (
    <div className="settings-capture">
      <div className="settings-capture-pulse" aria-live="polite">
        <span className="settings-capture-dot" />
        {t('settings.hotkeys.captureListening')}
      </div>
      {display ? <Chips label={display} /> : null}
      {hint ? <p className="settings-hint">{hint}</p> : null}
      <p className="settings-hint">{t('settings.hotkeys.captureHint')}</p>
      <div className="settings-capture-actions">
        {onUseRecommended && recommendedLabel ? (
          <button type="button" className="btn secondary sm" onClick={onUseRecommended}>
            {t('settings.hotkeys.useRecommended', { label: recommendedLabel })}
          </button>
        ) : null}
        <button type="button" className="btn ghost sm" onClick={onCancel}>
          {t('settings.hotkeys.captureCancel')}
        </button>
      </div>
    </div>
  )
}

/** 即刻对话触发键录制（Mac：右 Command / 右 Option / Fn） */
export function VoiceTriggerCapture({
  value,
  onChange,
  onCancel
}: {
  value: VoiceTriggerId
  onChange: (id: VoiceTriggerId) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [hint, setHint] = useState('')
  const onChangeRef = useRef(onChange)
  const onCancelRef = useRef(onCancel)
  onChangeRef.current = onChange
  onCancelRef.current = onCancel

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const next = eventToVoiceTrigger(e)
      if (next === '__cancel__') {
        onCancelRef.current()
        return
      }
      if (next === '__wrong_side__') {
        setHint(t('settings.hotkeys.captureRightSide'))
        return
      }
      if (!next) {
        setHint(t('settings.hotkeys.captureVoiceWait'))
        return
      }
      setHint('')
      onChangeRef.current(next)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [t])

  return (
    <div className="settings-capture">
      <div className="settings-capture-pulse" aria-live="polite">
        <span className="settings-capture-dot" />
        {t('settings.hotkeys.captureListening')}
      </div>
      <Chips label={formatVoiceTriggerShortLabel(value, 'darwin')} />
      {hint ? <p className="settings-hint">{hint}</p> : null}
      <p className="settings-hint">{t('settings.hotkeys.captureVoiceHint')}</p>
      <div className="settings-capture-actions">
        <button type="button" className="btn ghost sm" onClick={onCancel}>
          {t('settings.hotkeys.captureCancel')}
        </button>
      </div>
    </div>
  )
}
