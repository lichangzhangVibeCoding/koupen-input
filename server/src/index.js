import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import multer from 'multer'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { openDb, hashToken, newToken, nowIso } from './db.js'
import {
  chargeCredits,
  createOfflineOrder,
  createSession,
  ensureUser,
  estimateAudioMinutes,
  getAppSetting,
  getBalance,
  getPrices,
  mePayload,
  publicModelRoutes,
  userLedger,
  requireUser,
  setAppSetting,
  applyCreditDelta,
  assignPlan,
  changeSubscription
} from './credits.js'
import {
  createStripeCheckout,
  fulfillPaidOrder,
  handleStripeWebhook,
  stripeConfigured
} from './stripe.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dataDir = process.env.DATA_DIR || join(root, 'data')
const db = openDb(dataDir)
const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } })

app.use(cors())
app.post('/v1/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '')
    const result = await handleStripeWebhook(db, raw, req.headers['stripe-signature'] || '', {
      applyCreditDelta,
      changeSubscription
    })
    res.json(result)
  } catch (e) {
    res.status(400).json({ error: e.message || 'webhook failed' })
  }
})
app.use(express.json({ limit: '30mb' }))
app.use('/admin', express.static(join(root, 'public', 'admin')))

function publicError(res, err) {
  const status = err.status || (err.code === 'INSUFFICIENT_CREDITS' ? 402 : 500)
  const message =
    err.code === 'INSUFFICIENT_CREDITS'
      ? `积分不足（当前 ${err.balance ?? 0}）。请充值或改用自配 Key。`
      : err.message || 'error'
  res.status(status).json({ error: message, code: err.code || err.message })
}

function getRoute(slot) {
  return db.prepare('SELECT * FROM model_routes WHERE slot = ?').get(slot)
}

async function upstreamFetch(baseUrl, apiKey, path, init) {
  const url = `${baseUrl.replace(/\/+$/, '')}${path}`
  const headers = { ...(init.headers || {}), Authorization: `Bearer ${apiKey}` }
  const res = await fetch(url, { ...init, headers })
  const text = await res.text()
  return { res, text }
}

// ── Auth ──
app.post('/v1/auth/request-code', (req, res) => {
  const phone = String(req.body?.phone || '').replace(/\D/g, '')
  if (phone.length < 6) return res.status(400).json({ error: 'invalid phone' })
  const code = process.env.DEV_LOGIN_CODE || String(Math.floor(100000 + Math.random() * 900000))
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  db.prepare(
    `INSERT INTO login_codes (phone, code, expires_at) VALUES (?, ?, ?)
     ON CONFLICT(phone) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at`
  ).run(phone, code, expires)
  const payload = { ok: true, expiresAt: expires }
  if (process.env.DEV_LOGIN_CODE) payload.devHint = '开发态：使用 DEV_LOGIN_CODE 登录'
  res.json(payload)
})

app.post('/v1/auth/login', (req, res) => {
  const phone = String(req.body?.phone || '').replace(/\D/g, '')
  const code = String(req.body?.code || '').trim()
  if (!phone || !code) return res.status(400).json({ error: 'phone and code required' })
  const row = db.prepare('SELECT * FROM login_codes WHERE phone = ?').get(phone)
  const dev = process.env.DEV_LOGIN_CODE
  const ok =
    (dev && code === dev) || (row && row.code === code && new Date(row.expires_at) > new Date())
  if (!ok) return res.status(401).json({ error: '验证码无效或已过期' })
  db.prepare('DELETE FROM login_codes WHERE phone = ?').run(phone)
  const user = ensureUser(db, phone)
  if (user.frozen) return res.status(403).json({ error: '账号已冻结' })
  const session = createSession(db, user.id)
  res.json({ ...session, me: mePayload(db, user) })
})

app.get('/v1/me', (req, res) => {
  try {
    const user = requireUser(db, req)
    res.json(mePayload(db, user))
  } catch (e) {
    publicError(res, e)
  }
})

app.post('/v1/me-save', (req, res) => {
  try {
    const user = requireUser(db, req)
    const name = String(req.body?.displayName || '')
      .trim()
      .replace(/[\x00-\x1F\x7F]+/g, '')
    if (!name) return res.status(400).json({ error: '昵称不能为空' })
    if ([...name].length > 32) return res.status(400).json({ error: '昵称最多 32 个字符' })
    const now = new Date().toISOString()
    db.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').run(
      name,
      now,
      user.id
    )
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
    res.json(mePayload(db, updated))
  } catch (e) {
    publicError(res, e)
  }
})

