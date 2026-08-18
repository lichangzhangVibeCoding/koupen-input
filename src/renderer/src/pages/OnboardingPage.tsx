import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  defaultScreenAskHotkey,
  formatHotkeyLabel,
  formatVoiceHoldBindLabel,
  formatVoiceTapBindLabel,
  formatVoiceTriggerShortLabel,
  normalizeVoiceTrigger
} from '../../../shared/hotkey'
import type { AppSettings } from '../../../shared/types'
import { useI18n } from '../i18n'

type GuideStep = 'welcome' | 'voice' | 'aiTalk' | 'reply' | 'screenAsk' | 'wrap'
type SkillId = 'voice' | 'aiTalk' | 'reply' | 'screenAsk'

const SKILL_ORDER: SkillId[] = ['voice', 'aiTalk', 'reply', 'screenAsk']
const OPEN_PERMISSION_GUIDE = 'typenow:open-permission-guide'

function skillIndex(step: GuideStep): number {
  const i = SKILL_ORDER.indexOf(step as SkillId)
  return i >= 0 ? i + 1 : 0
}

function nextStep(step: GuideStep): GuideStep {
  switch (step) {
    case 'welcome':
      return 'voice'
    case 'voice':
      return 'aiTalk'
    case 'aiTalk':
      return 'reply'
    case 'reply':
      return 'screenAsk'
    case 'screenAsk':
      return 'wrap'
    default:
      return 'wrap'
  }
}

