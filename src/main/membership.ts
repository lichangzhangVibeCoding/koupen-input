import type { AppSettings } from '../shared/types'
import type {
  MembershipCapability,
  MembershipLedgerPayload,
  MembershipMe
} from '../shared/membership'

export type { MembershipCapability, MembershipMe }

function serverBase(settings: AppSettings): string {
  return (
    settings.membershipServerUrl ||
    'https://www.lizhenning.com/other/typenow/talknowAPi/index.php'
  ).replace(/\/+$/, '')
}

export function usesMembershipCloud(settings: AppSettings): boolean {
  return (
    settings.modelRoutingMode === 'membership' &&
    Boolean(settings.membershipAccessToken?.trim()) &&
    Boolean(serverBase(settings))
  )
}

export function membershipChatBase(settings: AppSettings): string {
  return `${serverBase(settings)}/v1/proxy`
}

export function membershipAuthHeaders(settings: AppSettings, capability?: MembershipCapability): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${settings.membershipAccessToken.trim()}`
  }
  if (capability) h['X-TalkNow-Capability'] = capability
  return h
}

async function membershipFetch(
  settings: AppSettings,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = `${serverBase(settings)}${path}`
  const headers = new Headers(init.headers || {})
  if (settings.membershipAccessToken) {
    headers.set('Authorization', `Bearer ${settings.membershipAccessToken.trim()}`)
  }
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(url, { ...init, headers })
}

export async function membershipRequestCode(settings: AppSettings, phone: string): Promise<void> {
  const p = String(phone || '').replace(/\D+/g, '')
  if (p.length < 6) throw new Error('请输入有效手机号')
  const res = await membershipFetch(settings, '/v1/auth/request-code', {
    method: 'POST',
    body: JSON.stringify({ phone: p })
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(data.error || `请求验证码失败 (${res.status})`)
}

export async function membershipLogin(
  settings: AppSettings,
  phone: string,
  code: string
): Promise<{ accessToken: string; me: MembershipMe }> {
  const p = String(phone || '').replace(/\D+/g, '')
  const c = String(code || '').trim()
  if (p.length < 6) throw new Error('请输入有效手机号')
  if (!c) throw new Error('请输入验证码')
  const res = await membershipFetch(settings, '/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: p, code: c })
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    accessToken?: string
    me?: MembershipMe
  }
  if (!res.ok || !data.accessToken || !data.me) {
    throw new Error(data.error || `登录失败 (${res.status})`)
  }
  return { accessToken: data.accessToken, me: data.me }
}

export async function membershipGetMe(settings: AppSettings): Promise<MembershipMe> {
  const res = await membershipFetch(settings, '/v1/me')
  const data = (await res.json().catch(() => ({}))) as MembershipMe & { error?: string; code?: string }
  if (!res.ok) {
    const detail = data.error || data.code || `HTTP ${res.status}`
    throw new Error(
      res.status === 401 || data.code === 'UNAUTHORIZED'
        ? `UNAUTHORIZED: ${detail}`
        : `获取会员信息失败 (${res.status}): ${detail}`
    )
  }
  return data
}

export async function membershipUpdateProfile(
  settings: AppSettings,
  displayName: string
): Promise<MembershipMe> {
  const name = String(displayName || '').trim()
  if (!name) throw new Error('昵称不能为空')
  if (Array.from(name).length > 32) throw new Error('昵称最多 32 个字符')
  const res = await membershipFetch(settings, '/v1/me-save', {
    method: 'POST',
    body: JSON.stringify({ displayName: name })
  })
  const data = (await res.json().catch(() => ({}))) as MembershipMe & { error?: string }
  if (!res.ok) throw new Error(data.error || `更新资料失败 (${res.status})`)
  return data
}

export async function membershipGetLedger(
  settings: AppSettings,
  opts: { days?: number; from?: string; to?: string } = {}
): Promise<MembershipLedgerPayload> {
  const q = new URLSearchParams()
  if (opts.days) q.set('days', String(opts.days))
  if (opts.from) q.set('from', opts.from)
  if (opts.to) q.set('to', opts.to)
  const qs = q.toString()
  const res = await membershipFetch(settings, `/v1/ledger${qs ? `?${qs}` : ''}`)
  const data = (await res.json().catch(() => ({}))) as MembershipLedgerPayload & { error?: string }
  if (!res.ok) throw new Error(data.error || `获取用量明细失败 (${res.status})`)
  return {
    days: data.days || opts.days || 7,
    from: data.from || '',
    to: data.to || '',
    ledger: Array.isArray(data.ledger) ? data.ledger : []
  }
}

export async function membershipGetPlans(settings: AppSettings): Promise<unknown> {
  const res = await membershipFetch(settings, '/v1/plans')
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || '获取套餐失败')
  return data
}

export async function membershipRedeem(settings: AppSettings, code: string): Promise<MembershipMe> {
  const res = await membershipFetch(settings, '/v1/redeem', {
    method: 'POST',
    body: JSON.stringify({ code })
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    me?: MembershipMe
  }
  if (!res.ok || !data.me) throw new Error(data.error || '兑换失败')
  return data.me
}

export async function membershipCreateOfflineIntent(
  settings: AppSettings,
  body: { planId?: string; credits?: number; amountCents?: number }
): Promise<{ paymentHint: string; supportContact: string; id: string }> {
  const res = await membershipFetch(settings, '/v1/orders', {
    method: 'POST',
    body: JSON.stringify({ source: 'offline', ...body })
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    paymentHint?: string
    supportContact?: string
    id?: string
  }
  if (!res.ok) throw new Error(data.error || '创建意向失败')
  return {
    id: data.id || '',
    paymentHint: data.paymentHint || '',
    supportContact: data.supportContact || ''
  }
}

export async function membershipCreateStripeCheckout(
  settings: AppSettings,
  body: {
    planId?: string
    interval?: 'month' | 'year'
    changeType?: string
    credits?: number
    amountCents?: number
  }
): Promise<{ id: string; checkoutUrl: string; sessionId: string }> {
  const res = await membershipFetch(settings, '/v1/orders', {
    method: 'POST',
    body: JSON.stringify({ source: 'stripe', ...body })
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    id?: string
    checkoutUrl?: string
    sessionId?: string
  }
  if (!res.ok || !data.checkoutUrl) throw new Error(data.error || '无法创建 Stripe 结算')
  return {
    id: data.id || '',
    checkoutUrl: data.checkoutUrl,
    sessionId: data.sessionId || ''
  }
}

export function formatMembershipHttpError(status: number, body: string): string {
  try {
    const j = JSON.parse(body) as {
      error?: string | { message?: string }
      message?: string
      code?: string | number
      detail?: string
    }
    if (status === 402 || j.code === 'INSUFFICIENT_CREDITS') {
      const errText = typeof j.error === 'string' ? j.error : j.error?.message
      return errText || '官方积分不足，请充值或改回「自配 Key」'
    }
    const errText =
      (typeof j.error === 'string' ? j.error : j.error?.message) ||
      j.message ||
      j.detail
    if (errText) return `会员服务请求失败 (${status}): ${String(errText).slice(0, 200)}`
  } catch {
    /* ignore */
  }
  return `会员服务请求失败 (${status})`
}