app.get('/v1/ledger', (req, res) => {
  try {
    const user = requireUser(db, req)
    const days = Number(req.query.days || 7)
    const from = String(req.query.from || '')
    const to = String(req.query.to || '')
    res.json(userLedger(db, user.id, days, from, to))
  } catch (e) {
    publicError(res, e)
  }
})

app.get('/v1/plans', (_req, res) => {
  const plans = db
    .prepare('SELECT * FROM plans WHERE active = 1 ORDER BY sort_order')
    .all()
    .map((p) => ({
      id: p.id,
      name: p.name,
      monthlyCredits: p.monthly_credits,
      priceMonthCents: p.price_month_cents,
      priceYearCents: p.price_year_cents
    }))
  res.json({
    plans,
    prices: getPrices(db),
    topup: { credits: 1000, priceCents: 2000 },
    stripeEnabled: stripeConfigured(),
    ops: {
      paymentHint: getAppSetting(db, 'ops_payment_hint'),
      supportContact: getAppSetting(db, 'ops_support_contact')
    }
  })
})

app.get('/v1/model-routes', (req, res) => {
  try {
    requireUser(db, req)
    res.json({ routes: publicModelRoutes(db) })
  } catch (e) {
    publicError(res, e)
  }
})

app.post('/v1/redeem', (req, res) => {
  try {
    const user = requireUser(db, req)
    const code = String(req.body?.code || '')
      .trim()
      .toUpperCase()
    if (!code) return res.status(400).json({ error: 'code required' })
    const row = db.prepare('SELECT * FROM redeem_codes WHERE code = ?').get(code)
    if (!row) return res.status(404).json({ error: '兑换码不存在' })
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: '兑换码已过期' })
    }
    if (row.used_count >= row.max_uses) return res.status(400).json({ error: '兑换码已用完' })
    const tx = db.transaction(() => {
      db.prepare('UPDATE redeem_codes SET used_count = used_count + 1 WHERE code = ?').run(code)
      applyCreditDelta(db, user.id, row.credits, 'redeem', 'purchased', code, row.note || '')
    })
    tx()
    res.json({ ok: true, credits: row.credits, me: mePayload(db, user) })
  } catch (e) {
    publicError(res, e)
  }
})

// Orders: offline stub for client; online payment returns 501
app.post('/v1/orders', async (req, res) => {
  try {
    const user = requireUser(db, req)
    const source = String(req.body?.source || 'offline')
    if (source === 'wechat' || source === 'alipay') {
      return res.status(501).json({
        error: '在线支付尚未开通，请使用线下转账并由客服在后台入账',
        code: 'PAYMENT_NOT_ENABLED'
      })
    }
    if (source === 'stripe') {
      return res.json(
        await createStripeCheckout(db, user, req.body, { newToken, nowIso })
      )
    }
    // Client may create a pending offline intent; fulfillment is admin-side
    const id = `intent_${newToken().slice(0, 12)}`
    const t = nowIso()
    const planId = String(req.body?.planId || '')
    const credits = Number(req.body?.credits || 0)
    const amountCents = Number(req.body?.amountCents || 0)
    db.prepare(
      `INSERT INTO orders
        (id, user_id, source, channel, plan_id, credits, amount_cents, status, payment_note, created_at, paid_at)
       VALUES (?, ?, 'offline', '', ?, ?, ?, 'pending', ?, ?, '')`
    ).run(
      id,
      user.id,
      planId,
      credits,
      amountCents,
      `用户发起线下意向；联系 ${getAppSetting(db, 'ops_support_contact')}`,
      t
    )
    res.json({
      id,
      status: 'pending',
      source: 'offline',
      paymentHint: getAppSetting(db, 'ops_payment_hint'),
      supportContact: getAppSetting(db, 'ops_support_contact')
    })
  } catch (e) {
    publicError(res, e)
  }
})

app.get('/v1/orders/:id', (req, res) => {
  try {
    const user = requireUser(db, req)
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(
      req.params.id,
      user.id
    )
    if (!order) return res.status(404).json({ error: 'not found' })
    res.json(order)
  } catch (e) {
    publicError(res, e)
  }
})

