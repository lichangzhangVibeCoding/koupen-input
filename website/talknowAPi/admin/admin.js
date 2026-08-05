/* TalkNow Ops admin — query-string routing for IIS + WAF-safe model save */
const API_BASE = '../index.php'
let token = localStorage.getItem('tn_admin_token') || ''

const PAGE_META = {
  overview: ['工作台', '会员、配置与内部协作一览'],
  users: ['用户', '看清档位与到期，会员变更或充流量包'],
  orders: ['开通与充值', '会员变更 · 流量包 · 确认/拒绝预约意向'],
  ledger: ['积分流水', '按用户查看账本'],
  redeem: ['兑换码', '生成试用 / 活动码'],
  plans: ['套餐档位', '月赠积分与标价'],
  prices: ['扣费单价', '官方能力积分单价'],
  routes: ['模型路由', '上游 Base URL / Model / Key'],
  ops: ['运营文案', '客户端付款说明与客服'],
  roadmap: ['产品规划', '内部任务看板'],
  kb: ['项目情报', '密钥·账号·架构·踩坑·教程（仅团队）']
}

const PLAN_DEFS = [
  { id: 'trial', name: '体验版' },
  { id: 'standard', name: '标准版' },
  { id: 'advanced', name: '高级版' },
  { id: 'flagship', name: '旗舰版' }
]

let selectedUser = null
let plansCache = []
let usersCache = []
let selectedPlanId = 'standard'
let ordSelectedPlanId = 'standard'

const STATUS_LABEL = {
  done: '已完成',
  pending: '未开始',
  in_progress: '进行中',
  deferred: '后置',
  cancelled: '取消'
}

/** 项目情报库固定分类（存库用中文名） */
const KB_CATEGORIES = [
  { id: '凭证账号', hint: 'Key、密码、数据库、FTP、短信、第三方账号' },
  { id: '核心架构', hint: '产品定位、模块职责、会员双轨、客户端路由' },
  { id: '踩坑记录', hint: 'WAF、打包、sharp、PHP 兼容、线上怪现象' },
  { id: '功能教程', hint: '开单、兑换、模型配置、发版等操作 SOP' },
  { id: '运维部署', hint: '域名、FTP、健康检查、目录结构' },
  { id: '其它', hint: '临时备忘' }
]

let kbCache = []
let kbFilter = '全部'
let kbQuery = ''

function toast(msg) {
  const el = document.getElementById('toast')
  if (!el) return
  el.hidden = false
  el.textContent = msg
  clearTimeout(toast._t)
  toast._t = setTimeout(() => {
    el.hidden = true
  }, 2600)
}

function escapeAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

function escapeText(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
}

async function api(path, opts) {
  opts = opts || {}
  const headers = Object.assign({}, opts.headers || {})
  if (token) headers.Authorization = 'Bearer ' + token
  let body = opts.body
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(body)
  }
  // Prefer ?r= for IIS; keep query string on path if present
  let route = path
  let qs = ''
  const qi = path.indexOf('?')
  if (qi >= 0) {
    route = path.slice(0, qi)
    qs = path.slice(qi + 1)
  }
  const url =
    API_BASE +
    '?r=' +
    encodeURIComponent(route) +
    (qs ? '&' + qs : '')
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: headers,
    body: body
  })
  const rawText = await res.text()
  let data = {}
  try {
    data = rawText ? JSON.parse(rawText) : {}
  } catch (e) {
    throw new Error(
      '接口返回非 JSON（常见于 WAF 拦截 PUT/DELETE）。请用最新后台，或联系运维放行 POST。HTTP ' +
        res.status
    )
  }
  if (!res.ok) throw new Error(data.error || data.detail || res.statusText || '请求失败')
  return data
}

function showApp(on) {
  document.getElementById('login').classList.toggle('hidden', on)
  document.getElementById('app').classList.toggle('hidden', !on)
}

function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tab === tab)
  })
  document.querySelectorAll('.tab').forEach(function (t) {
    t.classList.toggle('hidden', t.id !== 'tab-' + tab)
  })
  const meta = PAGE_META[tab] || [tab, '']
  document.getElementById('pageTitle').textContent = meta[0]
  document.getElementById('pageDesc').textContent = meta[1]
  const loaders = {
    overview: loadOverview,
    users: loadUsers,
    orders: loadOrders,
    ledger: loadLedger,
    redeem: loadRedeem,
    plans: loadPlans,
    prices: loadPrices,
    routes: loadRoutes,
    ops: loadOps,
    roadmap: loadRoadmap,
    kb: loadKb
  }
  if (loaders[tab]) loaders[tab]().catch(function (e) {
    toast(e.message)
  })
}

document.getElementById('btnLogin').onclick = async function () {
  const err = document.getElementById('loginErr')
  err.hidden = true
  try {
    const data = await api('/v1/admin/login', {
      method: 'POST',
      body: {
        username: document.getElementById('adminUser').value,
        password: document.getElementById('adminPass').value
      }
    })
    token = data.accessToken
    localStorage.setItem('tn_admin_token', token)
    showApp(true)
    switchTab('overview')
  } catch (e) {
    err.hidden = false
    err.textContent = e.message
  }
}

document.getElementById('btnLogout').onclick = function () {
  token = ''
  localStorage.removeItem('tn_admin_token')
  showApp(false)
}

document.querySelectorAll('.nav-item').forEach(function (btn) {
  btn.onclick = function () {
    switchTab(btn.dataset.tab)
  }
})

document.querySelectorAll('[data-jump]').forEach(function (btn) {
  btn.onclick = function () {
    switchTab(btn.dataset.jump)
  }
})

