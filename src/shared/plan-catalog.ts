/**
 * 套餐营销结构（App 个人中心 + 官网订阅页同源）。
 *
 * 数据源：`plan-catalog.json`（改数字回退 / 权益结构只改 JSON）
 * 价格与积分线上以 GET /v1/plans 为准。
 * 改 JSON 后执行：npm run sync:plans → website/js/plan-catalog.js
 */

import raw from './plan-catalog.json'

export type PlanId = 'trial' | 'standard' | 'advanced' | 'flagship'

export type PlanFeatureKind =
  | 'credits'
  | 'officialSlots'
  | 'byok'
  | 'local'
  | 'light'
  | 'nocode'
  | 'heavy'
  | 'priority'

export type PlanCatalogEntry = {
  id: PlanId
  featured?: boolean
  featureKinds: PlanFeatureKind[]
}

export type PlanFallbackRow = {
  id: PlanId
  nameZh: string
  nameEn: string
  baseCredits: number
  giftCredits: number
  priceMonthCents: number
  priceYearCents: number
}

type CatalogFile = {
  order: PlanId[]
  catalog: Record<PlanId, PlanCatalogEntry>
  fallback: PlanFallbackRow[]
  topupFallback: { credits: number; priceCents: number }
  plansApi: string
}

const data = raw as CatalogFile

export const PLAN_ORDER = data.order
export const PLAN_CATALOG = data.catalog
export const PLAN_FALLBACK = data.fallback
export const PLAN_TOPUP_FALLBACK = data.topupFallback
export const PLANS_PUBLIC_API = data.plansApi

export type PlanCreditsInput = {
  id: string
  monthlyCredits: number
  baseCredits?: number
  giftCredits?: number
}

export type TranslateFn = (key: string, vars?: Record<string, string>) => string

export function planRank(planId: string): number {
  const i = PLAN_ORDER.indexOf(planId as PlanId)
  return i >= 0 ? i : 50
}

export function sortPlansByCatalog<T extends { id: string; monthlyCredits?: number }>(
  list: T[]
): T[] {
  return [...list].sort((a, b) => {
    const ra = planRank(a.id)
    const rb = planRank(b.id)
    if (ra !== rb) return ra - rb
    return (a.monthlyCredits || 0) - (b.monthlyCredits || 0)
  })
}

export function buildPlanFeatureLines(plan: PlanCreditsInput, t: TranslateFn): string[] {
  const id = (PLAN_ORDER.includes(plan.id as PlanId) ? plan.id : 'trial') as PlanId
  const meta = PLAN_CATALOG[id]
  const gift = plan.giftCredits ?? 0
  const base = plan.baseCredits ?? Math.max(0, (plan.monthlyCredits || 0) - gift)

  return meta.featureKinds
    .map((kind) => {
      switch (kind) {
        case 'credits':
          if (gift > 0) {
            return t('membership.feat.baseGift', {
              base: String(base),
              gift: String(gift)
            })
          }
          return t('membership.feat.baseCredits', {
            n: String(base || plan.monthlyCredits || 0)
          })
        case 'officialSlots':
          return t('membership.feat.officialSlots')
        case 'byok':
          return t('membership.feat.byok')
        case 'local':
          return t('membership.feat.local')
        case 'light':
          return t('membership.feat.light')
        case 'nocode':
          return t('membership.feat.nocode')
        case 'heavy':
          return t('membership.feat.heavy')
        case 'priority':
          return t('membership.feat.priority')
        default:
          return ''
      }
    })
    .filter(Boolean)
}

export function planBlurbKey(planId: string): string {
  const id = PLAN_ORDER.includes(planId as PlanId) ? planId : 'trial'
  return `membership.blurb.${id}`
}

export function isPlanFeatured(planId: string): boolean {
  const id = planId as PlanId
  return Boolean(PLAN_CATALOG[id]?.featured)
}

/** 供 sync 脚本读取的原始 JSON */
export function getPlanCatalogFile(): CatalogFile {
  return data
}