// ── Thin proxy: ASR ──
app.post('/v1/proxy/audio/transcriptions', upload.single('file'), async (req, res) => {
  try {
    const user = requireUser(db, req)
    const route = getRoute('asr')
    if (!route?.api_key) return res.status(503).json({ error: '官方语音模型未配置上游 Key' })
    const prices = getPrices(db)
    const minutes = estimateAudioMinutes(req.file?.size || 0, req.file?.mimetype || '')
    const cost = minutes * (prices.voiceCreditsPerMinute || 2)
    if (getBalance(db, user.id) < cost) {
      const err = new Error('INSUFFICIENT_CREDITS')
      err.code = 'INSUFFICIENT_CREDITS'
      err.balance = getBalance(db, user.id)
      throw err
    }
    const requestId = newToken().slice(0, 16)
    const form = new FormData()
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' })
    form.append('file', blob, req.file.originalname || 'speech.webm')
    form.append('model', route.model_id)
    if (req.body?.language) form.append('language', req.body.language)
    if (req.body?.response_format) form.append('response_format', req.body.response_format)
    else form.append('response_format', 'json')

    const { res: up, text } = await upstreamFetch(route.base_url, route.api_key, '/audio/transcriptions', {
      method: 'POST',
      body: form
    })
    if (!up.ok) {
      return res.status(up.status).type('application/json').send(text || JSON.stringify({ error: 'upstream' }))
    }
    chargeCredits(db, user.id, cost, 'voice', requestId)
    res.set('X-TalkNow-Credits-Charged', String(cost))
    res.set('X-TalkNow-Request-Id', requestId)
    res.type(up.headers.get('content-type') || 'application/json').send(text)
  } catch (e) {
    publicError(res, e)
  }
})

// ── Thin proxy: chat / vision ──
app.post('/v1/proxy/chat/completions', async (req, res) => {
  try {
    const user = requireUser(db, req)
    const capability = String(req.headers['x-talknow-capability'] || 'reply')
    const prices = getPrices(db)
    const costMap = {
      reply: prices.replyCredits || 10,
      reply_vision: prices.replyVisionCredits || 5,
      screen_ask: prices.screenAskCredits || 25,
      screen_quiz: prices.screenQuizCredits || 15,
      chat: prices.replyCredits || 10
    }
    const cost = costMap[capability] ?? (prices.replyCredits || 15)
    if (getBalance(db, user.id) < cost) {
      const err = new Error('INSUFFICIENT_CREDITS')
      err.code = 'INSUFFICIENT_CREDITS'
      err.balance = getBalance(db, user.id)
      throw err
    }

    const body = { ...req.body }
    const hasVision = JSON.stringify(body).includes('image_url') || JSON.stringify(body).includes('image')
    const slot = hasVision ? 'vision' : 'chat'
    const route = getRoute(slot)
    if (!route?.api_key) return res.status(503).json({ error: '官方模型未配置上游 Key' })
    // Official proxy always uses admin route model; ignore client BYOK model names
    body.model = route.model_id

    const requestId = newToken().slice(0, 16)
    const { res: up, text } = await upstreamFetch(route.base_url, route.api_key, '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!up.ok) {
      return res.status(up.status).type('application/json').send(text || JSON.stringify({ error: 'upstream' }))
    }
    const reason =
      capability === 'screen_ask'
        ? 'screen_ask'
        : capability === 'screen_quiz'
          ? 'screen_quiz'
          : capability === 'reply_vision'
            ? 'reply'
            : 'reply'
    chargeCredits(db, user.id, cost, reason, requestId)
    res.set('X-TalkNow-Credits-Charged', String(cost))
    res.set('X-TalkNow-Request-Id', requestId)
    res.type(up.headers.get('content-type') || 'application/json').send(text)
  } catch (e) {
    publicError(res, e)
  }
})

// ── Admin auth ──
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || ''
  const raw = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!raw) return res.status(401).json({ error: 'admin auth required' })
  const row = db
    .prepare('SELECT * FROM admin_sessions WHERE token = ? AND expires_at > ?')
    .get(hashToken(raw), nowIso())
  if (!row) return res.status(401).json({ error: 'admin auth required' })
  next()
}