async function loadOverview() {
  const d = await api('/v1/admin/overview')
  document.getElementById('overviewStats').innerHTML =
    '<div class="stat-card"><div class="label">用户数</div><div class="value">' +
    d.users +
    '</div></div>' +
    '<div class="stat-card' +
    (d.pendingOrders ? ' warn' : '') +
    '"><div class="label">待履约订单</div><div class="value">' +
    d.pendingOrders +
    '</div></div>' +
    '<div class="stat-card"><div class="label">今日已入账</div><div class="value">' +
    d.paidOrdersRecent +
    '</div></div>' +
    '<div class="stat-card' +
    (d.routesConfigured < d.routesTotal ? ' warn' : ' ok') +
    '"><div class="label">模型路由 Key</div><div class="value">' +
    d.routesConfigured +
    '/' +
    d.routesTotal +
    '</div></div>'
  const rm = d.roadmap || {}
  document.getElementById('overviewRoadmap').textContent =
    '已完成 ' +
    (rm.done || 0) +
    ' · 进行中 ' +
    (rm.in_progress || 0) +
    ' · 未开始 ' +
    (rm.pending || 0) +
    ' · 后置 ' +
    (rm.deferred || 0) +
    ' · 兑换码 ' +
    (d.redeemCodes || 0) +
    ' 个'
}

function yuanToCents(v) {
  const n = Number(v)
  if (!isFinite(n) || n <= 0) return 0
  return Math.round(n * 100)
}

function formatPeriod(iso) {
  if (!iso) return '—'
  const s = String(iso)
  if (s.length >= 10) return s.slice(0, 10)
  return s
}

function planGrant(p) {
  if (!p) return 0
  return (Number(p.monthly_credits) || 0) + (Number(p.gift_credits) || 0)
}

function findPlan(id) {
  for (let i = 0; i < plansCache.length; i++) {
    if (plansCache[i].id === id) return plansCache[i]
  }
  return null
}

function renderPlanChips(elId, selected, onPick) {
  const el = document.getElementById(elId)
  if (!el) return
  el.innerHTML = PLAN_DEFS.map(function (p) {
    const live = findPlan(p.id)
    const grant = live ? planGrant(live) : ''
    const price = live ? (Number(live.price_month_cents) / 100).toFixed(0) : ''
    return (
      '<button type="button" class="chip' +
      (selected === p.id ? ' active' : '') +
      '" data-plan="' +
      p.id +
      '"><strong>' +
      escapeAttr(p.name) +
      '</strong><span>' +
      (grant !== '' ? grant + ' 分/月' : p.id) +
      (price !== '' ? ' · ¥' + price : '') +
      '</span></button>'
    )
  }).join('')
  el.querySelectorAll('[data-plan]').forEach(function (b) {
    b.onclick = function () {
      onPick(b.dataset.plan)
      renderPlanChips(elId, b.dataset.plan, onPick)
    }
  })
}

function planRank(id) {
  const map = { trial: 0, free: 0, standard: 1, advanced: 2, pro: 2, flagship: 3, max: 3 }
  return map[id] != null ? map[id] : -1
}

function suggestChangeType(u, targetPlanId) {
  if (!u || !u.plan_id) return 'open'
  if (u.plan_id === targetPlanId) return 'renew'
  if (planRank(targetPlanId) > planRank(u.plan_id)) return 'upgrade'
  if (planRank(targetPlanId) < planRank(u.plan_id)) return 'downgrade'
  return 'open'
}

function defaultGrantForChange(changeType) {
  if (changeType === 'upgrade') return 'diff'
  if (changeType === 'downgrade' || changeType === 'downgrade_now') return 'none'
  return 'one'
}

function updateSubPreview() {
  const el = document.getElementById('ucSubPreview')
  if (!el) return
  const changeType = document.getElementById('ucChangeType').value
  const p = findPlan(selectedPlanId)
  const fromId = selectedUser && selectedUser.plan_id ? selectedUser.plan_id : ''
  const fromP = fromId ? findPlan(fromId) : null
  const monthsSel = document.getElementById('ucMonths').value
  const grantMode = document.getElementById('ucGrantMode').value
  let months = monthsSel === 'custom' ? 1 : Number(monthsSel) || 1
  let endLabel = ''
  if (changeType === 'upgrade' || changeType === 'downgrade_now') {
    endLabel =
      monthsSel === 'custom'
        ? document.getElementById('ucPeriodEnd').value || '（请选日期）'
        : selectedUser && selectedUser.period_end
          ? formatPeriod(selectedUser.period_end) + '（默认保留）'
          : '约 ' + months + ' 个月后'
  } else if (changeType === 'renew') {
    endLabel =
      monthsSel === 'custom'
        ? document.getElementById('ucPeriodEnd').value || '（请选日期）'
        : '在现有到期上 +' + months + ' 个月'
  } else if (changeType === 'downgrade') {
    endLabel =
      selectedUser && selectedUser.period_end
        ? formatPeriod(selectedUser.period_end) + ' 到期后切档'
        : '到期后切档'
  } else {
    endLabel =
      monthsSel === 'custom'
        ? document.getElementById('ucPeriodEnd').value || '（请选日期）'
        : '约 ' + months + ' 个月后'
  }
  const unit = p ? planGrant(p) : 0
  const fromUnit = fromP ? planGrant(fromP) : 0
  let grant = 0
  if (grantMode === 'diff') grant = Math.max(0, unit - fromUnit)
  else if (grantMode === 'one') grant = unit
  else if (grantMode === 'months') grant = unit * months
  const actionLabel = {
    open: '首开',
    upgrade: '升级',
    renew: '续费',
    downgrade: '预约降级',
    downgrade_now: '立刻降级'
  }[changeType] || changeType
  el.textContent =
    actionLabel +
    ' · ' +
    (fromId ? fromId + ' → ' : '') +
    (p ? p.name : selectedPlanId) +
    ' · 到期 ' +
    endLabel +
    ' · 本次发放 ' +
    grant +
    ' 积分' +
    (selectedUser && selectedUser.pending_plan_id
      ? ' · 已有预约降档 ' + selectedUser.pending_plan_id
      : '')
}

