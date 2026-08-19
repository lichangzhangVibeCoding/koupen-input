import { addMonths, hashToken, newToken, nowIso } from './db.js'

export function getPrices(db) {
  const rows = db.prepare('SELECT key, value FROM credit_prices').all()
  const out = {}
  for (const r of rows) out[r.key] = r.value
  return out
}

export function getAppSetting(db, key, fallback = '') {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key)
  return row ? row.value : fallback
}

export function setAppSetting(db, key, value) {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value)
}

export function ensureUser(db, phone) {
  const existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone)
  if (existing) {
    ensureDefaultPlan(db, existing.id, false)
    return db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id)
  }
  const t = nowIso()
  const info = db
    .prepare(
      `INSERT INTO users (phone, display_name, frozen, created_at, updated_at)
       VALUES (?, ?, 0, ?, ?)`
    )
    .run(phone, phone, t, t)
  const userId = Number(info.lastInsertRowid)
  db.prepare(
    `INSERT INTO credit_accounts (user_id, balance, updated_at) VALUES (?, 0, ?)`
  ).run(userId, t)
  ensureDefaultPlan(db, userId, true)
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
}

/** 未购付费档时默认体验版 */
export function ensureDefaultPlan(db, userId, forceGrant = false) {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId)
  let need = !sub || !sub.plan_id
  if (!need && sub) {
    const plan = db.prepare('SELECT id FROM plans WHERE id = ?').get(sub.plan_id)
    if (!plan) need = true
  }
  if (!need) return

  const t = nowIso()
  const periodEnd = addMonths(t, 1)
  if (sub) {
    db.prepare(
      `UPDATE subscriptions SET plan_id = ?, status = 'active', period_start = ?, period_end = ?, updated_at = ? WHERE user_id = ?`
    ).run('trial', t, periodEnd, t, userId)
  } else {
    db.prepare(
      `INSERT INTO subscriptions (user_id, plan_id, status, period_start, period_end, updated_at)
       VALUES (?, 'trial', 'active', ?, ?, ?)`
    ).run(userId, t, periodEnd, t)
  }

  let shouldGrant = forceGrant
  if (!shouldGrant) {
    const row = db
      .prepare(`SELECT 1 AS ok FROM credit_ledger WHERE user_id = ? AND grant_type = 'monthly_grant' LIMIT 1`)
      .get(userId)
    if (!row) shouldGrant = true
  }
  if (!shouldGrant) return
  const trial = db.prepare('SELECT * FROM plans WHERE id = ?').get('trial')
  const grant = Number(trial?.monthly_credits || 0) + Number(trial?.gift_credits || 0)
  if (grant > 0) {
    applyCreditDelta(db, userId, grant, 'monthly_reset', 'monthly_grant', '', `默认体验版 +${grant}`)
  }
}

