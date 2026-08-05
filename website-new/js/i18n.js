/*
 * 即刻对话 / TalkNow — i18n
 * Default: zh-CN
 * Mechanism: getLang() / setLang() / applyI18n() / withLang() / keepLangLinks()
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'talknow.site.lang';

  /* ── zh-CN ────────────────────────────────────────────── */
  var zh = {
    /* brand & meta */
    'brand.name': '即刻对话',
    'brand.short': '即刻对话 TalkNow',
    'meta.title': '即刻对话 TalkNow — 本机对话助手 | 语音转文字 · 帮我对话 · 看屏幕',
    'meta.desc': '即刻对话是一款 Mac/Windows 本机对话助手。语音转文字、帮你回复消息邮件、看屏幕帮你查价翻译解题。数据不上云，模型你做主。',

    /* nav */
    'nav.home': '首页',
    'nav.scenarios': '场景',
    'nav.capabilities': '能力',
    'nav.trust': '信任',
    'nav.howto': '上手',
    'nav.download': '下载',
    'nav.changelog': '更新日志',
    'nav.lang': 'English',

    /* hero */
    'hero.badge': 'Mac & Windows · 本机运行 · 数据不出门',
    'hero.title': '说话就能办，看屏幕就能答',
    'hero.subtitle': '语音转文字、帮你回消息邮件、看屏幕帮你查价翻译解题——你的本机 AI 对话助手，说一声就来。',
    'hero.cta.mac': '下载 macOS 版',
    'hero.cta.win': '下载 Windows 版',
    'hero.cta.secondary': '查看场景',
    'hero.mock.label': '语音转文字 · 实时上屏',
    'hero.mock.placeholder': '对着麦克风说就行，说完自动变文字…',

    /* section: 场景导览 */
    'scenarios.eyebrow': '场景导览',
    'scenarios.title': '哪些时刻你会需要它',
    'scenarios.subtitle': '不是冷冰冰的功能列表，是你每天真会遇到的事',

    'scenarios.voice.name': '语音转文字',
    'scenarios.voice.tag': '说比打快',
    'scenarios.voice.s1.title': '微信聊天懒得打字',
    'scenarios.voice.s1.desc': '说一段话，自动变成消息发出去，比一条条敲字快太多。',
    'scenarios.voice.s2.title': '口述回邮件',
    'scenarios.voice.s2.desc': '对着麦克风说完整段，一键填进邮件正文，比手打效率高。',
    'scenarios.voice.s3.title': '边想边说写初稿',
    'scenarios.voice.s3.desc': '写方案、写稿子时嘴巴比手快，说完就是一篇初稿。',
    'scenarios.voice.s4.title': '随手记灵感',
    'scenarios.voice.s4.desc': '走路、做饭、通勤时灵感来了，张口说，自动记成文字。',

    'scenarios.chat.name': '帮我对话',
    'scenarios.chat.tag': '回不过来交给它',
    'scenarios.chat.s1.title': '工作消息秒回',
    'scenarios.chat.s1.desc': '微信、飞书、钉钉里消息回不过来，AI 先帮你拟一版，你改改就发。',
    'scenarios.chat.s2.title': '不知道咋回得体',
    'scenarios.chat.s2.desc': 'QQ 群、同学群里不好接的话，交给它起草，帮你拿捏分寸。',
    'scenarios.chat.s3.title': '交友破冰不尴尬',
    'scenarios.chat.s3.desc': 'Soul、处对象等社交软件上，帮你想话题、写破冰白，提高交友技能。',
    'scenarios.chat.s4.title': '粉丝维护不犯愁',
    'scenarios.chat.s4.desc': '记住和每个粉丝聊过的关键节点，千人千面，每条回复都像老朋友。',

    'scenarios.screen.name': '看屏幕',
    'scenarios.screen.tag': '屏幕上啥都能问',
    'scenarios.screen.s1.title': '商品比价',
    'scenarios.screen.s1.desc': '屏幕上看到某个商品，问一句「这价格咋样」，AI 帮你看一眼。',
    'scenarios.screen.s2.title': '即时翻译',
    'scenarios.screen.s2.desc': '页面上一大段英文，让 AI 当场翻译成中文，不用复制来复制去。',
    'scenarios.screen.s3.title': '论文解读',
    'scenarios.screen.s3.desc': '学术论文里高亮的段落，让 AI 展开解释一下到底啥意思。',
    'scenarios.screen.s4.title': '作业检查',
    'scenarios.screen.s4.desc': '拍下孩子的作业，让 AI 看看哪几题做错了，省心省力。',

    'scenarios.quiz.name': '看屏幕答题',
    'scenarios.quiz.tag': '看一眼就出答案',
    'scenarios.quiz.desc': '网课测验、选择判断、限时抢答——让 AI 看一眼屏幕，直接给你答案。',

    /* section: 能力详解 */
    'caps.eyebrow': '能力详解',
    'caps.title': '四个能力，一个助手',
    'caps.subtitle': '每个能力都有它最闪光的时刻',

    'caps.voice.name': '语音转文字',
    'caps.voice.when': '什么时候用',
    'caps.voice.whenText': '聊天、写邮件、写稿子、记灵感——只要打字嫌慢的时候。',
    'caps.voice.result': '结果',
    'caps.voice.resultText': '实时上屏的中文文字，标点自动加，可以直接发出去或贴进去。',
    'caps.voice.shortcut': '快捷键',
    'caps.voice.shortcutText': '按住说话键，松开即完成',

    'caps.chat.name': '帮我对话',
    'caps.chat.when': '什么时候用',
    'caps.chat.whenText': '微信/飞书/钉钉消息回不过来、QQ 群不好接话、交友软件破冰、邮件不知道咋回。',
    'caps.chat.result': '结果',
    'caps.chat.resultText': 'AI 根据上下文拟好回复，你过一眼就能发，措辞得体不费脑。',
    'caps.chat.shortcut': '快捷键',
    'caps.chat.shortcutText': '呼出助手，框选或粘贴对话上下文',

    'caps.screen.name': '看屏幕',
    'caps.screen.when': '什么时候用',
    'caps.screen.whenText': '看商品价格、翻译英文、解读论文、检查作业——屏幕上啥都能问。',
    'caps.screen.result': '结果',
    'caps.screen.resultText': 'AI 看完屏幕内容，直接用语音或文字告诉你答案，不用自己去搜。',
    'caps.screen.shortcut': '快捷键',
    'caps.screen.shortcutText': '呼出助手 → AI 看屏幕 → 提问',

    'caps.quiz.name': '看屏幕答题',
    'caps.quiz.when': '什么时候用',
    'caps.quiz.whenText': '网课测验、选择判断、限时抢答——时间紧需要快速出答案。',
    'caps.quiz.result': '结果',
    'caps.quiz.resultText': 'AI 看一眼屏幕，秒出答案，直接告诉你选哪个。',
    'caps.quiz.shortcut': '快捷键',
    'caps.quiz.shortcutText': '呼出助手 → AI 看屏幕 → 自动识别题目',

    /* section: 信任/隐私 */
    'trust.eyebrow': '信任与隐私',
    'trust.title': '你的数据，你做主',
    'trust.subtitle': '不是云端 SaaS，是装在你电脑上的本机工具',

    'trust.local.name': '数据不出门',
    'trust.local.desc': '所有处理在你本机完成，对话内容不上传任何服务器。',
    'trust.nosend.name': '不代你发送',
    'trust.nosend.desc': 'AI 只帮你写好，不会自动帮你发出去。发不发，你说了算。',
    'trust.stop.name': 'Esc 随时停',
    'trust.stop.desc': '任何时候按 Esc，AI 立刻停下来。你始终拥有控制权。',
    'trust.model.name': '模型你做主',
    'trust.model.desc': '接入你自己的 API Key，用哪个模型、花多少钱，完全由你决定。',

    /* section: 三步上手 */
    'howto.eyebrow': '三步上手',
    'howto.title': '从下载到用上，三分钟',
    'howto.subtitle': '不折腾，开箱即用',

    'howto.step1.title': '下载安装',
    'howto.step1.desc': '选 macOS 或 Windows 版本，下载后拖进应用或双击安装。',
    'howto.step2.title': '授权权限',
    'howto.step2.desc': '首次打开按提示授权麦克风和屏幕访问，就这两项，用完可以关。',
    'howto.step3.title': '配置模型',
    'howto.step3.desc': '填入你的 API Key（OpenAI / 通义千问 / DeepSeek 等），选好模型就能用了。',
    'howto.tip': '所有快捷键都可以在设置里改，默认按住对应键即可呼出。',

    /* section: 下载 */
    'download.eyebrow': '立即下载',
    'download.title': '选一个，装上就能用',
    'download.subtitle': '免费 · 支持 macOS (Apple Silicon & Intel) · Windows 10/11',
    'download.mac': 'macOS',
    'download.win': 'Windows',
    'download.version': '当前版本',
    'download.changelog': '查看更新日志',
    'download.note': '下载即同意通过 GitHub Releases 获取安装包，开源仓库可自行编译。',

    /* footer */
    'footer.tag': '即刻对话 TalkNow · www.talknow.cn',
    'footer.rights': '保留所有权利',
    'footer.github': 'GitHub',
    'footer.changelog': '更新日志',
    'footer.domain': 'www.talknow.cn',

    /* changelog */
    'changelog.title': '更新日志',
    'changelog.back': '返回首页'
  };

  /* ── en ──────────────────────────────────────────────── */
  var en = {
    'brand.name': 'TalkNow',
    'brand.short': 'TalkNow · 即刻对话',
    'meta.title': 'TalkNow — On-Device AI Assistant | Voice Input · Reply Helper · Screen Reader',
    'meta.desc': 'TalkNow is a Mac/Windows on-device AI assistant. Voice-to-text, reply drafting for messages and email, screen reading for price checks, translation, and homework help. Your data stays on your machine.',

    'nav.home': 'Home',
    'nav.scenarios': 'Scenarios',
    'nav.capabilities': 'Features',
    'nav.trust': 'Privacy',
    'nav.howto': 'Get Started',
    'nav.download': 'Download',
    'nav.changelog': 'Changelog',
    'nav.lang': '中文',

    'hero.badge': 'Mac & Windows · On-Device · Your Data Stays Put',
    'hero.title': 'Speak to act, glance to answer',
    'hero.subtitle': 'Voice-to-text, reply drafting for messages and email, screen reading for prices, translation, and homework — your on-device AI assistant, one word away.',
    'hero.cta.mac': 'Download for macOS',
    'hero.cta.win': 'Download for Windows',
    'hero.cta.secondary': 'See Scenarios',
    'hero.mock.label': 'Voice Input · Live on screen',
    'hero.mock.placeholder': 'Just talk into the mic — your words appear as text…',

    'scenarios.eyebrow': 'Scenarios',
    'scenarios.title': 'When you will need it',
    'scenarios.subtitle': 'Not a cold feature list — these are things you run into every day',

    'scenarios.voice.name': 'Voice Input',
    'scenarios.voice.tag': 'Faster than typing',
    'scenarios.voice.s1.title': 'WeChat without typing',
    'scenarios.voice.s1.desc': 'Say a full sentence and it becomes a message — way faster than pecking at keys.',
    'scenarios.voice.s2.title': 'Dictate email replies',
    'scenarios.voice.s2.desc': 'Speak a whole paragraph into the mic, paste it into your email, done.',
    'scenarios.voice.s3.title': 'Talk out your first draft',
    'scenarios.voice.s3.desc': 'When writing a proposal, your mouth is faster than your hands. Speak it, get a draft.',
    'scenarios.voice.s4.title': 'Capture ideas on the go',
    'scenarios.voice.s4.desc': 'Walking, cooking, commuting — talk and it auto-transcribes your ideas to text.',

    'scenarios.chat.name': 'Reply Helper',
    'scenarios.chat.tag': 'Let it draft for you',
    'scenarios.chat.s1.title': 'Instant work replies',
    'scenarios.chat.s1.desc': 'WeChat, Feishu, DingTalk messages piling up? AI drafts a reply — you tweak and send.',
    'scenarios.chat.s2.title': 'When you are stuck for words',
    'scenarios.chat.s2.desc': 'QQ groups, class chats — tricky messages you do not know how to answer? Let it draft.',
    'scenarios.chat.s3.title': 'Break the ice',
    'scenarios.chat.s3.desc': 'Soul, dating apps — AI helps you come up with topics and openers that actually work.',
    'scenarios.chat.s4.title': 'Fan management without dread',
    'scenarios.chat.s4.desc': 'Remembers key moments with every fan — truly personalized, every reply feels like an old friend.',

    'scenarios.screen.name': 'Screen Reader',
    'scenarios.screen.tag': 'Ask anything on screen',
    'scenarios.screen.s1.title': 'Price check',
    'scenarios.screen.s1.desc': 'See a product on screen? Ask "is this a good price?" and AI takes a look.',
    'scenarios.screen.s2.title': 'Instant translation',
    'scenarios.screen.s2.desc': 'A wall of English on a page? AI translates it on the spot — no copy-pasting.',
    'scenarios.screen.s3.title': 'Paper explainer',
    'scenarios.screen.s3.desc': 'Highlight a paragraph in a paper? AI expands and explains what it means.',
    'scenarios.screen.s4.title': 'Homework check',
    'scenarios.screen.s4.desc': 'Snap your kid\'s homework — AI checks which answers are wrong. Effortless.',

    'scenarios.quiz.name': 'Quiz Solver',
    'scenarios.quiz.tag': 'Look and answer',
    'scenarios.quiz.desc': 'Online quizzes, multiple choice, timed tests — let AI look at the screen and give you the answer.',

    'caps.eyebrow': 'Features',
    'caps.title': 'Four abilities, one assistant',
    'caps.subtitle': 'Each one shines in its own moment',

    'caps.voice.name': 'Voice Input',
    'caps.voice.when': 'When to use',
    'caps.voice.whenText': 'Chatting, writing emails, drafting documents, capturing ideas — whenever typing is too slow.',
    'caps.voice.result': 'Result',
    'caps.voice.resultText': 'Real-time Chinese text on screen with auto-punctuation. Send or paste it directly.',
    'caps.voice.shortcut': 'Shortcut',
    'caps.voice.shortcutText': 'Hold to talk, release to finish',

    'caps.chat.name': 'Reply Helper',
    'caps.chat.when': 'When to use',
    'caps.chat.whenText': 'WeChat/Feishu/DingTalk message overload, awkward group chats, dating app icebreakers, email replies you dread.',
    'caps.chat.result': 'Result',
    'caps.chat.resultText': 'AI drafts a context-aware reply. Review and send — well-worded, zero brainpower.',
    'caps.chat.shortcut': 'Shortcut',
    'caps.chat.shortcutText': 'Invoke assistant, select or paste the conversation',

    'caps.screen.name': 'Screen Reader',
    'caps.screen.when': 'When to use',
    'caps.screen.whenText': 'Price checks, translation, paper reading, homework checking — anything on screen.',
    'caps.screen.result': 'Result',
    'caps.screen.resultText': 'AI reads the screen and tells you the answer by voice or text. No searching needed.',
    'caps.screen.shortcut': 'Shortcut',
    'caps.screen.shortcutText': 'Invoke assistant → AI reads screen → ask',

    'caps.quiz.name': 'Quiz Solver',
    'caps.quiz.when': 'When to use',
    'caps.quiz.whenText': 'Online quizzes, multiple choice, timed tests — when you need answers fast.',
    'caps.quiz.result': 'Result',
    'caps.quiz.resultText': 'AI looks at the screen and gives you the answer in seconds — tells you which option to pick.',
    'caps.quiz.shortcut': 'Shortcut',
    'caps.quiz.shortcutText': 'Invoke assistant → AI reads screen → auto-recognize question',

    'trust.eyebrow': 'Trust & Privacy',
    'trust.title': 'Your data, your rules',
    'trust.subtitle': 'Not a cloud SaaS — a tool that lives on your machine',

    'trust.local.name': 'Data stays local',
    'trust.local.desc': 'All processing happens on your machine. Conversations are never uploaded.',
    'trust.nosend.name': 'Never auto-sends',
    'trust.nosend.desc': 'AI only writes for you — it never sends anything on its own. You decide.',
    'trust.stop.name': 'Esc to stop',
    'trust.stop.desc': 'Press Esc at any time and AI stops immediately. You are always in control.',
    'trust.model.name': 'You pick the model',
    'trust.model.desc': 'Bring your own API key. Which model, how much you spend — entirely up to you.',

    'howto.eyebrow': 'Get Started',
    'howto.title': 'From download to running in 3 minutes',
    'howto.subtitle': 'No fuss, works out of the box',

    'howto.step1.title': 'Download & install',
    'howto.step1.desc': 'Pick macOS or Windows, download and drag to install.',
    'howto.step2.title': 'Grant permissions',
    'howto.step2.desc': 'On first launch, allow microphone and screen access. Just two things — revocable anytime.',
    'howto.step3.title': 'Configure model',
    'howto.step3.desc': 'Enter your API key (OpenAI / Qwen / DeepSeek, etc.), pick a model, and you are set.',
    'howto.tip': 'All shortcuts are customizable in settings. Default: hold the key to invoke.',

    'download.eyebrow': 'Download',
    'download.title': 'Pick one, install and go',
    'download.subtitle': 'Free · macOS (Apple Silicon & Intel) · Windows 10/11',
    'download.mac': 'macOS',
    'download.win': 'Windows',
    'download.version': 'Current version',
    'download.changelog': 'View changelog',
    'download.note': 'Downloads are served via GitHub Releases. The repo is open source — build it yourself anytime.',

    'footer.tag': 'TalkNow · On-Device AI Assistant',
    'footer.rights': 'All rights reserved',
    'footer.github': 'GitHub',
    'footer.changelog': 'Changelog',
    'footer.domain': 'www.talknow.cn',

    'changelog.title': 'Changelog',
    'changelog.back': 'Back to home'
  };

  /* ── engine ──────────────────────────────────────────── */
  var dicts = { zh: zh, en: en };

  function getLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'zh' || saved === 'en') return saved;
    } catch (e) {}
    var params = new URLSearchParams(window.location.search);
    var q = params.get('lang');
    if (q === 'zh' || q === 'en') return q;
    return 'zh';
  }

  function setLang(lang) {
    if (lang !== 'zh' && lang !== 'en') lang = 'zh';
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  function t(key) {
    var lang = getLang();
    var d = dicts[lang] || zh;
    return d[key] !== undefined ? d[key] : (zh[key] !== undefined ? zh[key] : key);
  }

  function applyI18n(root) {
    root = root || document;
    var els = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-i18n');
      var val = t(key);
      if (el.hasAttribute('data-i18n-attr')) {
        var attr = el.getAttribute('data-i18n-attr');
        el.setAttribute(attr, val);
      } else if (el.tagName === 'TITLE') {
        el.textContent = val;
      } else if (el.tagName === 'META') {
        el.setAttribute('content', val);
      } else {
        el.textContent = val;
      }
    }
    document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en';
  }

  function keepLangLinks() {
    var links = document.querySelectorAll('a[data-keep-lang]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (!href) continue;
      var sep = href.indexOf('?') >= 0 ? '&' : '?';
      var base = href.split('?')[0];
      links[i].href = base + sep + 'lang=' + getLang();
    }
  }

  function withLang(url) {
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return url + sep + 'lang=' + getLang();
  }

  function toggleLang() {
    setLang(getLang() === 'zh' ? 'en' : 'zh');
    applyI18n();
    keepLangLinks();
  }

  // auto-apply on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      applyI18n();
      keepLangLinks();
      var btn = document.querySelector('[data-lang-toggle]');
      if (btn) btn.addEventListener('click', function (e) { e.preventDefault(); toggleLang(); });
    });
  } else {
    applyI18n();
    keepLangLinks();
    var btn2 = document.querySelector('[data-lang-toggle]');
    if (btn2) btn2.addEventListener('click', function (e) { e.preventDefault(); toggleLang(); });
  }

  // export
  window.TalkNowI18n = {
    getLang: getLang,
    setLang: setLang,
    t: t,
    applyI18n: applyI18n,
    keepLangLinks: keepLangLinks,
    withLang: withLang,
    toggleLang: toggleLang
  };
})();