app.post('/v1/admin/login', (req, res) => {
  const user = String(req.body?.username || '')
  const pass = String(req.body?.password || '')
  if (user !== (process.env.ADMIN_USER || 'admin') || pass !== (process.env.ADMIN_PASS || 'Lizhenning@521')) {
    return res.status(401).json({ error: '用户名或密码错误' })
  }
  const raw = newToken()
  const created = nowIso()
  const expires = new Date(Date.now() + 7 * 864e5).toISOString()
  db.prepare(
    `INSERT INTO admin_sessions (token, created_at, expires_at) VALUES (?, ?, ?)`
  ).run(hashToken(raw), created, expires)
  res.json({ accessToken: raw, expiresAt: expires })
})

app.get('/v1/admin/users', requireAdmin, (req, res) => {
  const q = String(req.query.q || '').trim()
  let rows
  if (q) {
    rows = db
      .prepare(
        `SELECT u.*, c.balance FROM users u
         LEFT JOIN credit_accounts c ON c.user_id = u.id
         WHERE u.phone LIKE ? OR u.display_name LIKE ?
         ORDER BY u.id DESC LIMIT 100`
      )
      .all(`%${q}%`, `%${q}%`)
  } else {
    rows = db
      .prepare(
        `SELECT u.*, c.balance FROM users u
         LEFT JOIN credit_accounts c ON c.user_id = u.id
         ORDER BY u.id DESC LIMIT 100`
      )
      .all()
  }
  res.json({ users: rows })
})

app.post('/v1/admin/users/:id/freeze', requireAdmin, (req, res) => {
  const frozen = req.body?.frozen ? 1 : 0
  db.prepare('UPDATE users SET frozen = ?, updated_at = ? WHERE id = ?').run(
    frozen,
    nowIso(),
    Number(req.params.id)
  )
  res.json({ ok: true })
})

app.get('/v1/admin/ledger', requireAdmin, (req, res) => {
  const userId = Number(req.query.userId || 0)
  const rows = userId
    ? db
        .prepare(
          `SELECT * FROM credit_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 200`
        )
        .all(userId)
    : db.prepare(`SELECT * FROM credit_ledger ORDER BY id DESC LIMIT 200`).all()
  res.json({ ledger: rows })
})

app.get('/v1/admin/overview', requireAdmin, (_req, res) => {
  const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
  const pendingOrders = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status='pending'").get().c
  const day = new Date().toISOString().slice(0, 10)
  const paidOrdersRecent = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status='paid' AND paid_at LIKE ?").get(day + '%').c
  const redeemCodes = db.prepare('SELECT COUNT(*) AS c FROM redeem_codes').get().c
  const routes = db.prepare('SELECT slot, api_key FROM model_routes').all()
  const routesConfigured = routes.filter((r) => r.api_key).length
  const roadmapRows = db.prepare('SELECT status, COUNT(*) AS c FROM roadmap_items GROUP BY status').all()
  const roadmap = { pending: 0, in_progress: 0, done: 0, deferred: 0 }
  for (const r of roadmapRows) if (roadmap[r.status] != null) roadmap[r.status] = r.c
  res.json({ users, pendingOrders, paidOrdersRecent, redeemCodes, routesConfigured, routesTotal: routes.length, roadmap })
})

app.get('/v1/admin/plans', requireAdmin, (_req, res) => {
  res.json({ plans: db.prepare('SELECT * FROM plans ORDER BY sort_order').all() })
})

app.put('/v1/admin/plans/:id', requireAdmin, (req, res) => {
  const id = req.params.id
  const { name, monthly_credits, price_month_cents, price_year_cents, active } = req.body || {}
  db.prepare(
    `UPDATE plans SET name = COALESCE(?, name),
      monthly_credits = COALESCE(?, monthly_credits),
      price_month_cents = COALESCE(?, price_month_cents),
      price_year_cents = COALESCE(?, price_year_cents),
      active = COALESCE(?, active)
     WHERE id = ?`
  ).run(
    name ?? null,
    monthly_credits ?? null,
    price_month_cents ?? null,
    price_year_cents ?? null,
    active === undefined ? null : active ? 1 : 0,
    id
  )
  res.json({ ok: true, plan: db.prepare('SELECT * FROM plans WHERE id = ?').get(id) })
})

app.post('/v1/admin/offline-order', requireAdmin, (req, res) => {
  try {
    const userId = Number(req.body?.userId)
    if (!userId) return res.status(400).json({ error: 'userId required' })
    const order = createOfflineOrder(db, {
      userId,
      planId: req.body?.planId || '',
      credits: Number(req.body?.credits || 0),
      amountCents: Number(req.body?.amountCents || 0),
      paymentNote: String(req.body?.paymentNote || '')
    })
    res.json({ ok: true, order })
  } catch (e) {
    publicError(res, e)
  }
})

