import { useCallback, useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  isTrialOrFreePlan,
  membershipAvatarGlyph,
  membershipDisplayLabel,
  type MembershipMe
} from '../../../shared/membership'
import { useI18n } from '../i18n'

export const OPEN_ACCOUNT_CENTER = 'typenow:open-account-center'

/** 轨底入口：进入个人中心页（含登录与套餐） */
export default function AccountCenter() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [loggedIn, setLoggedIn] = useState(false)
  const [glyph, setGlyph] = useState('我')
  const [label, setLabel] = useState('')
  const [planId, setPlanId] = useState('')
  const [planName, setPlanName] = useState('')

  const load = useCallback(async (): Promise<void> => {
    try {
      const s = await window.vipChat.getSettings()
      const ok = Boolean(s.membershipAccessToken)
      setLoggedIn(ok)
      if (!ok) {
        setGlyph('我')
        setLabel('')
        setPlanId('')
        setPlanName('')
        return
      }
      try {
        const me = (await window.vipChat.membershipGetMe()) as MembershipMe
        setGlyph(membershipAvatarGlyph(me))
        setLabel(membershipDisplayLabel(me))
        setPlanId(me.plan?.id || 'trial')
        setPlanName(me.plan?.name || t('membership.defaultTrial'))
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e || '')
        if (/401|UNAUTHORIZED/i.test(msg)) {
          await window.vipChat.saveSettings({
            ...s,
            membershipAccessToken: '',
            modelRoutingMode: 'byok'
          })
          setLoggedIn(false)
          window.dispatchEvent(new CustomEvent('typenow:account-changed'))
        }
        setGlyph('我')
        setLabel('')
        setPlanId('')
        setPlanName('')
      }
    } catch {
      setLoggedIn(false)
      setGlyph('我')
      setLabel('')
      setPlanId('')
      setPlanName('')
    }
  }, [t])

  useEffect(() => {
    void load()
    const onChanged = (): void => {
      void load()
    }
    const onOpen = (): void => {
      navigate('/account')
    }
    window.addEventListener('typenow:account-changed', onChanged)
    window.addEventListener(OPEN_ACCOUNT_CENTER, onOpen)
    return () => {
      window.removeEventListener('typenow:account-changed', onChanged)
      window.removeEventListener(OPEN_ACCOUNT_CENTER, onOpen)
    }
  }, [load, navigate])

  const trial = loggedIn && isTrialOrFreePlan(planId)

  return (
    <div className="account-center">
      <NavLink
        to={trial ? '/account#plans' : '/account'}
        className={({ isActive }) =>
          `account-trigger${isActive ? ' open' : ''}${loggedIn ? ' in' : ''}`
        }
        title={
          loggedIn && label
            ? `${t('account.title')} · ${label}${planName ? ` · ${planName}` : ''}`
            : t('account.title')
        }
      >
        <span className="account-avatar" aria-hidden>
          {loggedIn ? glyph : '我'}
        </span>
        <span className="account-trigger-label">
          {loggedIn && label ? label : t('account.title')}
        </span>
        {loggedIn && planName ? (
          <span className={`plan-tier-tag rail${trial ? ' trial' : ''}`}>{planName}</span>
        ) : null}
      </NavLink>
    </div>
  )
}