function syncChangeDefaults() {
  if (!selectedUser) return
  const ct = suggestChangeType(selectedUser, selectedPlanId)
  const sel = document.getElementById('ucChangeType')
  if (sel && !sel.dataset.manual) sel.value = ct
  const g = document.getElementById('ucGrantMode')
  if (g && !g.dataset.manual) g.value = defaultGrantForChange(sel ? sel.value : ct)
  updateSubPreview()
}

async function ensurePlans() {
  if (plansCache.length) return
  try {
    const data = await api('/v1/admin/plans')
    plansCache = data.plans || []
  } catch (e) {
    plansCache = []
  }
}

function showUserCard(u) {
  selectedUser = u
  const card = document.getElementById('userCard')
  card.classList.remove('hidden')
  document.getElementById('ucPhone').textContent = u.phone || '—'
  document.getElementById('ucMeta').textContent =
    (u.display_name && u.display_name !== u.phone ? u.display_name + ' · ' : '') +
    'ID ' +
    u.id
  document.getElementById('ucStats').innerHTML =
    '<div class="stat-card"><div class="label">当前档位</div><div class="value">' +
    escapeAttr(u.plan_name || u.plan_id || '未开通') +
    '</div></div>' +
    '<div class="stat-card"><div class="label">到期日</div><div class="value">' +
    escapeAttr(formatPeriod(u.period_end)) +
    '</div></div>' +
    '<div class="stat-card"><div class="label">积分余额</div><div class="value">' +
    (u.balance != null ? u.balance : 0) +
    '</div></div>' +
    (u.pending_plan_id
      ? '<div class="stat-card"><div class="label">预约降档</div><div class="value">' +
        escapeAttr(u.pending_plan_id) +
        '</div></div>'
      : '')
  if (u.plan_id) selectedPlanId = u.plan_id
  const ctSel = document.getElementById('ucChangeType')
  const gSel = document.getElementById('ucGrantMode')
  if (ctSel) {
    ctSel.dataset.manual = ''
    ctSel.value = suggestChangeType(u, selectedPlanId)
  }
  if (gSel) {
    gSel.dataset.manual = ''
    gSel.value = defaultGrantForChange(ctSel ? ctSel.value : 'open')
  }
  renderPlanChips('ucPlanChips', selectedPlanId, function (id) {
    selectedPlanId = id
    if (ctSel) ctSel.dataset.manual = ''
    if (gSel) gSel.dataset.manual = ''
    syncChangeDefaults()
  })
  updateSubPreview()
  document.getElementById('ordUserId').value = u.id
  document.getElementById('ordPhone').value = u.phone || ''
}

async function loadUsers() {
  await ensurePlans()
  const q = document.getElementById('userQ').value.trim()
  const data = await api('/v1/admin/users' + (q ? '?q=' + encodeURIComponent(q) : ''))
  usersCache = data.users || []
  const tb = document.querySelector('#usersTable tbody')
  tb.innerHTML = usersCache
    .map(function (u) {
      const nick =
        u.display_name && u.display_name !== u.phone
          ? '<div class="muted">' + escapeAttr(u.display_name) + '</div>'
          : ''
      const planBadge = u.plan_name || u.plan_id
        ? '<span class="badge badge-plan">' +
          escapeAttr(u.plan_name || u.plan_id) +
          '</span>' +
          (u.pending_plan_id
            ? ' <span class="badge badge-pending">→' + escapeAttr(u.pending_plan_id) + '</span>'
            : '')
        : '<span class="muted">—</span>'
      return (
        '<tr class="' +
        (selectedUser && selectedUser.id === u.id ? 'row-selected' : '') +
        '"><td>' +
        u.id +
        '</td><td><strong>' +
        escapeAttr(u.phone) +
        '</strong>' +
        nick +
        '</td><td>' +
        planBadge +
        '</td><td>' +
        escapeAttr(formatPeriod(u.period_end)) +
        '</td><td>' +
        (u.balance != null ? u.balance : 0) +
        '</td><td>' +
        (Number(u.frozen) ? '是' : '否') +
        '</td><td class="row-actions">' +
        '<button type="button" class="btn btn-primary" data-manage="' +
        u.id +
        '">管理</button>' +
        '<button type="button" class="btn btn-secondary" data-freeze="' +
        u.id +
        '" data-v="' +
        (Number(u.frozen) ? 0 : 1) +
        '">' +
        (Number(u.frozen) ? '解冻' : '冻结') +
        '</button>' +
        '<button type="button" class="btn btn-ghost" data-ledger-user="' +
        u.id +
        '" data-phone="' +
        escapeAttr(u.phone) +
        '">流水</button>' +
        '</td></tr>'
      )
    })
    .join('')
  tb.querySelectorAll('[data-freeze]').forEach(function (b) {
    b.onclick = async function () {
      await api('/v1/admin/users/' + b.dataset.freeze + '/freeze', {
        method: 'POST',
        body: { frozen: b.dataset.v === '1' }
      })
      toast('已更新冻结状态')
      loadUsers()
    }
  })
  tb.querySelectorAll('[data-manage]').forEach(function (b) {
    b.onclick = function () {
      const id = Number(b.dataset.manage)
      let found = null
      for (let i = 0; i < usersCache.length; i++) {
        if (usersCache[i].id === id) found = usersCache[i]
      }
      if (found) showUserCard(found)
      else toast('用户不在当前列表')
    }
  })
  tb.querySelectorAll('[data-ledger-user]').forEach(function (b) {
    b.onclick = function () {
      document.getElementById('ledgerUserId').value = b.dataset.ledgerUser
      document.getElementById('ledgerPhone').value = b.dataset.phone || ''
      switchTab('ledger')
    }
  })
}
document.getElementById('btnSearchUsers').onclick = function () {
  loadUsers()
}

