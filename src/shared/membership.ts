/** Shared membership API types (client ↔ server payload) */

import type { AppSettings } from './types'

export type MembershipCapability =
  | 'reply'
  | 'reply_vision'
  | 'screen_ask'
  | 'screen_quiz'
  | 'chat'

export type MembershipUsage = {
  /** 本周期套餐基础额度 */
  periodQuota: number
  /** 本周期已消耗（consume） */
  periodUsed: number
  /** 本周期剩余基础额度 */
  periodRemaining: number
  /** 账户钱包余额（含加量/兑换结余） */
  walletBalance: number
}

export type MembershipLedgerEntry = {
  id: number
  delta: number
  balanceAfter: number
  reason: string
  grantType: string
  requestId: string
  note: string
  createdAt: string
}

export type MembershipLedgerPayload = {
  days: number
  from: string
  to: string
  ledger: MembershipLedgerEntry[]
}

export type MembershipMe = {
  id: number
  phone: string
  /** 用户昵称（服务端 display_name） */
  displayName?: string
  frozen?: boolean
  balance: number
  plan: {
    id: string
    name: string
    /** 基础 + 赠送总量（周期额度） */
    monthlyCredits: number
    baseCredits?: number
    giftCredits?: number
    priceMonthCents: number
    priceYearCents: number
  } | null
  subscription: {
    status: string
    periodStart: string
    periodEnd: string
    pendingPlanId?: string
  } | null
  usage?: MembershipUsage
  prices: Record<string, number>
  estimate: { voiceMinutes: number; replyTimes: number; screenAskTimes: number }
  ops: { paymentHint: string; supportContact: string }
  /** 官方三槽模型 id（无 Key）；切官方会员时同步到本地 */
  modelRoutes?: {
    asr: string
    vision: string
    chat: string
  }
}

/** 退出或 token 失效：清登录态，默认仍留官方会员（已切本地则不动跑法） */
export function clearMembershipSession(settings: AppSettings): AppSettings {
  return {
    ...settings,
    membershipAccessToken: '',
    ...(settings.inferenceMode === 'local' ? {} : { modelRoutingMode: 'membership' as const })
  }
}

/** 档位高低：trial < standard < advanced < flagship */
export function membershipPlanRank(planId: string): number {
  const map: Record<string, number> = {
    trial: 0,
    free: 0,
    standard: 1,
    advanced: 2,
    pro: 2,
    flagship: 3,
    max: 3
  }
  return map[planId] ?? -1
}

/** 体验 / 免费档（需引导升级） */
export function isTrialOrFreePlan(planId?: string | null): boolean {
  const id = String(planId || '').trim()
  return !id || id === 'trial' || id === 'free'
}

/** 手机号脱敏展示 */
export function maskPhone(phone: string): string {
  const d = String(phone || '').replace(/\D/g, '')
  if (d.length >= 7) return `${d.slice(0, 3)}****${d.slice(-4)}`
  return String(phone || '').trim() || '—'
}

/** 优先自定义昵称，否则脱敏手机号（默认 display_name=phone 时不暴露全号） */
export function membershipDisplayLabel(me: {
  displayName?: string
  phone?: string
}): string {
  const name = String(me.displayName || '').trim()
  const phone = String(me.phone || '').trim()
  if (name && name !== phone) return name
  return maskPhone(phone)
}

/** 轨底/头像用的短标（昵称首字或手机尾号） */
export function membershipAvatarGlyph(me: {
  displayName?: string
  phone?: string
}): string {
  const name = String(me.displayName || '').trim()
  if (name) {
    const ch = Array.from(name)[0]
    if (ch) return ch
  }
  const d = String(me.phone || '').replace(/\D/g, '')
  return d.slice(-2) || '我'
}