app.get('/v1/admin/model-routes', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT slot, base_url, model_id, updated_at, api_key FROM model_routes').all()
  res.json({
    routes: rows.map((r) => ({
      ...r,
      api_key: r.api_key ? `***${r.api_key.slice(-4)}` : '',
      hasKey: !!r.api_key
    }))
  })
})

app.post('/v1/admin/model-routes-save', requireAdmin, (req, res) => {
  const slot = String(req.body?.slot || '')
  const ex = db.prepare('SELECT * FROM model_routes WHERE slot=?').get(slot)
  if (!ex) return res.status(404).json({ error: 'unknown slot' })
  let key = req.body?.api_key ?? ''
  if (!key || String(key).startsWith('***')) key = ex.api_key
  db.prepare('UPDATE model_routes SET base_url=?, api_key=?, model_id=?, updated_at=? WHERE slot=?').run(
    req.body?.base_url ?? ex.base_url,
    key,
    req.body?.model_id ?? ex.model_id,
    nowIso(),
    slot
  )
  res.json({ ok: true, slot })
})

app.put('/v1/admin/model-routes/:slot', requireAdmin, (req, res) => {
  const slot = req.params.slot
  const existing = getRoute(slot)
  if (!existing) return res.status(404).json({ error: 'unknown slot' })
  const base_url = req.body?.base_url ?? existing.base_url
  const model_id = req.body?.model_id ?? existing.model_id
  const api_key =
    req.body?.api_key && !String(req.body.api_key).startsWith('***')
      ? String(req.body.api_key)
      : existing.api_key
  db.prepare(
    `UPDATE model_routes SET base_url = ?, api_key = ?, model_id = ?, updated_at = ? WHERE slot = ?`
  ).run(base_url, api_key, model_id, nowIso(), slot)
  res.json({ ok: true })
})

app.get('/v1/admin/prices', requireAdmin, (_req, res) => {
  res.json({ prices: getPrices(db) })
})

app.post('/v1/admin/subscription-save', requireAdmin, (req, res) => {
  try {
    const body = req.body || {}
    let userId = Number(body.userId || 0)
    const phone = String(body.phone || '').replace(/\D+/g, '')
    if (!userId && phone) {
      const u = ensureUser(db, phone)
      userId = u.id
    }
    if (!userId) return res.status(400).json({ error: '请填写手机号或用户 ID' })
    const planId = String(body.planId || '').trim()
    if (!planId) return res.status(400).json({ error: '请选择会员档位' })
    const changeType = String(body.changeType || 'open').trim() || 'open'
    const months = Math.max(1, Number(body.months) || 1)
    const periodEnd = String(body.periodEnd || '')
    const grantMode = String(body.grantMode || '')
    const note = String(body.paymentNote || '')
    const amount = Number(body.amountCents) || 0
    const result = changeSubscription(
      db,
      userId,
      planId,
      changeType,
      `会员变更 ${note}`,
      months,
      periodEnd,
      grantMode
    )
    const id = `sub_${newToken().slice(0, 16)}`
    const t = nowIso()
    const channel = changeType === 'open' ? 'subscription' : changeType
    db.prepare(
      `INSERT INTO orders
        (id, user_id, source, channel, plan_id, credits, amount_cents, status, payment_note, created_at, paid_at)
       VALUES (?, ?, 'offline', ?, ?, ?, ?, 'paid', ?, ?, ?)`
    ).run(id, userId, channel, planId, result.granted || 0, amount, note, t, t)
    const user = db
      .prepare(
        `SELECT u.*, c.balance, s.plan_id, s.status AS sub_status, s.period_start, s.period_end, s.pending_plan_id, p.name AS plan_name
         FROM users u
         LEFT JOIN credit_accounts c ON c.user_id = u.id
         LEFT JOIN subscriptions s ON s.user_id = u.id
         LEFT JOIN plans p ON p.id = s.plan_id
         WHERE u.id = ?`
      )
      .get(userId)
    res.json({ ok: true, orderId: id, change: result, user })
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) })
  }
})