document.getElementById('ucClose').onclick = function () {
  selectedUser = null
  document.getElementById('userCard').classList.add('hidden')
}

document.getElementById('ucMonths').onchange = function () {
  document.getElementById('ucEndWrap').hidden = this.value !== 'custom'
  updateSubPreview()
}
document.getElementById('ucGrantMode').onchange = function () {
  this.dataset.manual = '1'
  updateSubPreview()
}
document.getElementById('ucChangeType').onchange = function () {
  this.dataset.manual = '1'
  const g = document.getElementById('ucGrantMode')
  if (g) {
    g.dataset.manual = ''
    g.value = defaultGrantForChange(this.value)
  }
  updateSubPreview()
}
document.getElementById('ucPeriodEnd').onchange = updateSubPreview

document.getElementById('ucPackChips').onclick = function (e) {
  const b = e.target.closest('[data-credits]')
  if (!b) return
  document.getElementById('ucPackCredits').value = b.dataset.credits
  document.getElementById('ucPackAmount').value = b.dataset.yuan || ''
}

async function submitSubscription(payload) {
  const res = await api('/v1/admin/subscription-save', { method: 'POST', body: payload })
  toast('会员已变更')
  if (res.user) showUserCard(res.user)
  loadUsers()
  loadOrders().catch(function () {})
}

async function submitTopup(payload) {
  const res = await api('/v1/admin/credit-topup', { method: 'POST', body: payload })
  toast('流量包已入账')
  if (res.user) showUserCard(res.user)
  loadUsers()
  loadOrders().catch(function () {})
}

document.getElementById('btnSaveSub').onclick = async function () {
  if (!selectedUser) {
    toast('请先在列表点「管理」选中用户')
    return
  }
  const monthsSel = document.getElementById('ucMonths').value
  const body = {
    userId: selectedUser.id,
    phone: selectedUser.phone,
    planId: selectedPlanId,
    changeType: document.getElementById('ucChangeType').value,
    months: monthsSel === 'custom' ? 1 : Number(monthsSel) || 1,
    periodEnd: monthsSel === 'custom' ? document.getElementById('ucPeriodEnd').value : '',
    grantMode: document.getElementById('ucGrantMode').value,
    amountCents: yuanToCents(document.getElementById('ucSubAmount').value),
    paymentNote: document.getElementById('ucSubNote').value.trim()
  }
  if (monthsSel === 'custom' && !body.periodEnd) {
    toast('请填写自定义到期日')
    return
  }
  try {
    await submitSubscription(body)
  } catch (e) {
    toast(e.message)
  }
}

document.getElementById('btnSavePack').onclick = async function () {
  if (!selectedUser) {
    toast('请先在列表点「管理」选中用户')
    return
  }
  try {
    await submitTopup({
      userId: selectedUser.id,
      phone: selectedUser.phone,
      credits: Number(document.getElementById('ucPackCredits').value || 0),
      amountCents: yuanToCents(document.getElementById('ucPackAmount').value),
      paymentNote: document.getElementById('ucPackNote').value.trim()
    })
  } catch (e) {
    toast(e.message)
  }
}

document.getElementById('ordMonths').onchange = function () {
  document.getElementById('ordEndWrap').hidden = this.value !== 'custom'
}

document.getElementById('btnOrdSub').onclick = async function () {
  const monthsSel = document.getElementById('ordMonths').value
  const body = {
    phone: document.getElementById('ordPhone').value.trim(),
    userId: Number(document.getElementById('ordUserId').value || 0),
    planId: ordSelectedPlanId,
    months: monthsSel === 'custom' ? 1 : Number(monthsSel) || 1,
    periodEnd: monthsSel === 'custom' ? document.getElementById('ordPeriodEnd').value : '',
    grantMode: document.getElementById('ordGrantMode').value,
    amountCents: yuanToCents(document.getElementById('ordSubAmount').value),
    paymentNote: document.getElementById('ordSubNote').value.trim()
  }
  if (!body.phone && !body.userId) {
    toast('请填写手机号或用户 ID')
    return
  }
  if (monthsSel === 'custom' && !body.periodEnd) {
    toast('请填写自定义到期日')
    return
  }
  try {
    await submitSubscription(body)
  } catch (e) {
    toast(e.message)
  }
}

document.getElementById('btnOrdPack').onclick = async function () {
  const body = {
    phone: document.getElementById('ordPhone').value.trim(),
    userId: Number(document.getElementById('ordUserId').value || 0),
    credits: Number(document.getElementById('ordCredits').value || 0),
    amountCents: yuanToCents(document.getElementById('ordAmount').value),
    paymentNote: document.getElementById('ordNote').value.trim()
  }
  if (!body.phone && !body.userId) {
    toast('请填写手机号或用户 ID')
    return
  }
  try {
    await submitTopup(body)
  } catch (e) {
    toast(e.message)
  }
}