export default function OnboardingPage() {
  const { t, brand } = useI18n()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const replyRef = useRef<HTMLTextAreaElement | null>(null)
  const [step, setStep] = useState<GuideStep>('welcome')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [platform, setPlatform] = useState('darwin')
  const [micOk, setMicOk] = useState(true)
  const [stepDone, setStepDone] = useState(false)
  const [busySave, setBusySave] = useState(false)

  const isWin = platform === 'win32'
  const plat = (isWin ? 'win32' : 'darwin') as NodeJS.Platform
  const trigger = normalizeVoiceTrigger(settings?.voiceTrigger)
  const voiceTap = formatVoiceTapBindLabel(plat, trigger)
  const voiceHold = formatVoiceHoldBindLabel(plat, trigger)
  const voiceKey = formatVoiceTriggerShortLabel(trigger, plat)
  const replyKey = formatHotkeyLabel(settings?.hotkey || (isWin ? 'DoubleAlt' : 'DoubleCommand'), plat)
  const askKey = formatHotkeyLabel(
    settings?.screenAskHotkey || defaultScreenAskHotkey(plat),
    plat
  )

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([window.vipChat.getSettings(), window.vipChat.getPlatform()])
    setSettings(s)
    setPlatform(p)
    if (p === 'darwin') {
      try {
        const perms = await window.vipChat.getMacPermissions()
        setMicOk(perms.microphone === 'granted')
      } catch {
        setMicOk(true)
      }
    } else {
      setMicOk(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setStepDone(false)
    if (inputRef.current) inputRef.current.value = ''
    if (replyRef.current) replyRef.current.value = ''
    const tmr = window.setTimeout(() => {
      if (step === 'voice' || step === 'aiTalk') inputRef.current?.focus()
      if (step === 'reply') replyRef.current?.focus()
    }, 80)
    return () => window.clearTimeout(tmr)
  }, [step])

  useEffect(() => {
    const api = window.vipChat
    if (typeof api.onSkillGuideStep !== 'function') return
    const off = api.onSkillGuideStep((ev) => {
      if (!ev.ok) return
      if (ev.id !== step) return
      setStepDone(true)
    })
    return off
  }, [step])

  useEffect(() => {
    if (!stepDone) return
    if (step === 'welcome' || step === 'wrap') return
    const tmr = window.setTimeout(() => setStep(nextStep(step)), 900)
    return () => window.clearTimeout(tmr)
  }, [stepDone, step])

  async function markCompleted(): Promise<void> {
    const s = settings || (await window.vipChat.getSettings())
    setBusySave(true)
    try {
      const next = { ...s, skillGuideCompleted: true }
      await window.vipChat.saveSettings(next)
      setSettings(next)
      navigate('/', { replace: true })
    } finally {
      setBusySave(false)
    }
  }

  const needsMic = step === 'voice' || step === 'aiTalk' || step === 'screenAsk'
  const showCredits = step === 'voice' || step === 'aiTalk' || step === 'reply' || step === 'screenAsk'

  return (
    <section className="guide-page">
      <header className="guide-head">
        <p className="guide-kicker">{t('guide.title')}</p>
        {step === 'welcome' ? <p className="guide-lead">{t('guide.lead')}</p> : null}
        <h1 className="guide-title">
          {step === 'welcome'
            ? t('guide.welcomeTitle')
            : step === 'voice'
              ? t('guide.voiceTitle')
              : step === 'aiTalk'
                ? t('guide.aiTalkTitle')
                : step === 'reply'
                  ? t('guide.replyTitle')
                  : step === 'screenAsk'
                    ? t('guide.screenTitle')
                    : t('guide.wrapTitle')}
        </h1>
        <p className="guide-lead">
          {step === 'welcome'
            ? t('guide.welcomeBody')
            : step === 'voice'
              ? t('guide.voiceBody')
              : step === 'aiTalk'
                ? t('guide.aiTalkBody')
                : step === 'reply'
                  ? t('guide.replyBody')
                  : step === 'screenAsk'
                    ? t('guide.screenBody')
                    : t('guide.wrapBody')}
        </p>
        {skillIndex(step) > 0 ? (
          <p className="guide-progress">{t('guide.progress', { n: String(skillIndex(step)) })}</p>
        ) : null}
      </header>

      {step === 'welcome' ? (
        <ul className="guide-caps">
          <li>
            <strong>{brand.voice.name}</strong>
            <span className="kbd">{voiceTap}</span>
            <em>{t('guide.cmd.voice')}</em>
          </li>
          <li>
            <strong>{brand.aiTalk.name}</strong>
            <span className="kbd">{voiceHold}</span>
            <em>{t('guide.cmd.aiTalk')}</em>
          </li>
          <li>
            <strong>{brand.reply.name}</strong>
            <span className="kbd">{replyKey}</span>
            <em>{t('guide.cmd.reply')}</em>
          </li>
          <li>
            <strong>{brand.screenAsk.name}</strong>
            <span className="kbd">{askKey}</span>
            <em>{t('guide.cmd.screenAsk')}</em>
          </li>
        </ul>
      ) : null}

      {step === 'voice' || step === 'aiTalk' ? (
        <div className="guide-stage">
          <p className="guide-now">
            {t('guide.waiting')}{' '}
            <span className="kbd">{step === 'voice' ? voiceKey : voiceHold}</span>
          </p>
          <p className="guide-say">{step === 'voice' ? t('guide.voiceSay') : t('guide.aiTalkSay')}</p>
          <textarea
            ref={inputRef}
            className="guide-input"
            rows={5}
            placeholder={t('guide.pasteHere')}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      ) : null}

      {step === 'reply' ? (
        <div className="guide-chat" aria-label={brand.reply.name}>
          <p className="guide-now">
            {t('guide.waiting')} <span className="kbd">{replyKey}</span>
          </p>
          <div className="guide-bubble them">{t('guide.replyThem1')}</div>
          <div className="guide-bubble me">{t('guide.replyYou1')}</div>
          <div className="guide-bubble them">{t('guide.replyThem2')}</div>
          <textarea
            ref={replyRef}
            className="guide-input guide-chat-input"
            rows={3}
            placeholder={t('guide.pasteHere')}
          />
        </div>
      ) : null}

      {step === 'screenAsk' ? (
        <div className="guide-quiz">
          <p className="guide-now">
            {t('guide.waiting')} <span className="kbd">{askKey}</span>
          </p>
          <p className="guide-quiz-q">{t('guide.screenQuizQ')}</p>
          <ul>
            <li>{t('guide.screenQuizA')}</li>
            <li>{t('guide.screenQuizB')}</li>
            <li>{t('guide.screenQuizC')}</li>
          </ul>
        </div>
      ) : null}

      {step === 'wrap' ? (
        <div className="guide-wrap">
          <p className="guide-esc">
            <span className="kbd">Esc</span>
            {t('guide.wrapEsc')}
          </p>
          <p className="guide-after">{t('guide.afterHint')}</p>
        </div>
      ) : null}

      {needsMic && !micOk ? (
        <p className="guide-warn">
          {t('guide.needMic')}{' '}
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PERMISSION_GUIDE))}
          >
            {t('guide.openPerms')}
          </button>
        </p>
      ) : null}

      {showCredits ? <p className="guide-hint">{t('guide.creditsHint')}</p> : null}
      {stepDone ? <p className="guide-ok">{t('guide.doneStep')}</p> : null}

      <footer className="guide-foot">
        {step === 'welcome' ? (
          <button type="button" className="btn" onClick={() => setStep('voice')}>
            {t('guide.next')}
          </button>
        ) : null}
        {step === 'wrap' ? (
          <button type="button" className="btn" disabled={busySave} onClick={() => void markCompleted()}>
            {t('guide.start')}
          </button>
        ) : null}
        {step !== 'welcome' && step !== 'wrap' ? (
          <button type="button" className="btn ghost sm" onClick={() => setStep(nextStep(step))}>
            {t('guide.skipStep')}
          </button>
        ) : null}
        {step !== 'wrap' ? (
          <button type="button" className="btn ghost sm" disabled={busySave} onClick={() => void markCompleted()}>
            {t('guide.skipAll')}
          </button>
        ) : null}
      </footer>
    </section>
  )
}