app.put('/v1/admin/prices', requireAdmin, (req, res) => {
  const body = req.body || {}
  const t = nowIso()
  const upsert = db.prepare(
    `INSERT INTO credit_prices (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === 'number' && Number.isFinite(v)) upsert.run(k, Math.round(v), t)
  }
  res.json({ prices: getPrices(db) })
})

app.get('/v1/admin/ops', requireAdmin, (_req, res) => {
  res.json({
    paymentHint: getAppSetting(db, 'ops_payment_hint'),
    supportContact: getAppSetting(db, 'ops_support_contact')
  })
})

app.put('/v1/admin/ops', requireAdmin, (req, res) => {
  if (req.body?.paymentHint != null) setAppSetting(db, 'ops_payment_hint', String(req.body.paymentHint))
  if (req.body?.supportContact != null) {
    setAppSetting(db, 'ops_support_contact', String(req.body.supportContact))
  }
  res.json({
    paymentHint: getAppSetting(db, 'ops_payment_hint'),
    supportContact: getAppSetting(db, 'ops_support_contact')
  })
})

app.get('/v1/admin/redeem-codes', requireAdmin, (_req, res) => {
  res.json({ codes: db.prepare('SELECT * FROM redeem_codes ORDER BY created_at DESC LIMIT 100').all() })
})

app.post('/v1/admin/redeem-codes', requireAdmin, (req, res) => {
  const code = String(req.body?.code || newToken().slice(0, 8))
    .trim()
    .toUpperCase()
  const credits = Number(req.body?.credits || 0)
  const maxUses = Number(req.body?.max_uses || 1)
  const expiresAt = String(req.body?.expires_at || '')
  const note = String(req.body?.note || '')
  if (!credits) return res.status(400).json({ error: 'credits required' })
  db.prepare(
    `INSERT INTO redeem_codes (code, credits, max_uses, used_count, expires_at, note, created_at)
     VALUES (?, ?, ?, 0, ?, ?, ?)`
  ).run(code, credits, maxUses, expiresAt, note, nowIso())
  res.json({ ok: true, code })
})

app.get('/v1/admin/orders', requireAdmin, (_req, res) => {
  res.json({
    orders: db
      .prepare(
        `SELECT o.*, u.phone AS phone FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         ORDER BY o.created_at DESC LIMIT 100`
      )
      .all()
  })
})

app.post('/v1/admin/orders-fulfill', requireAdmin, (req, res) => {
  adminFulfillOrder(String(req.body?.id || ''), req.body || {}, res)
})

app.post('/v1/admin/orders/:id/fulfill', requireAdmin, (req, res) => {
  adminFulfillOrder(String(req.params.id || ''), req.body || {}, res)
})

app.post('/v1/admin/orders-reject', requireAdmin, (req, res) => {
  const id = String(req.body?.id || '').trim()
  if (!id) return res.status(400).json({ error: 'id required' })
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
  if (!order) return res.status(404).json({ error: 'order not found' })
  if (order.status === 'paid') return res.status(400).json({ error: '已履约订单不可拒绝' })
  const note = String(req.body?.note || '').trim()
  let merged = order.payment_note || ''
  if (note) merged = merged ? `${merged}；拒绝：${note}` : `拒绝：${note}`
  else if (!merged.includes('拒绝')) merged = merged ? `${merged}；已拒绝` : '已拒绝'
  db.prepare(`UPDATE orders SET status = 'rejected', payment_note = ? WHERE id = ?`).run(merged, id)
  res.json({ ok: true, order: db.prepare('SELECT * FROM orders WHERE id = ?').get(id) })
})

app.post('/v1/admin/orders-delete', requireAdmin, (req, res) => {
  const id = String(req.body?.id || '').trim()
  if (!id) return res.status(400).json({ error: 'id required' })
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(id)
  if (!order) return res.status(404).json({ error: 'order not found' })
  db.prepare('DELETE FROM orders WHERE id = ?').run(id)
  res.json({ ok: true, deleted: id })
})

function adminFulfillOrder(id, body, res) {
  id = String(id || '').trim()
  if (!id) return res.status(400).json({ error: 'id required' })
  try {
    const order = fulfillPaidOrder(db, id, {
      paymentNote: body?.paymentNote,
      months: body?.months,
      changeType: body?.changeType,
      deps: { applyCreditDelta, changeSubscription }
    })
    res.json({ ok: true, order })
  } catch (e) {
    publicError(res, e)
  }
}

// ── Internal KB + roadmap (private ops) ──
app.get('/v1/admin/kb', requireAdmin, (_req, res) => {
  res.json({
    articles: db
      .prepare('SELECT * FROM kb_articles ORDER BY sort_order ASC, id ASC')
      .all()
  })
})

app.post('/v1/admin/kb', requireAdmin, (req, res) => {
  const title = String(req.body?.title || '').trim()
  if (!title) return res.status(400).json({ error: 'title required' })
  const slug =
    String(req.body?.slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-') || `kb-${newToken().slice(0, 8)}`
  const category = String(req.body?.category || 'general').trim() || 'general'
  const body = String(req.body?.body || '')
  const sortOrder = Number(req.body?.sort_order ?? 100)
  const t = nowIso()
  try {
    const info = db
      .prepare(
        `INSERT INTO kb_articles (slug, title, category, body, sort_order, updated_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(slug, title, category, body, sortOrder, t, t)
    res.json({
      ok: true,
      article: db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(Number(info.lastInsertRowid))
    })
  } catch (e) {
    res.status(400).json({ error: e.message || 'create failed' })
  }
})

app.put('/v1/admin/kb/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'not found' })
  const title = req.body?.title != null ? String(req.body.title).trim() : row.title
  const slug = req.body?.slug != null ? String(req.body.slug).trim() : row.slug
  const category = req.body?.category != null ? String(req.body.category).trim() : row.category
  const body = req.body?.body != null ? String(req.body.body) : row.body
  const sortOrder =
    req.body?.sort_order != null ? Number(req.body.sort_order) : row.sort_order
  db.prepare(
    `UPDATE kb_articles SET slug = ?, title = ?, category = ?, body = ?, sort_order = ?, updated_at = ?
     WHERE id = ?`
  ).run(slug, title, category, body, sortOrder, nowIso(), id)
  res.json({ ok: true, article: db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(id) })
})