async function loadOrders() {
  await ensurePlans()
  renderPlanChips('ordPlanChips', ordSelectedPlanId, function (id) {
    ordSelectedPlanId = id
  })
  const data = await api('/v1/admin/orders')
  const tb = document.querySelector('#ordersTable tbody')
  tb.innerHTML = (data.orders || [])
    .map(function (o) {
      let badge = '<span class="badge">' + escapeAttr(o.status) + '</span>'
      if (o.status === 'pending') badge = '<span class="badge badge-pending">待确认</span>'
      else if (o.status === 'paid') badge = '<span class="badge badge-paid">已履约</span>'
      else if (o.status === 'rejected') badge = '<span class="badge badge-rejected">已拒绝</span>'
      const kind = o.plan_id
        ? '会员'
        : Number(o.credits) > 0
          ? '流量包'
          : escapeAttr(o.channel || '意向')
      const acts = []
      if (o.status === 'pending') {
        acts.push(
          '<button type="button" class="btn btn-primary" data-fulfill="' +
            escapeAttr(o.id) +
            '">确认预约</button>'
        )
        acts.push(
          '<button type="button" class="btn btn-ghost" data-reject="' +
            escapeAttr(o.id) +
            '">拒绝</button>'
        )
      }
      acts.push(
        '<button type="button" class="btn btn-danger" data-delete-order="' +
          escapeAttr(o.id) +
          '">删除</button>'
      )
      return (
        '<tr><td>' +
        escapeAttr(o.id) +
        '</td><td><strong>' +
        escapeAttr(o.phone || '—') +
        '</strong></td><td>' +
        o.user_id +
        '</td><td>' +
        badge +
        '</td><td>' +
        kind +
        '</td><td>' +
        o.credits +
        '</td><td>' +
        escapeAttr(o.plan_id || '-') +
        '</td><td>' +
        escapeAttr(o.payment_note || '') +
        '</td><td class="row-actions">' +
        acts.join('') +
        '</td></tr>'
      )
    })
    .join('')
  tb.querySelectorAll('[data-fulfill]').forEach(function (b) {
    b.onclick = async function () {
      const note = prompt('付款凭证备注（可空）') || ''
      try {
        await api('/v1/admin/orders-fulfill', {
          method: 'POST',
          body: { id: b.dataset.fulfill, paymentNote: note }
        })
        toast('已确认预约并履约入账')
        loadOrders()
        loadUsers().catch(function () {})
      } catch (e) {
        toast(e.message)
      }
    }
  })
  tb.querySelectorAll('[data-reject]').forEach(function (b) {
    b.onclick = async function () {
      const note = prompt('拒绝原因（可空）') || ''
      try {
        await api('/v1/admin/orders-reject', {
          method: 'POST',
          body: { id: b.dataset.reject, note: note }
        })
        toast('已拒绝该预约')
        loadOrders()
      } catch (e) {
        toast(e.message)
      }
    }
  })
  tb.querySelectorAll('[data-delete-order]').forEach(function (b) {
    b.onclick = async function () {
      if (!confirm('确定删除这条意向/订单记录？不可恢复。')) return
      try {
        await api('/v1/admin/orders-delete', {
          method: 'POST',
          body: { id: b.dataset.deleteOrder }
        })
        toast('已删除')
        loadOrders()
      } catch (e) {
        toast(e.message)
      }
    }
  })
}

async function loadLedger() {
  const uid = document.getElementById('ledgerUserId').value
  const phone = document.getElementById('ledgerPhone').value.trim()
  let qs = ''
  if (phone) qs = '?phone=' + encodeURIComponent(phone)
  else if (uid) qs = '?userId=' + encodeURIComponent(uid)
  const data = await api('/v1/admin/ledger' + qs)
  document.querySelector('#ledgerTable tbody').innerHTML = (data.ledger || [])
    .map(function (r) {
      return (
        '<tr><td>' +
        escapeAttr(r.created_at) +
        '</td><td><strong>' +
        escapeAttr(r.phone || '—') +
        '</strong></td><td>' +
        r.user_id +
        '</td><td>' +
        r.delta +
        '</td><td>' +
        r.balance_after +
        '</td><td>' +
        escapeAttr(r.reason) +
        '</td><td>' +
        escapeAttr(r.note || r.request_id || '') +
        '</td></tr>'
      )
    })
    .join('')
}
document.getElementById('btnLedger').onclick = function () {
  loadLedger()
}

async function loadPlans() {
  const data = await api('/v1/admin/plans')
  const rank = { trial: 0, standard: 1, advanced: 2, flagship: 3, free: 10, pro: 11, max: 12 }
  const list = (data.plans || []).slice().sort(function (a, b) {
    const ra = rank[a.id] != null ? rank[a.id] : 50 + Number(a.sort_order || 0)
    const rb = rank[b.id] != null ? rank[b.id] : 50 + Number(b.sort_order || 0)
    return ra - rb
  })
  const tb = document.querySelector('#plansTable tbody')
  tb.innerHTML = list
    .map(function (p) {
      return (
        '<tr data-id="' +
        escapeAttr(p.id) +
        '"><td>' +
        escapeAttr(p.id) +
        '</td>' +
        '<td><input data-f="name" value="' +
        escapeAttr(p.name) +
        '" /></td>' +
        '<td><input data-f="monthly_credits" type="number" value="' +
        p.monthly_credits +
        '" /></td>' +
        '<td><input data-f="gift_credits" type="number" value="' +
        (p.gift_credits != null ? p.gift_credits : 0) +
        '" /></td>' +
        '<td><input data-f="price_month_cents" type="number" value="' +
        p.price_month_cents +
        '" /></td>' +
        '<td><input data-f="price_year_cents" type="number" value="' +
        p.price_year_cents +
        '" /></td>' +
        '<td><input data-f="sort_order" type="number" value="' +
        p.sort_order +
        '" /></td>' +
        '<td><select data-f="active"><option value="1"' +
        (Number(p.active) ? ' selected' : '') +
        '>是</option><option value="0"' +
        (!Number(p.active) ? ' selected' : '') +
        '>否</option></select></td>' +
        '<td><button type="button" class="btn btn-primary" data-save-plan="' +
        escapeAttr(p.id) +
        '">保存</button></td></tr>'
      )
    })
    .join('')
  tb.querySelectorAll('[data-save-plan]').forEach(function (b) {
    b.onclick = async function () {
      try {
        const tr = b.closest('tr')
        const body = { id: b.dataset.savePlan }
        tr.querySelectorAll('[data-f]').forEach(function (inp) {
          const f = inp.dataset.f
          body[f] = f === 'name' ? inp.value : Number(inp.value)
        })
        await api('/v1/admin/plans-save', { method: 'POST', body: body })
        toast('套餐已保存')
        loadPlans()
      } catch (e) {
        toast(e.message)
      }
    }
  })
}

