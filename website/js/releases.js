;(function () {
  var REPO = 'https://github.com/lichangzhangVibeCoding/koupen-input'
  var LATEST = REPO + '/releases/latest'
  /** Only latest Win installer on ./dl/; older versions → GitHub Releases.
   *  Host WAF: /downloads/ path 404; .dmg blocked; .exe/.zip OK. */
  function siteHostedSet(catalog) {
    var latest = (catalog && catalog.releases && catalog.releases[0]) || null
    var win = latest && latest.downloads && latest.downloads.winX64
    return win ? { [win]: true } : {}
  }
  var SITE_DL_DIR = 'dl/'

  function downloadUrl(version, filename, catalog) {
    if (!filename) return LATEST
    if (siteHostedSet(catalog)[filename]) {
      var base = document.body && document.body.getAttribute('data-page') === 'changelog' ? '../' + SITE_DL_DIR : './' + SITE_DL_DIR
      return base + encodeURIComponent(filename)
    }
    return REPO + '/releases/download/v' + version + '/' + encodeURIComponent(filename)
  }

  function lang() {
    return (window.TalkNowI18n && window.TalkNowI18n.getLang()) || 'zh'
  }

  function t(key) {
    return (window.TalkNowI18n && window.TalkNowI18n.t(key)) || key
  }

  function localizedTitle(r) {
    if (lang() === 'en') return r.titleEn || r.title || ''
    return r.title || ''
  }

  function localizedHighlights(r) {
    if (lang() === 'en' && Array.isArray(r.highlightsEn) && r.highlightsEn.length) {
      return r.highlightsEn
    }
    return r.highlights || []
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script')
      s.src = url
      s.async = true
      s.onload = function () { resolve() }
      s.onerror = function () { reject(new Error('script load failed: ' + url)) }
      document.head.appendChild(s)
    })
  }

  function releasesCatalog() {
    return window.TALKNOW_RELEASES || window.TYPENOW_RELEASES || null
  }

  async function loadReleases() {
    var ready = releasesCatalog()
    if (ready && typeof ready === 'object') return ready
    var base = document.currentScript ? document.currentScript.src : location.href
    var candidates = [
      new URL('./releases-data.js', base).href,
      new URL('../releases.json', base).href
    ]
    for (var i = 0; i < candidates.length; i++) {
      var url = candidates[i]
      try {
        if (url.endsWith('.js')) {
          await loadScript(url)
          ready = releasesCatalog()
          if (ready && typeof ready === 'object') return ready
          continue
        }
        var res = await fetch(url)
        if (res.ok) return res.json()
      } catch (e) {
        /* try next */
      }
    }
    throw new Error('releases catalog unavailable')
  }

  function showMacSoonToast() {
    var el = document.getElementById('tnToast')
    if (!el) {
      el = document.createElement('div')
      el.id = 'tnToast'
      el.className = 'tn-toast'
      el.setAttribute('role', 'status')
      document.body.appendChild(el)
    }
    el.textContent = t('download.macSoonToast')
    el.classList.add('is-on')
    clearTimeout(showMacSoonToast._timer)
    showMacSoonToast._timer = setTimeout(function () {
      el.classList.remove('is-on')
    }, 2200)
  }

  function bindMacComingSoon() {
    document.querySelectorAll('[data-mac-soon], [data-dl-platform="mac"], [data-dl="macArm64"], [data-dl="macX64"]').forEach(function (el) {
      el.setAttribute('href', '#download')
      el.classList.add('is-soon')
      el.setAttribute('aria-disabled', 'true')
      if (el.getAttribute('data-mac-bound') === '1') return
      el.setAttribute('data-mac-bound', '1')
      el.addEventListener('click', function (e) {
        e.preventDefault()
        showMacSoonToast()
      })
    })
  }

  function bindDownloadButtons(data) {
    var latest = (data.releases && data.releases[0]) || null
    var dl = latest ? latest.downloads : null

    // data-dl (legacy: macArm64 / macX64 / winX64 / latest)
    document.querySelectorAll('[data-dl]').forEach(function (el) {
      var kind = el.getAttribute('data-dl')
      if (kind === 'macArm64' || kind === 'macX64') return
      if (kind === 'latest' || !latest) {
        el.setAttribute('href', data.latestUrl || LATEST)
        return
      }
      var file = dl && dl[kind]
      el.setAttribute('href', file ? downloadUrl(latest.version, file, data) : data.latestUrl || LATEST)
    })

    // data-dl-platform (new: mac / win) — mac is coming soon, never a dmg
    document.querySelectorAll('[data-dl-platform]').forEach(function (el) {
      var platform = el.getAttribute('data-dl-platform')
      if (platform === 'mac') return
      if (!latest) {
        el.setAttribute('href', data.latestUrl || LATEST)
        return
      }
      var file = platform === 'win' ? (dl && dl.winX64) : null
      el.setAttribute('href', file ? downloadUrl(latest.version, file, data) : data.latestUrl || LATEST)
    })

    bindMacComingSoon()

    // version display
    if (latest && latest.version) {
      document.querySelectorAll('[data-latest-version]').forEach(function (el) {
        el.textContent = 'v' + latest.version
      })
      var verEl = document.getElementById('dlVersion')
      if (verEl) verEl.textContent = 'v' + latest.version
    }
  }

  function renderChangelog(data) {
    var root = document.getElementById('changelog')
    if (!root) return
    root.innerHTML = ''
    ;(data.releases || []).forEach(function (r) {
      var art = document.createElement('article')
      art.className = 'release'
      var highlights = localizedHighlights(r)
        .map(function (h) { return '<li>' + escapeHtml(h) + '</li>' })
        .join('')
      art.innerHTML =
        '<div class="meta"><span class="ver">v' +
        escapeHtml(r.version) +
        '</span><span class="date">' +
        escapeHtml(r.date) +
        '</span><span>' +
        escapeHtml(localizedTitle(r)) +
        '</span></div><ul>' +
        highlights +
        '</ul>'
      root.appendChild(art)
    })
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  var cached = null

  function paint(data) {
    bindDownloadButtons(data)
    renderChangelog(data)
  }

  loadReleases()
    .then(function (data) {
      cached = data
      paint(data)
    })
    .catch(function (err) {
      console.error(err)
      document.querySelectorAll('[data-dl], [data-dl-platform]').forEach(function (el) {
        var kind = el.getAttribute('data-dl') || el.getAttribute('data-dl-platform')
        if (kind === 'mac' || kind === 'macArm64' || kind === 'macX64') return
        el.setAttribute('href', LATEST)
      })
      bindMacComingSoon()
    })

  bindMacComingSoon()
})()