app.delete('/v1/admin/kb/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM kb_articles WHERE id = ?').run(Number(req.params.id))
  res.json({ ok: true })
})

app.get('/v1/admin/roadmap', requireAdmin, (_req, res) => {
  const items = db
    .prepare('SELECT * FROM roadmap_items ORDER BY sort_order ASC, id ASC')
    .all()
  const summary = { done: 0, pending: 0, in_progress: 0, deferred: 0, cancelled: 0 }
  for (const it of items) {
    if (summary[it.status] != null) summary[it.status] += 1
    else summary.pending += 1
  }
  res.json({ items, summary })
})

app.post('/v1/admin/roadmap', requireAdmin, (req, res) => {
  const title = String(req.body?.title || '').trim()
  if (!title) return res.status(400).json({ error: 'title required' })
  const t = nowIso()
  const info = db
    .prepare(
      `INSERT INTO roadmap_items (phase, title, detail, status, sort_order, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(req.body?.phase || ''),
      title,
      String(req.body?.detail || ''),
      String(req.body?.status || 'pending'),
      Number(req.body?.sort_order ?? 100),
      t,
      t
    )
  res.json({
    ok: true,
    item: db.prepare('SELECT * FROM roadmap_items WHERE id = ?').get(Number(info.lastInsertRowid))
  })
})

app.put('/v1/admin/roadmap/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM roadmap_items WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'not found' })
  db.prepare(
    `UPDATE roadmap_items SET
      phase = COALESCE(?, phase),
      title = COALESCE(?, title),
      detail = COALESCE(?, detail),
      status = COALESCE(?, status),
      sort_order = COALESCE(?, sort_order),
      updated_at = ?
     WHERE id = ?`
  ).run(
    req.body?.phase != null ? String(req.body.phase) : null,
    req.body?.title != null ? String(req.body.title).trim() : null,
    req.body?.detail != null ? String(req.body.detail) : null,
    req.body?.status != null ? String(req.body.status) : null,
    req.body?.sort_order != null ? Number(req.body.sort_order) : null,
    nowIso(),
    id
  )
  res.json({ ok: true, item: db.prepare('SELECT * FROM roadmap_items WHERE id = ?').get(id) })
})

app.delete('/v1/admin/roadmap/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM roadmap_items WHERE id = ?').run(Number(req.params.id))
  res.json({ ok: true })
})

app.get('/health', (_req, res) => res.json({ ok: true, service: 'talknow-membership' }))

app.get('/ops', (_req, res) => res.redirect(302, '/admin/'))

const port = Number(process.env.PORT || 8788)
app.listen(port, () => {
  console.log(`TalkNow membership server on http://127.0.0.1:${port}`)
  console.log(`Internal ops admin http://127.0.0.1:${port}/admin/  (also /ops)`)
})