async function loadPrices() {
  const data = await api('/v1/admin/prices')
  const labels = {
    voiceCreditsPerMinute: '语音（分/分钟）',
    replyCredits: '帮我对话·文本',
    replyVisionCredits: '帮我对话·读屏',
    screenAskCredits: '看屏幕',
    screenQuizCredits: '看屏幕答题'
  }
  document.getElementById('pricesForm').innerHTML = Object.keys(data.prices || {})
    .map(function (k) {
      return (
        '<label class="field">' +
        (labels[k] || k) +
        '<input data-price="' +
        escapeAttr(k) +
        '" type="number" value="' +
        data.prices[k] +
        '" /></label>'
      )
    })
    .join('')
}
document.getElementById('btnSavePrices').onclick = async function () {
  try {
    const body = {}
    document.querySelectorAll('[data-price]').forEach(function (inp) {
      body[inp.dataset.price] = Number(inp.value)
    })
    await api('/v1/admin/prices-save', { method: 'POST', body: body })
    toast('单价已保存')
    loadPrices()
  } catch (e) {
    toast(e.message)
  }
}

async function loadRoutes() {
  const data = await api('/v1/admin/model-routes')
  const el = document.getElementById('routesForm')
  el.innerHTML = (data.routes || [])
    .map(function (r) {
      return (
        '<div class="route-card" data-slot="' +
        escapeAttr(r.slot) +
        '"><h3>' +
        escapeAttr(r.slot) +
        '</h3><p class="meta">' +
        (r.hasKey ? '已配置 Key ' + escapeAttr(r.api_key) : '未配置 Key') +
        '</p>' +
        '<label class="field">Base URL<input data-f="base_url" value="' +
        escapeAttr(r.base_url) +
        '" /></label>' +
        '<label class="field">Model<input data-f="model_id" value="' +
        escapeAttr(r.model_id) +
        '" /></label>' +
        '<label class="field">API Key（留空或 *** 表示不改）<input data-f="api_key" value="' +
        escapeAttr(r.api_key) +
        '" autocomplete="off" /></label>' +
        '<button type="button" class="btn btn-primary" data-save-route="' +
        escapeAttr(r.slot) +
        '">保存</button></div>'
      )
    })
    .join('')
  el.querySelectorAll('[data-save-route]').forEach(function (b) {
    b.onclick = async function () {
      try {
        const card = b.closest('.route-card')
        const body = { slot: b.dataset.saveRoute }
        card.querySelectorAll('[data-f]').forEach(function (inp) {
          body[inp.dataset.f] = inp.value
        })
        await api('/v1/admin/model-routes-save', { method: 'POST', body: body })
        toast('路由已保存')
        loadRoutes()
      } catch (e) {
        toast(e.message)
      }
    }
  })
}

async function loadRedeem() {
  const data = await api('/v1/admin/redeem-codes')
  document.querySelector('#redeemTable tbody').innerHTML = (data.codes || [])
    .map(function (c) {
      return (
        '<tr><td><code>' +
        escapeAttr(c.code) +
        '</code></td><td>' +
        c.credits +
        '</td><td>' +
        c.used_count +
        '/' +
        c.max_uses +
        '</td><td><strong>' +
        escapeAttr(c.used_phones_text || '—') +
        '</strong></td><td>' +
        escapeAttr(c.note || '') +
        '</td><td><button type="button" class="btn btn-ghost" data-copy="' +
        escapeAttr(c.code) +
        '">复制</button></td></tr>'
      )
    })
    .join('')
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.onclick = function () {
      if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy)
      toast('已复制 ' + b.dataset.copy)
    }
  })
}
document.getElementById('btnCreateRedeem').onclick = async function () {
  try {
    const data = await api('/v1/admin/redeem-codes', {
      method: 'POST',
      body: {
        code: document.getElementById('rCode').value.trim(),
        credits: Number(document.getElementById('rCredits').value),
        max_uses: Number(document.getElementById('rUses').value),
        note: document.getElementById('rNote').value
      }
    })
    toast('已生成 ' + (data.code || ''))
    document.getElementById('rCode').value = ''
    loadRedeem()
  } catch (e) {
    toast(e.message)
  }
}

async function loadOps() {
  const data = await api('/v1/admin/ops')
  document.getElementById('opsHint').value = data.paymentHint || ''
  document.getElementById('opsContact').value = data.supportContact || ''
}
document.getElementById('btnSaveOps').onclick = async function () {
  try {
    await api('/v1/admin/ops-save', {
      method: 'POST',
      body: {
        paymentHint: document.getElementById('opsHint').value,
        supportContact: document.getElementById('opsContact').value
      }
    })
    toast('运营文案已保存')
    loadOps()
  } catch (e) {
    toast(e.message)
  }
}

