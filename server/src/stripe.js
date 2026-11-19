import crypto from 'crypto'

const PRICE_KEYS = {
  standard_month: process.env.STRIPE_PRICE_STANDARD_MONTH || '',
  standard_year: process.env.STRIPE_PRICE_STANDARD_YEAR || '',
  advanced_month: process.env.STRIPE_PRICE_ADVANCED_MONTH || '',
  advanced_year: process.env.STRIPE_PRICE_ADVANCED_YEAR || '',
  flagship_month: process.env.STRIPE_PRICE_FLAGSHIP_MONTH || '',
  flagship_year: process.env.STRIPE_PRICE_FLAGSHIP_YEAR || '',
  topup: process.env.STRIPE_PRICE_TOPUP || ''
}

export function stripeConfigured() {
  return Boolean(String(process.env.STRIPE_SECRET_KEY || '').trim())
}

function flatten(prefix, value, out) {
  if (value == null) return
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(`${prefix}[${i}]`, v, out))
    return
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      flatten(prefix ? `${prefix}[${k}]` : k, v, out)
    }
    return
  }
  out.append(prefix, String(value))
}

async function stripeRequest(method, path, params) {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim()
  if (!key) {
    const err = new Error('Stripe 未配置')
    err.status = 501
    throw err
  }
  const url = new URL(`https://api.stripe.com/v1${path}`)
  const headers = {
    Authorization: `Bearer ${key}`,
    'Stripe-Version': '2024-11-20.acacia'
  }
  const init = { method, headers }
  if (method === 'GET' && params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  } else if (params) {
    const body = new URLSearchParams()
    flatten('', params, body)
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    init.body = body
  }
  const res = await fetch(url, init)
  const json = await res.json()
  if (json.error) {
    const err = new Error(json.error.message || 'Stripe 错误')
    err.status = 400
    throw err
  }
  return json
}

export function parseStripeNote(note) {
  const out = { kind: 'sub', interval: 'month', change: 'open' }
  const kind = /kind=([a-z]+)/.exec(note || '')
  const interval = /interval=([a-z]+)/.exec(note || '')
  const change = /change=([a-z_]+)/.exec(note || '')
  if (kind) out.kind = kind[1]
  if (interval) out.interval = interval[1]
  if (change) out.change = change[1]
  return out
}

function stripeNote(interval, changeType, kind) {
  return `stripe kind=${kind} interval=${interval} change=${changeType}`
}

export async function createStripeCheckout(db, user, body, { newToken, nowIso }) {
  if (!stripeConfigured()) {
    const err = new Error('Stripe 未配置')
    err.status = 501
    err.code = 'STRIPE_NOT_CONFIGURED'
    throw err
  }
  let planId = String(body?.planId || '').trim()
  let interval = String(body?.interval || 'month') === 'year' ? 'year' : 'month'
  let changeType = String(body?.changeType || 'open') || 'open'
  let credits = Number(body?.credits || 0)
  let amountCents = Number(body?.amountCents || 0)
  let kind = 'sub'
  let mode = 'subscription'
  let months = interval === 'year' ? 12 : 1
  let priceKey = ''

  if (planId && planId !== 'trial') {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId)
    if (!plan) {
      const err = new Error('套餐不存在')
      err.status = 400
      throw err
    }
    priceKey = `${planId}_${interval}`
    amountCents = interval === 'year' ? Number(plan.price_year_cents) : Number(plan.price_month_cents)
    if (amountCents <= 0) {
      const err = new Error('该档位无需付费')
      err.status = 400
      throw err
    }
  } else {
    kind = 'topup'
    mode = 'payment'
    planId = ''
    priceKey = 'topup'
    if (credits <= 0) credits = 1000
    if (amountCents <= 0) amountCents = 2000
    months = 0
    changeType = 'topup'
  }

  const priceId = PRICE_KEYS[priceKey]
  if (!priceId) {
    const err = new Error('未配置 Stripe 价格: ' + priceKey)
    err.status = 500
    throw err
  }

  const orderId = `st_${newToken().slice(0, 14)}`
  const t = nowIso()
  const note = stripeNote(interval, changeType, kind)
  db.prepare(
    `INSERT INTO orders
      (id, user_id, source, channel, external_trade_no, plan_id, credits, amount_cents, status, payment_note, created_at, paid_at)
     VALUES (?, ?, 'stripe', 'stripe', '', ?, ?, ?, 'pending', ?, ?, '')`
  ).run(orderId, user.id, planId, credits, amountCents, note, t)

  const meta = {
    order_id: orderId,
    user_id: String(user.id),
    plan_id: planId,
    interval,
    change_type: changeType,
    kind,
    credits: String(credits),
    months: String(months)
  }
  const successUrl =
    process.env.STRIPE_SUCCESS_URL ||
    'https://www.talknow.cn/subscribe/success/?session_id={CHECKOUT_SESSION_ID}'
  const cancelUrl = process.env.STRIPE_CANCEL_URL || 'https://www.talknow.cn/subscribe/'
  const session = await stripeRequest('POST', '/checkout/sessions', {
    mode,
    client_reference_id: orderId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: meta,
    ...(mode === 'subscription'
      ? { subscription_data: { metadata: meta } }
      : { payment_intent_data: { metadata: meta } })
  })
  if (!session.id || !session.url) throw new Error('未能创建 Stripe 结算页')
  db.prepare('UPDATE orders SET external_trade_no = ? WHERE id = ?').run(session.id, orderId)
  return {
    id: orderId,
    status: 'pending',
    source: 'stripe',
    checkoutUrl: session.url,
    sessionId: session.id
  }
}

