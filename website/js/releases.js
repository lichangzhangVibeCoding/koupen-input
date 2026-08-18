;(function () {
  var REPO = 'https://github.com/lichangzhangVibeCoding/koupen-input'
  var LATEST = REPO + '/releases/latest'
  /** Filenames served from site ./dl/ (virtual host). Others → GitHub Releases.
   *  Host WAF: /downloads/ path 404; .dmg blocked; .exe/.zip OK. */
  var SITE_HOSTED = {
    'TalkNow-0.5.10-x64.exe': true,
    'TalkNow-0.5.9-x64.exe': true,
    'TalkNow-0.5.8-x64.exe': true
  }
  var SITE_DL_DIR = 'dl/'

  function downloadUrl(version, filename) {
    if (!filename) return LATEST
    if (SITE_HOSTED[filename]) {
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

  function bindDownloadButtons(data) {
    var latest = (data.releases && data.releases[0]) || null
    var dl = latest ? latest.downloads : null

    // data-dl (legacy: macArm64 / macX64 / winX64 / latest)
    document.querySelectorAll('[data-dl]').forEach(function (el) {
      var kind = el.getAttribute('data-dl')
      if (kind === 'latest' || !latest) {
        el.setAttribute('href', data.latestUrl || LATEST)
        return
      }
      var file = dl && dl[kind]
      el.setAttribute('href', file ? downloadUrl(latest.version, file) : data.latestUrl || LATEST)
    })

    // data-dl-platform (new: mac / win)
    document.querySelectorAll('[data-dl-platform]').forEach(function (el) {
      var platform = el.getAttribute('data-dl-platform')
      if (!latest) {
        el.setAttribute('href', data.latestUrl || LATEST)
        return
      }
      var file
      if (platform === 'mac') {
        // Default to Apple Silicon (arm64); fall back to x64
        file = (dl && dl.macArm64) || (dl && dl.macX64)
      } else if (platform === 'win') {
        file = dl && dl.winX64
      }
      el.setAttribute('href', file ? downloadUrl(latest.version, file) : data.latestUrl || LATEST)
    })

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
        el.setAttribute('href', LATEST)
      })
    })
})()