async function loadRoadmap() {
  const data = await api('/v1/admin/roadmap')
  const s = data.summary || {}
  document.getElementById('roadmapSummary').textContent =
    '已完成 ' +
    (s.done || 0) +
    ' · 进行中 ' +
    (s.in_progress || 0) +
    ' · 未开始 ' +
    (s.pending || 0) +
    ' · 后置 ' +
    (s.deferred || 0)
  const tb = document.querySelector('#roadmapTable tbody')
  tb.innerHTML = (data.items || [])
    .map(function (it) {
      const opts = ['pending', 'in_progress', 'done', 'deferred', 'cancelled']
        .map(function (st) {
          return (
            '<option value="' +
            st +
            '"' +
            (it.status === st ? ' selected' : '') +
            '>' +
            STATUS_LABEL[st] +
            '</option>'
          )
        })
        .join('')
      return (
        '<tr data-id="' +
        it.id +
        '"><td><input data-f="phase" value="' +
        escapeAttr(it.phase) +
        '" style="width:80px" /></td>' +
        '<td><input data-f="title" value="' +
        escapeAttr(it.title) +
        '" /></td>' +
        '<td><select data-f="status">' +
        opts +
        '</select></td>' +
        '<td><input data-f="detail" value="' +
        escapeAttr(it.detail) +
        '" /></td>' +
        '<td><input data-f="sort_order" type="number" value="' +
        it.sort_order +
        '" style="width:70px" /></td>' +
        '<td class="row-actions"><button type="button" class="btn btn-primary" data-save-rm="' +
        it.id +
        '">保存</button>' +
        '<button type="button" class="btn btn-danger" data-del-rm="' +
        it.id +
        '">删</button></td></tr>'
      )
    })
    .join('')
  tb.querySelectorAll('[data-save-rm]').forEach(function (b) {
    b.onclick = async function () {
      try {
        const tr = b.closest('tr')
        const body = { id: Number(b.dataset.saveRm) }
        tr.querySelectorAll('[data-f]').forEach(function (el) {
          body[el.dataset.f] = el.dataset.f === 'sort_order' ? Number(el.value) : el.value
        })
        await api('/v1/admin/roadmap-save', { method: 'POST', body: body })
        toast('任务已保存')
        loadRoadmap()
      } catch (e) {
        toast(e.message)
      }
    }
  })
  tb.querySelectorAll('[data-del-rm]').forEach(function (b) {
    b.onclick = async function () {
      if (!confirm('删除该任务？')) return
      try {
        await api('/v1/admin/roadmap-delete', {
          method: 'POST',
          body: { id: Number(b.dataset.delRm) }
        })
        loadRoadmap()
      } catch (e) {
        toast(e.message)
      }
    }
  })
}
document.getElementById('btnAddRoadmap').onclick = async function () {
  try {
    await api('/v1/admin/roadmap', {
      method: 'POST',
      body: {
        phase: document.getElementById('rmPhase').value,
        title: document.getElementById('rmTitle').value,
        status: document.getElementById('rmStatus').value,
        sort_order: Number(document.getElementById('rmSort').value || 100),
        detail: document.getElementById('rmDetail').value
      }
    })
    document.getElementById('rmTitle').value = ''
    document.getElementById('rmDetail').value = ''
    toast('已添加')
    loadRoadmap()
  } catch (e) {
    toast(e.message)
  }
}

async function loadKb() {
  const data = await api('/v1/admin/kb')
  kbCache = data.articles || []
  const sel = document.getElementById('kbCategory')
  if (sel && !sel.dataset.ready) {
    sel.innerHTML = KB_CATEGORIES.map(function (c) {
      return '<option value="' + escapeAttr(c.id) + '">' + escapeText(c.id) + '</option>'
    }).join('')
    sel.value = '凭证账号'
    sel.dataset.ready = '1'
  }
  const filters = document.getElementById('kbFilters')
  if (filters) {
    const cats = ['全部'].concat(
      KB_CATEGORIES.map(function (c) {
        return c.id
      })
    )
    filters.innerHTML = cats
      .map(function (c) {
        const n =
          c === '全部'
            ? kbCache.length
            : kbCache.filter(function (a) {
                return a.category === c
              }).length
        return (
          '<button type="button" class="kb-filter' +
          (kbFilter === c ? ' active' : '') +
          '" data-kb-filter="' +
          escapeAttr(c) +
          '">' +
          escapeText(c) +
          ' · ' +
          n +
          '</button>'
        )
      })
      .join('')
    filters.querySelectorAll('[data-kb-filter]').forEach(function (b) {
      b.onclick = function () {
        kbFilter = b.dataset.kbFilter
        renderKbList()
        filters.querySelectorAll('.kb-filter').forEach(function (x) {
          x.classList.toggle('active', x.dataset.kbFilter === kbFilter)
        })
      }
    })
  }
  const search = document.getElementById('kbSearch')
  if (search && !search.dataset.bound) {
    search.dataset.bound = '1'
    search.oninput = function () {
      kbQuery = search.value.trim().toLowerCase()
      renderKbList()
    }
  }
  renderKbList()
}