export function verifyStripeWebhook(rawBody, header) {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()
  if (!secret) throw new Error('未配置 STRIPE_WEBHOOK_SECRET')
  let t = ''
  let v1 = ''
  for (const part of String(header || '').split(',')) {
    const [k, v] = part.trim().split('=', 2)
    if (k === 't') t = v
    if (k === 'v1') v1 = v
  }
  if (!t || !v1) throw new Error('Stripe 签名缺失')
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) throw new Error('Stripe 签名过期')
  const expect = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
  const a = Buffer.from(expect, 'utf8')
  const b = Buffer.from(v1, 'utf8')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Stripe 签名无效')
}

export function fulfillPaidOrder(db, id, opts = {}) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
  if (!order) {
    const err = new Error('order not found')
    err.status = 404
    throw err
  }
  if (order.status === 'paid') return order
  if (order.status === 'rejected') {
    const err = new Error('已拒绝的意向不可履约')
    err.status = 400
    throw err
  }
  const parsed = parseStripeNote(order.payment_note)
  const note = opts.paymentNote || order.payment_note
  const ext = opts.externalTradeNo || order.external_trade_no || ''
  let changeType = opts.changeType || parsed.change || 'open'
  if (changeType === 'topup') changeType = 'open'
  let months = Number(opts.months || 0)
  if (months < 1) months = parsed.interval === 'year' ? 12 : 1
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE orders SET status = 'paid', paid_at = ?, payment_note = ?, external_trade_no = ? WHERE id = ?`
    ).run(nowIsoSafe(db), note, ext, order.id)
    if (order.plan_id) {
      const { changeSubscription } = opts.deps
      changeSubscription(db, order.user_id, order.plan_id, changeType, `履约 ${order.id} ${note}`, months, '', '')
    } else if (order.credits > 0) {
      const reason = order.source === 'stripe' ? 'stripe_topup' : 'offline_topup'
      opts.deps.applyCreditDelta(db, order.user_id, order.credits, reason, 'purchased', order.id, note)
    }
  })
  tx()
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)
}

function nowIsoSafe() {
  return new Date().toISOString()
}

export async function handleStripeWebhook(db, rawBody, header, deps) {
  verifyStripeWebhook(rawBody, header)
  const event = JSON.parse(rawBody)
  const type = event.type || ''
  const obj = event.data?.object || {}

  if (type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded') {
    const paid = obj.payment_status
    if (type === 'checkout.session.completed' && paid !== 'paid' && paid !== 'no_payment_required') {
      return { ok: true, ignored: 'unpaid' }
    }
    const orderId = obj.metadata?.order_id || obj.client_reference_id
    if (!orderId) return { ok: true, ignored: 'no order' }
    fulfillPaidOrder(db, orderId, {
      paymentNote: `stripe webhook ${type}`,
      externalTradeNo: obj.id || '',
      deps
    })
    return { ok: true, fulfilled: orderId }
  }

  if (type === 'invoice.paid') {
    const reason = obj.billing_reason || ''
    if (reason !== 'subscription_cycle') return { ok: true, ignored: reason }
    const meta =
      obj.subscription_details?.metadata || obj.lines?.data?.[0]?.metadata || {}
    const userId = Number(meta.user_id || 0)
    const planId = String(meta.plan_id || '')
    const interval = meta.interval === 'year' ? 'year' : 'month'
    const invId = obj.id || `inv_${Date.now()}`
    if (!userId || !planId) return { ok: true, ignored: 'no meta' }
    const exists = db
      .prepare('SELECT id FROM orders WHERE id = ? OR external_trade_no = ?')
      .get(invId, invId)
    if (exists) return { ok: true, idempotent: true }
    const months = interval === 'year' ? 12 : 1
    const t = nowIsoSafe()
    db.prepare(
      `INSERT INTO orders
        (id, user_id, source, channel, external_trade_no, plan_id, credits, amount_cents, status, payment_note, created_at, paid_at)
       VALUES (?, ?, 'stripe', 'stripe', ?, ?, 0, ?, 'pending', ?, ?, '')`
    ).run(
      invId,
      userId,
      invId,
      planId,
      Number(obj.amount_paid || 0),
      stripeNote(interval, 'renew', 'sub'),
      t
    )
    fulfillPaidOrder(db, invId, {
      paymentNote: 'stripe renewal',
      externalTradeNo: invId,
      changeType: 'renew',
      months,
      deps
    })
    return { ok: true, renewed: invId }
  }

  return { ok: true, ignored: type }
}