export function applyCreditDelta(db, userId, delta, reason, grantType = '', requestId = '', note = '') {
  const t = nowIso()
  const tx = db.transaction(() => {
    const acc = db.prepare('SELECT balance FROM credit_accounts WHERE user_id = ?').get(userId)
    if (!acc) throw new Error('credit account missing')
    const next = acc.balance + delta
    if (next < 0) {
      const err = new Error('INSUFFICIENT_CREDITS')
      err.code = 'INSUFFICIENT_CREDITS'
      err.balance = acc.balance
      throw err
    }
    db.prepare(
      `UPDATE credit_accounts SET balance = ?, updated_at = ? WHERE user_id = ?`
    ).run(next, t, userId)
    db.prepare(
      `INSERT INTO credit_ledger
        (user_id, delta, balance_after, reason, grant_type, request_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, delta, next, reason, grantType, requestId, note, t)
    return next
  })
  return tx()
}

export function getBalance(db, userId) {
  const row = db.prepare('SELECT balance FROM credit_accounts WHERE user_id = ?').get(userId)
  return row ? row.balance : 0
}

export function refreshMonthlyIfNeeded(db, userId) {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId)
  if (!sub || sub.status !== 'active') return
  const now = Date.now()
  if (new Date(sub.period_end).getTime() > now) return

  let planId = sub.plan_id
  const pending = String(sub.pending_plan_id || '').trim()
  if (pending) {
    const ok = db.prepare('SELECT id FROM plans WHERE id = ?').get(pending)
    if (ok) planId = pending
  }
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId)
  if (!plan) return
  const start = nowIso()
  const end = addMonths(start, 1)
  db.prepare(
    `UPDATE subscriptions SET plan_id = ?, period_start = ?, period_end = ?, pending_plan_id = '', updated_at = ? WHERE user_id = ?`
  ).run(planId, start, end, start, userId)
  const grant = Number(plan.monthly_credits || 0) + Number(plan.gift_credits || 0)
  let note = `${plan.name} 月度赠送 ${grant}`
  if (pending && pending === planId) note = `预约降级生效 ${sub.plan_id}→${planId} +${grant}`
  if (grant > 0) {
    applyCreditDelta(db, userId, grant, 'monthly_reset', 'monthly_grant', '', note)
  }
}

export function mePayload(db, user) {
  ensureDefaultPlan(db, user.id, false)
  refreshMonthlyIfNeeded(db, user.id)
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(user.id)
  const plan = sub
    ? db.prepare('SELECT * FROM plans WHERE id = ?').get(sub.plan_id)
    : null
  const balance = getBalance(db, user.id)
  const periodQuota = plan
    ? Number(plan.monthly_credits || 0) + Number(plan.gift_credits || 0)
    : 0
  let periodUsed = 0
  if (sub?.period_start) {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(ABS(delta)),0) AS used FROM credit_ledger
         WHERE user_id = ? AND grant_type = 'consume' AND created_at >= ?`
      )
      .get(user.id, sub.period_start)
    periodUsed = Number(row?.used) || 0
  }
  const periodRemaining = periodQuota > 0 ? Math.max(0, periodQuota - periodUsed) : Math.max(0, balance)
  const prices = getPrices(db)
  const voicePerMin = prices.voiceCreditsPerMinute || 2
  const reply = (prices.replyCredits || 10) + (prices.replyVisionCredits || 5)
  const screenAsk = prices.screenAskCredits || 25
  return {
    id: user.id,
    phone: user.phone,
    displayName: user.display_name,
    frozen: !!user.frozen,
    balance,
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          monthlyCredits: plan.monthly_credits,
          priceMonthCents: plan.price_month_cents,
          priceYearCents: plan.price_year_cents
        }
      : null,
    subscription: sub
      ? {
          status: sub.status,
          periodStart: sub.period_start,
          periodEnd: sub.period_end,
          pendingPlanId: sub.pending_plan_id || ''
        }
      : null,
    usage: {
      periodQuota,
      periodUsed,
      periodRemaining,
      walletBalance: balance
    },
    prices,
    estimate: {
      voiceMinutes: voicePerMin > 0 ? Math.floor(balance / voicePerMin) : 0,
      replyTimes: reply > 0 ? Math.floor(balance / reply) : 0,
      screenAskTimes: screenAsk > 0 ? Math.floor(balance / screenAsk) : 0
    },
    ops: {
      paymentHint: getAppSetting(db, 'ops_payment_hint'),
      supportContact: getAppSetting(db, 'ops_support_contact')
    },
    modelRoutes: publicModelRoutes(db)
  }
}

/** Member-visible official slot models (no upstream keys). */
export function publicModelRoutes(db) {
  const out = { asr: '', vision: '', chat: '' }
  const rows = db.prepare('SELECT slot, model_id FROM model_routes').all()
  for (const r of rows) {
    if (r.slot === 'asr' || r.slot === 'vision' || r.slot === 'chat') {
      out[r.slot] = String(r.model_id || '')
    }
  }
  return out
}