function renderKbList() {
  const root = document.getElementById('kbGrouped')
  if (!root) return
  let list = kbCache.slice()
  if (kbFilter !== '全部') {
    list = list.filter(function (a) {
      return a.category === kbFilter
    })
  }
  if (kbQuery) {
    list = list.filter(function (a) {
      return (
        String(a.title || '')
          .toLowerCase()
          .indexOf(kbQuery) >= 0 ||
        String(a.body || '')
          .toLowerCase()
          .indexOf(kbQuery) >= 0 ||
        String(a.category || '')
          .toLowerCase()
          .indexOf(kbQuery) >= 0
      )
    })
  }

  const order = KB_CATEGORIES.map(function (c) {
    return c.id
  })
  const groups = {}
  list.forEach(function (a) {
    const cat = a.category || '其它'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(a)
  })
  const catKeys = Object.keys(groups).sort(function (a, b) {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })

  if (!catKeys.length) {
    root.innerHTML =
      '<div class="panel empty"><p class="hint">暂无条目。请用上方表单按分类写入密钥、教程或踩坑。</p></div>'
    return
  }

  root.innerHTML = catKeys
    .map(function (cat) {
      const hint =
        (
          KB_CATEGORIES.find(function (c) {
            return c.id === cat
          }) || {}
        ).hint || ''
      const cards = groups[cat]
        .map(function (a) {
          const preview = String(a.body || '')
            .replace(/\s+/g, ' ')
            .slice(0, 120)
          const catOpts = KB_CATEGORIES.map(function (c) {
            return (
              '<option value="' +
              escapeAttr(c.id) +
              '"' +
              (a.category === c.id ? ' selected' : '') +
              '>' +
              escapeText(c.id) +
              '</option>'
            )
          }).join('')
          return (
            '<div class="kb-card" data-kb="' +
            a.id +
            '" data-cat="' +
            escapeAttr(a.category) +
            '">' +
            '<div class="kb-card-top">' +
            '<div><strong>' +
            escapeText(a.title) +
            '</strong> <span class="kb-cat-pill">' +
            escapeText(a.category) +
            '</span>' +
            '<p class="hint" style="margin:4px 0 0">更新 ' +
            escapeText(a.updated_at || '') +
            '</p></div>' +
            '<div class="row-actions">' +
            '<button type="button" class="btn btn-secondary" data-toggle-kb="' +
            a.id +
            '">展开编辑</button>' +
            '<button type="button" class="btn btn-ghost" data-copy-kb="' +
            a.id +
            '">复制正文</button>' +
            '</div></div>' +
            '<p class="kb-preview">' +
            escapeText(preview) +
            (String(a.body || '').length > 120 ? '…' : '') +
            '</p>' +
            '<div class="kb-edit">' +
            '<label class="field">标题<input data-f="title" value="' +
            escapeAttr(a.title) +
            '" /></label>' +
            '<div class="form-grid">' +
            '<label class="field">分类<select data-f="category">' +
            catOpts +
            '</select></label>' +
            '<label class="field">排序<input data-f="sort_order" type="number" value="' +
            a.sort_order +
            '" /></label></div>' +
            '<label class="field">正文<textarea data-f="body" rows="10">' +
            escapeText(a.body) +
            '</textarea></label>' +
            '<div class="row-actions">' +
            '<button type="button" class="btn btn-primary" data-save-kb="' +
            a.id +
            '">保存</button>' +
            '<button type="button" class="btn btn-danger" data-del-kb="' +
            a.id +
            '">删除</button>' +
            '</div></div></div>'
          )
        })
        .join('')
      return (
        '<section class="kb-group">' +
        '<div class="kb-group-head"><h3>' +
        escapeText(cat) +
        ' · ' +
        groups[cat].length +
        '</h3><p class="hint">' +
        escapeText(hint) +
        '</p></div>' +
        '<div class="kb-list">' +
        cards +
        '</div></section>'
      )
    })
    .join('')

  root.querySelectorAll('[data-toggle-kb]').forEach(function (b) {
    b.onclick = function () {
      const card = root.querySelector('[data-kb="' + b.dataset.toggleKb + '"]')
      if (!card) return
      const open = card.classList.toggle('open')
      b.textContent = open ? '收起' : '展开编辑'
    }
  })
  root.querySelectorAll('[data-copy-kb]').forEach(function (b) {
    b.onclick = function () {
      const art = kbCache.find(function (x) {
        return String(x.id) === String(b.dataset.copyKb)
      })
      if (!art) return
      if (navigator.clipboard) navigator.clipboard.writeText(art.body || '')
      toast('已复制正文')
    }
  })
  root.querySelectorAll('[data-save-kb]').forEach(function (b) {
    b.onclick = async function () {
      try {
        const card = b.closest('[data-kb]')
        const body = { id: Number(b.dataset.saveKb) }
        card.querySelectorAll('[data-f]').forEach(function (inp) {
          body[inp.dataset.f] = inp.dataset.f === 'sort_order' ? Number(inp.value) : inp.value
        })
        await api('/v1/admin/kb-save', { method: 'POST', body: body })
        toast('情报已保存')
        loadKb()
      } catch (e) {
        toast(e.message)
      }
    }
  })
  root.querySelectorAll('[data-del-kb]').forEach(function (b) {
    b.onclick = async function () {
      if (!confirm('删除这条情报？不可恢复。')) return
      try {
        await api('/v1/admin/kb-delete', {
          method: 'POST',
          body: { id: Number(b.dataset.delKb) }
        })
        loadKb()
      } catch (e) {
        toast(e.message)
      }
    }
  })
}

document.getElementById('btnAddKb').onclick = async function () {
  try {
    const title = document.getElementById('kbTitle').value.trim()
    const body = document.getElementById('kbBody').value
    if (!title) throw new Error('请填写标题')
    if (!String(body).trim()) throw new Error('请填写正文（密钥/步骤等内容）')
    await api('/v1/admin/kb', {
      method: 'POST',
      body: {
        title: title,
        category: document.getElementById('kbCategory').value,
        sort_order: Number(document.getElementById('kbSort').value || 100),
        body: body
      }
    })
    document.getElementById('kbTitle').value = ''
    document.getElementById('kbBody').value = ''
    toast('已写入情报库')
    loadKb()
  } catch (e) {
    toast(e.message)
  }
}

if (token) {
  showApp(true)
  switchTab('overview')
}
