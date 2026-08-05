import { Link } from 'react-router-dom'
import { isTrialOrFreePlan } from '../../../shared/membership'
import { useI18n } from '../i18n'

/** 套餐小标签；体验/免费档可附带「升级」跳到个人中心套餐区 */
export default function PlanTierBadge({
  planId,
  planName,
  showUpgrade = true,
  className = ''
}: {
  planId?: string | null
  planName?: string | null
  showUpgrade?: boolean
  className?: string
}) {
  const { t } = useI18n()
  const name = String(planName || '').trim() || t('membership.defaultTrial')
  const trial = isTrialOrFreePlan(planId)
  const canUpgrade = showUpgrade && trial && name !== '…'
  return (
    <span className={`plan-tier-wrap${className ? ` ${className}` : ''}`}>
      <span className={`plan-tier-tag${trial ? ' trial' : ''}`}>{name}</span>
      {canUpgrade ? (
        <Link className="plan-tier-upgrade" to="/account#plans">
          {t('membership.upgrade')}
        </Link>
      ) : null}
    </span>
  )
}