export function userLedger(db, userId, days = 7, from = '', to = '') {
  const d = days === 1 || days === 7 || days === 30 ? days : 7
  let rows
  if (from && to) {
    rows = db
      .prepare(
        `SELECT id, delta, balance_after, reason, grant_type, request_id, note, created_at
         FROM credit_ledger WHERE user_id = ? AND created_at >= ? AND created_at <= ?
         ORDER BY id DESC LIMIT 200`
      )
      .all(userId, from, to)
  } else {
    const since = new Date(Date.now() - d * 864e5).toISOString()
    rows = db
      .prepare(
        `SELECT id, delta, balance_after, reason, grant_type, request_id, note, created_at
         FROM credit_ledger WHERE user_id = ? AND created_at >= ?
         ORDER BY id DESC LIMIT 200`
      )
      .all(userId, since)
  }
  return {
    days: d,
    from: from || '',
    to: to || '',
    ledger: rows.map((r) => ({
      id: r.id,
      delta: r.delta,
      balanceAfter: r.balance_after,
      reason: r.reason,
      grantType: r.grant_type,
      requestId: r.request_id || '',
      note: r.note || '',
      createdAt: r.created_at
    }))
  }
}

export function createSession(db, userId, days = 30) {
  const raw = newToken()
  const tokenHash = hashToken(raw)
  const created = nowIso()
  const expires = new Date(Date.now() + days * 864e5).toISOString()
  db.prepare(
    `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
  ).run(tokenHash, userId, created, expires)
  return { accessToken: raw, expiresAt: expires }
}

export function userFromAuthHeader(db, header) {
  if (!header || !header.startsWith('Bearer ')) return null
  const raw = header.slice(7).trim()
  if (!raw) return null
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(hashToken(raw), nowIso())
  return row || null
}

export function requireUser(db, req) {
  const user = userFromAuthHeader(db, req.headers.authorization || '')
  if (!user) {
    const err = new Error('UNAUTHORIZED')
    err.status = 401
    throw err
  }
  if (user.frozen) {
    const err = new Error('ACCOUNT_FROZEN')
    err.status = 403
    throw err
  }
  return user
}

export function chargeCredits(db, userId, amount, reason, requestId) {
  if (amount <= 0) return getBalance(db, userId)
  return applyCreditDelta(db, userId, -amount, reason, 'consume', requestId, '')
}

export function estimateAudioMinutes(fileSize, mime, durationSeconds) {
  const dur = Number(durationSeconds)
  if (Number.isFinite(dur) && dur > 0) {
    return Math.max(1, Math.ceil(dur / 60))
  }
  // 16 kHz mono PCM16 ≈ 32KB/s; compressed webm/opus ≈ 2KB/s
  const bytesPerSec = /wav|pcm/i.test(String(mime || '')) ? 32000 : 2000
  const secs = Math.max(1, Math.ceil(fileSize / bytesPerSec))
  return Math.max(1, Math.ceil(secs / 60))
}

function planRank(planId) {
  const map = { trial: 0, free: 0, standard: 1, advanced: 2, pro: 2, flagship: 3, max: 3 }
  return map[planId] ?? -1
}

function planGrantAmount(plan) {
  if (!plan) return 0
  return Number(plan.monthly_credits || 0) + Number(plan.gift_credits || 0)
}

/** changeType: open | upgrade | renew | downgrade | downgrade_now */
export function changeSubscription(
  db,
  userId,
  planId,
  changeType = 'open',
  note = '',
  months = 1,
  periodEnd = '',
  grantMode = ''
) {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId)
  if (!plan) throw new Error('plan not found')
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId)
  const fromPlan = sub?.plan_id || ''
  const t = nowIso()
  months = Math.max(1, Number(months) || 1)
  changeType = String(changeType || 'open')
  if (!grantMode) {
    if (changeType === 'upgrade') grantMode = 'diff'
    else if (changeType === 'downgrade' || changeType === 'downgrade_now') grantMode = 'none'
    else grantMode = 'one'
  }

  if (changeType === 'downgrade') {
    if (!sub) throw new Error('无订阅，无法预约降级')
    if (fromPlan && planRank(planId) >= planRank(fromPlan)) throw new Error('预约降级请选择更低档位')
    db.prepare(`UPDATE subscriptions SET pending_plan_id = ?, updated_at = ? WHERE user_id = ?`).run(
      planId,
      t,
      userId
    )
    return { ok: true, changeType, from: fromPlan, to: planId, pending: true, granted: 0 }
  }

  let targetPlan = plan
  let targetPlanId = planId
  let newStart = t
  let newEnd = String(periodEnd || '').trim()
  if (newEnd && /^\d{4}-\d{2}-\d{2}$/.test(newEnd)) newEnd = `${newEnd}T23:59:59.000Z`

  if (changeType === 'upgrade') {
    if (sub?.period_end && !periodEnd) {
      newEnd = sub.period_end
      newStart = sub.period_start || t
    }
    if (!newEnd) newEnd = addMonths(t, months)
  } else if (changeType === 'renew') {
    targetPlanId = fromPlan || planId
    targetPlan = db.prepare('SELECT * FROM plans WHERE id = ?').get(targetPlanId)
    if (!targetPlan) throw new Error('plan not found')
    if (!periodEnd) {
      const base =
        sub?.period_end && new Date(sub.period_end).getTime() > Date.now() ? sub.period_end : t
      newEnd = addMonths(base, months)
    }
    if (sub?.period_start && sub?.period_end && new Date(sub.period_end).getTime() > Date.now()) {
      newStart = sub.period_start
    }
  } else if (changeType === 'downgrade_now') {
    if (sub?.period_end && !periodEnd) {
      newEnd = sub.period_end
      newStart = sub.period_start || t
    }
    if (!newEnd) newEnd = addMonths(t, months)
  } else if (!newEnd) {
    newEnd = addMonths(t, months)
  }

  db.prepare(
    `INSERT INTO subscriptions (user_id, plan_id, status, period_start, period_end, pending_plan_id, updated_at)
     VALUES (?, ?, 'active', ?, ?, '', ?)
     ON CONFLICT(user_id) DO UPDATE SET
       plan_id = excluded.plan_id,
       status = 'active',
       period_start = excluded.period_start,
       period_end = excluded.period_end,
       pending_plan_id = '',
       updated_at = excluded.updated_at`
  ).run(userId, targetPlanId, newStart, newEnd, t)

  let grant = 0
  if (grantMode === 'diff') {
    const fromGrant = fromPlan
      ? planGrantAmount(db.prepare('SELECT * FROM plans WHERE id = ?').get(fromPlan))
      : 0
    grant = Math.max(0, planGrantAmount(targetPlan) - fromGrant)
  } else if (grantMode === 'months') grant = planGrantAmount(targetPlan) * months
  else if (grantMode === 'none') grant = 0
  else grant = planGrantAmount(targetPlan)

  if (grant > 0) {
    const label = `${note || `${fromPlan}→${targetPlanId}`} +${grant}`
    applyCreditDelta(db, userId, grant, 'offline_topup', 'monthly_grant', '', label)
  }
  return {
    ok: true,
    changeType,
    from: fromPlan,
    to: targetPlanId,
    periodEnd: newEnd,
    granted: grant
  }
}

export function assignPlan(db, userId, planId, note = '') {
  return changeSubscription(db, userId, planId, 'open', note, 1, '', 'one')
}

export function createOfflineOrder(db, { userId, planId, credits, amountCents, paymentNote }) {
  const id = `off_${newToken().slice(0, 16)}`
  const t = nowIso()
  db.prepare(
    `INSERT INTO orders
      (id, user_id, source, channel, plan_id, credits, amount_cents, status, payment_note, created_at, paid_at)
     VALUES (?, ?, 'offline', 'offline', ?, ?, ?, 'paid', ?, ?, ?)`
  ).run(id, userId, planId || '', credits || 0, amountCents || 0, paymentNote || '', t, t)
  if (planId) {
    assignPlan(db, userId, planId, `订单 ${id} ${paymentNote || ''}`)
  } else if (credits > 0) {
    applyCreditDelta(db, userId, credits, 'offline_topup', 'purchased', id, paymentNote || '')
  }
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
}
