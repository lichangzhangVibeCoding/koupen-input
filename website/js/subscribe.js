/* Plan card renderer for /subscribe/ — uses TalkNowPlans + i18n */
;(function () {
  function lang() {
    try {
      return (window.TalkNowI18n && window.TalkNowI18n.lang) || 'zh'
    } catch (e) {
      return 'zh'
    }
  }

  function tr(key, vars) {
    if (window.TalkNowI18n && typeof window.TalkNowI18n.t === 'function') {
      return window.TalkNowI18n.t(key, vars)
    }
    return key
  }

  function featureLine(kind, plan) {
    var gift = plan.giftCredits || 0
    var base =
      plan.baseCredits != null ? plan.baseCredits : Math.max(0, (plan.monthlyCredits || 0) - gift)
    switch (kind) {
      case 'credits':
        // shown as big metric; skip duplicate in list
        return ''
      case 'officialSlots':
        return tr('plan.feat.officialSlots')
      case 'byok':
        return tr('plan.feat.byok')
      case 'local':
        return tr('plan.feat.local')
      case 'light':
        return tr('plan.feat.light')
      case 'nocode':
        return tr('plan.feat.nocode')
      case 'heavy':
        return tr('plan.feat.heavy')
      case 'priority':
        return tr('plan.feat.priority')
      default:
        return ''
    }
  }

  function creditMeta(plan) {
    var gift = plan.giftCredits || 0
    var base =
      plan.baseCredits != null ? plan.baseCredits : Math.max(0, (plan.monthlyCredits || 0) - gift)
    var total = plan.monthlyCredits != null ? plan.monthlyCredits : base + gift
    return { base: base, gift: gift, total: total }
  }

  function formatPrice(p, billing) {
    if (!p.priceMonthCents) {
      return { main: tr('plan.price.free'), sub: '' }
    }
    if (billing === 'year' && p.priceYearCents > 0) {
      var perMo = p.priceYearCents / 12 / 100
      var perMoS = perMo % 1 ? perMo.toFixed(1) : perMo.toFixed(0)
      return {
        main: '¥' + (p.priceYearCents / 100).toFixed(0) + tr('plan.price.perYear'),
        sub: tr('plan.price.yearHint', { n: perMoS })
      }
    }
    var yuan = p.priceMonthCents / 100
    var s = yuan % 1 ? yuan.toFixed(1) : yuan.toFixed(0)
    var sub = ''
    if (p.priceYearCents > 0) {
      var save = Math.max(0, p.priceMonthCents * 12 - p.priceYearCents)
      if (save > 0) {
        sub = tr('plan.price.yearSaveHint', { n: (save / 100).toFixed(0) })
      }
    }
    return { main: '¥' + s + tr('plan.price.perMonth'), sub: sub }
  }

  function blurb(id) {
    return tr('plan.blurb.' + id)
  }

  function setStatus(kind, text) {
    var status = document.getElementById('subscribeStatus')
    if (!status) return
    if (!text) {
      status.hidden = true
      status.textContent = ''
      status.className = 'subscribe-status'
      return
    }
    status.hidden = false
    status.removeAttribute('data-i18n')
    status.textContent = text
    status.className = 'subscribe-status' + (kind ? ' ' + kind : '')
  }

  function renderRates(prices, topup) {
    var el = document.getElementById('subscribeRates')
    if (!el) return
    var voice =
      prices &&
      (prices.voiceCreditsPerMinute != null
        ? prices.voiceCreditsPerMinute
        : prices.voicePerMinute)
    if (voice == null) voice = 2
    var replyVision = prices && prices.replyVisionCredits != null ? prices.replyVisionCredits : 5
    var replyText = prices && prices.replyCredits != null ? prices.replyCredits : 10
    var reply = replyVision + replyText
    var screen =
      prices && (prices.screenAskCredits != null ? prices.screenAskCredits : prices.screen_ask)
    if (screen == null) screen = 25
    var tc = (topup && topup.credits) || 1000
    var tp = topup && topup.priceCents != null ? topup.priceCents / 100 : 20

    var items = [
      { label: tr('subscribe.rate.voiceLabel'), value: tr('subscribe.rate.nPerMin', { n: String(voice) }) },
      { label: tr('subscribe.rate.replyLabel'), value: tr('subscribe.rate.nPerRun', { n: String(reply) }) },
      { label: tr('subscribe.rate.screenLabel'), value: tr('subscribe.rate.nPerRun', { n: String(screen) }) },
      { label: tr('subscribe.rate.topupLabel'), value: tr('subscribe.rate.topupValue', { credits: String(tc), yuan: String(tp) }) }
    ]

    el.innerHTML =
      '<h2>' +
      tr('subscribe.ratesTitle') +
      '</h2><div class="rates-grid">' +
      items
        .map(function (it) {
          return (
            '<div class="rate-card"><span class="rate-label">' +
            it.label +
            '</span><span class="rate-value">' +
            it.value +
            '</span></div>'
          )
        })
        .join('') +
      '</div>' +
      (state.stripeEnabled
        ? '<p style="text-align:center;margin-top:16px"><button type="button" class="btn btn-secondary" id="subTopupPay">' +
          tr('subscribe.payStripe') +
          ' · ' +
          tr('subscribe.rate.topupLabel') +
          '</button></p>'
        : '')
    var topupBtn = document.getElementById('subTopupPay')
    if (topupBtn) {
      topupBtn.addEventListener('click', function () {
        var pack = state.topup || window.TalkNowPlans.topupFallback()
        startPay({ credits: pack.credits, amountCents: pack.priceCents })
      })
    }
  }

  function renderGrid(plans, billing) {
    var grid = document.getElementById('subscribeGrid')
    if (!grid || !window.TalkNowPlans) return
    var sorted = window.TalkNowPlans.sortPlans(plans)
    grid.innerHTML = sorted
      .map(function (p) {
        var kinds = window.TalkNowPlans.featureKinds(p.id)
        var feats = kinds
          .map(function (k) {
            return featureLine(k, p)
          })
          .filter(Boolean)
        var pop = window.TalkNowPlans.featured(p.id)
        var cm = creditMeta(p)
        var price = formatPrice(p, billing)
        var creditLine =
          cm.gift > 0
            ? tr('plan.feat.baseGift', { base: String(cm.base), gift: String(cm.gift) })
            : tr('plan.feat.baseCredits', { n: String(cm.base || cm.total) })

        return (
          '<article class="price-card' +
          (pop ? ' featured' : '') +
          (p.priceMonthCents === 0 ? ' free' : '') +
          '">' +
          (pop ? '<div class="price-badge">' + tr('plan.popular') + '</div>' : '') +
          '<div class="price-card-top">' +
          '<h2>' +
          (p.name || p.id) +
          '</h2>' +
          '<p class="price-blurb">' +
          blurb(p.id) +
          '</p>' +
          '</div>' +
          '<div class="price-block">' +
          '<div class="amount">' +
          price.main +
          '</div>' +
          (price.sub ? '<div class="amount-sub">' + price.sub + '</div>' : '') +
          '</div>' +
          '<div class="credit-chip">' +
          '<span class="credit-num">' +
          cm.total.toLocaleString(lang() === 'en' ? 'en-US' : 'zh-CN') +
          '</span>' +
          '<span class="credit-unit">' +
          tr('plan.creditsUnit') +
          '</span>' +
          '<span class="credit-detail">' +
          creditLine +
          '</span>' +
          '</div>' +
          '<ul class="feat-list">' +
          feats
            .map(function (f) {
              return '<li><span class="feat-check" aria-hidden="true"></span><span>' + f + '</span></li>'
            })
            .join('') +
          '</ul>' +
          (p.priceMonthCents > 0
            ? '<button type="button" class="btn btn-primary pay-btn" data-pay-plan="' +
              p.id +
              '">' +
              tr('subscribe.payStripe') +
              '</button>'
            : '') +
          '</article>'
        )
      })
      .join('')
    grid.querySelectorAll('[data-pay-plan]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        startPay({ planId: btn.getAttribute('data-pay-plan'), interval: state.billing })
      })
    })
  }

  var TOKEN_KEY = 'talknow_access_token'
  var PHONE_KEY = 'talknow_phone'
  var state = {
    plans: null,
    prices: null,
    topup: null,
    billing: 'month',
    stripeEnabled: false,
    token: '',
    phone: ''
  }

  function apiRoot() {
    var api = (window.TalkNowPlans && window.TalkNowPlans.PLANS_API) || ''
    return api.replace(/\/v1\/plans\/?$/, '')
  }

  function loadSession() {
    try {
      state.token = sessionStorage.getItem(TOKEN_KEY) || ''
      state.phone = sessionStorage.getItem(PHONE_KEY) || ''
    } catch (e) {
      state.token = ''
      state.phone = ''
    }
  }

  function saveSession(token, phone) {
    state.token = token || ''
    state.phone = phone || ''
    try {
      if (state.token) {
        sessionStorage.setItem(TOKEN_KEY, state.token)
        sessionStorage.setItem(PHONE_KEY, state.phone)
      } else {
        sessionStorage.removeItem(TOKEN_KEY)
        sessionStorage.removeItem(PHONE_KEY)
      }
    } catch (e) {}
  }

  function renderLogin() {
    var el = document.getElementById('subscribeLogin')
    if (!el) return
    if (state.token) {
      el.innerHTML =
        '<span>' +
        tr('subscribe.loggedIn', { phone: state.phone || '' }) +
        '</span><button type="button" class="btn btn-secondary" id="subLogout">' +
        tr('subscribe.logout') +
        '</button>'
      var out = document.getElementById('subLogout')
      if (out) {
        out.addEventListener('click', function () {
          saveSession('', '')
          renderLogin()
        })
      }
      return
    }
    el.innerHTML =
      '<input id="subPhone" type="tel" autocomplete="tel" placeholder="' +
      tr('subscribe.phone') +
      '">' +
      '<input id="subCode" type="text" inputmode="numeric" placeholder="' +
      tr('subscribe.code') +
      '">' +
      '<button type="button" class="btn btn-secondary" id="subSend">' +
      tr('subscribe.sendCode') +
      '</button>' +
      '<button type="button" class="btn btn-primary" id="subLogin">' +
      tr('subscribe.doLogin') +
      '</button>'
    var send = document.getElementById('subSend')
    var login = document.getElementById('subLogin')
    if (send) send.addEventListener('click', requestCode)
    if (login) login.addEventListener('click', doLogin)
  }

  function requestCode() {
    var phone = ((document.getElementById('subPhone') || {}).value || '').replace(/\D+/g, '')
    if (phone.length < 6) {
      setStatus('warn', tr('subscribe.needLogin'))
      return
    }
    fetch(apiRoot() + '/v1/auth/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone })
    })
      .then(function (r) {
        return r.json()
      })
      .then(function (data) {
        if (data.error) throw new Error(data.error)
        setStatus('', data.devHint || tr('subscribe.sendCode'))
      })
      .catch(function (e) {
        setStatus('warn', e.message || tr('subscribe.fallback'))
      })
  }

  function doLogin() {
    var phone = ((document.getElementById('subPhone') || {}).value || '').replace(/\D+/g, '')
    var code = ((document.getElementById('subCode') || {}).value || '').trim()
    if (!phone || !code) {
      setStatus('warn', tr('subscribe.needLogin'))
      return
    }
    fetch(apiRoot() + '/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone, code: code })
    })
      .then(function (r) {
        return r.json()
      })
      .then(function (data) {
        if (!data.accessToken) throw new Error(data.error || tr('subscribe.needLogin'))
        saveSession(data.accessToken, phone)
        setStatus('', '')
        renderLogin()
      })
      .catch(function (e) {
        setStatus('warn', e.message || tr('subscribe.needLogin'))
      })
  }

  function startPay(body) {
    if (!state.token) {
      setStatus('warn', tr('subscribe.needLogin'))
      return
    }
    setStatus('', tr('subscribe.opening'))
    body = body || {}
    body.source = 'stripe'
    fetch(apiRoot() + '/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + state.token
      },
      body: JSON.stringify(body)
    })
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status)
          return data
        })
      })
      .then(function (data) {
        if (!data.checkoutUrl) throw new Error(data.error || tr('subscribe.fallback'))
        location.href = data.checkoutUrl
      })
      .catch(function (e) {
        setStatus('warn', e.message || tr('subscribe.fallback'))
      })
  }

  function paint() {
    var plans = state.plans || window.TalkNowPlans.fallbackPlans(lang())
    renderGrid(plans, state.billing)
    renderRates(state.prices, state.topup || window.TalkNowPlans.topupFallback())
  }

  function load() {
    var api = (window.TalkNowPlans && window.TalkNowPlans.PLANS_API) || ''
    paint()
    setStatus('', '')
    if (!api) return

    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
    var timer = null
    if (ctrl) {
      timer = setTimeout(function () {
        try {
          ctrl.abort()
        } catch (e) {}
      }, 4000)
    }

    fetch(api, { credentials: 'omit', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        return r.json()
      })
      .then(function (data) {
        state.plans = data.plans || []
        state.prices = data.prices || null
        state.topup = data.topup || null
        state.stripeEnabled = !!data.stripeEnabled
        setStatus('', '')
        paint()
      })
      .catch(function () {
        // Keep fallback cards; only warn if we never got live data.
        if (!state.plans) setStatus('warn', tr('subscribe.fallback'))
        paint()
      })
      .then(function () {
        if (timer) clearTimeout(timer)
      })
  }

  function bindBilling() {
    document.querySelectorAll('[data-billing]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.billing = btn.getAttribute('data-billing') || 'month'
        document.querySelectorAll('[data-billing]').forEach(function (b) {
          b.classList.toggle('active', b === btn)
        })
        paint()
      })
    })
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadSession()
    renderLogin()
    bindBilling()
    load()
    document.addEventListener('talknow:lang', function () {
      paint()
      renderLogin()
    })
  })
})()
