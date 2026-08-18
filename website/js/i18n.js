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
    'nav.subscribe': '订阅',
    'nav.help': '帮助',
    'nav.scenarios': '场景',
    'nav.capabilities': '能力',
    'nav.trust': '信任',
    'nav.howto': '上手',
    'nav.download': '下载',
    'nav.pricing': '订阅',
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

    'scenarios.ai.name': '与AI对话',
    'scenarios.ai.tag': '按住增强提示词',
    'scenarios.ai.s1.title': '做网站增强',
    'scenarios.ai.s1.desc': '对着 Cursor / 代码窗按住说需求，松手后按屏幕整理成可执行的开发提示词。',
    'scenarios.ai.s2.title': '做 PPT 增强',
    'scenarios.ai.s2.desc': '口述大纲与重点，增强成「按页结构生成幻灯片」的清晰指令。',
    'scenarios.ai.s3.title': '写代码 / 修 Bug',
    'scenarios.ai.s3.desc': '口语报错、改哪、期望结果，整理成 AI 能直接动手的调试提示。',
    'scenarios.ai.s4.title': '写方案 / 问 ChatGPT',
    'scenarios.ai.s4.desc': '散乱想法按住说完，改写成带目标、约束、输出格式的完整 brief。',

    'scenarios.chat.name': '帮我对话',
    'scenarios.chat.tag': '回不过来交给它',
    'scenarios.chat.s1.title': '工作消息秒回',
    'scenarios.chat.s1.desc': '微信、飞书、钉钉里消息回不过来，AI 先帮你拟一版，你改改就发。',
    'scenarios.chat.s2.title': '不知道咋回得体',
    'scenarios.chat.s2.desc': 'QQ 群、同学群里不好接的话，交给它起草，帮你拿捏分寸。',
    'scenarios.chat.s3.title': '交友破冰不尴尬',
    'scenarios.chat.s3.desc': 'Soul、处对象等社交软件上，帮你想话题、写破冰白，提高交友技能。',
    'scenarios.chat.s4.title': '邮件回复不犯愁',
    'scenarios.chat.s4.desc': '收到邮件不知道怎么回，它看完上下文直接帮你写好回信。',

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
    'caps.voice.whenText': '聊天、写邮件、写稿子、对 AI 说提示词——只要打字嫌慢的时候。',
    'caps.voice.result': '结果',
    'caps.voice.resultText': '点按贴原话；按住则按当前屏幕改写成提示词再贴入。都不会自动发送。',
    'caps.voice.shortcut': '快捷键',
    'caps.voice.shortcutText': 'Mac 点按/按住右 Command（可改）；Windows 为 Alt。点按贴原话，按住增强。',

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
    'howto.tip': '即刻对话：点按贴原话，按住超过约 0.4 秒松手后按屏幕增强提示词。快捷键可在设置里改。',

    /* section: 下载 */
    'download.eyebrow': '立即下载',
    'download.title': '选一个，装上就能用',
    'download.subtitle': '免费 · 支持 macOS (Apple Silicon & Intel) · Windows 10/11',
    'download.mac': 'macOS',
    'download.win': 'Windows',
    'download.version': '当前版本',
    'download.changelog': '查看更新日志',
    'download.note': '安装包由本站提供直链下载；亦可自行从开源仓库编译。',

    'pricing.badge': '自配 Key 永久免费 · 官方模式统一积分',
    'pricing.title': '订阅与套餐',
    'pricing.subtitle': '与 App「个人中心」同一套档位。开通请在客户端联系客服线下办理。',
    'pricing.note': '购买方式：下载 App → 个人中心登录 → 按付款说明转账并联系客服开通。',

    'subscribe.badge': '自配 Key 永久免费 · 官方模式统一积分',
    'subscribe.title': '订阅与套餐',
    'subscribe.subtitle': '与 App「个人中心」同一套档位。价格与积分以后台为准；付费档可用 Stripe 测试结算，也可线下联系客服。',
    'subscribe.billingMonth': '月付',
    'subscribe.billingYear': '年付更省',
    'subscribe.loading': '正在同步套餐…',
    'subscribe.live': '已与服务器套餐同步',
    'subscribe.fallback': '暂未能连上服务器，展示与产品一致的默认档位',
    'subscribe.ratesTitle': '积分怎么扣',
    'subscribe.rate.voice': '即刻对话（官方语音）：约 {n} 积分 / 分钟',
    'subscribe.rate.reply': '帮我对话：约 {n} 积分 / 次（读屏 + 回复）',
    'subscribe.rate.screen': '看屏幕：约 {n} 积分 / 次',
    'subscribe.rate.topup': '加量包：{credits} 积分 / ¥{yuan}',
    'subscribe.rate.voiceLabel': '即刻对话 · 官方语音',
    'subscribe.rate.replyLabel': '帮我对话',
    'subscribe.rate.screenLabel': '看屏幕',
    'subscribe.rate.topupLabel': '加量包',
    'subscribe.rate.nPerMin': '约 {n} 积分 / 分钟',
    'subscribe.rate.nPerRun': '约 {n} 积分 / 次',
    'subscribe.rate.topupValue': '{credits} 积分 / ¥{yuan}',
    'subscribe.note': '本页登录后可用 Stripe 支付开通；也可下载 App 在个人中心结算。自配 Key / 本地模型不消耗本产品积分。',
    'subscribe.cta': '下载 App',
    'subscribe.payStripe': 'Stripe 支付',
    'subscribe.loginToPay': '登录后支付',
    'subscribe.phone': '手机号',
    'subscribe.code': '验证码',
    'subscribe.sendCode': '获取验证码',
    'subscribe.doLogin': '登录',
    'subscribe.logout': '退出',
    'subscribe.loggedIn': '已登录 {phone}',
    'subscribe.needLogin': '请先用 App 同一手机号登录再支付',
    'subscribe.opening': '正在打开 Stripe…',
    'subscribe.successTitle': '支付已提交',
    'subscribe.successBody': '若已完成付款，积分与套餐会在几秒内到账。请打开 App 个人中心刷新查看。',
    'subscribe.backPlans': '返回套餐',

    'plan.popular': '推荐',
    'plan.price.free': '限时免费',
    'plan.price.perMonth': '/月',
    'plan.price.perYear': '/年',
    'plan.price.yearHint': '约 ¥{n}/月',
    'plan.price.yearSaveHint': '年付可省 ¥{n}',
    'plan.creditsUnit': '积分 / 月',
    'plan.blurb.trial': '轻量开启官方能力体验',
    'plan.blurb.standard': '日常语音与帮我对话',
    'plan.blurb.advanced': '高频看屏幕更划算',
    'plan.blurb.flagship': '重度使用与优先支持',
    'plan.feat.baseCredits': '每月 {n} 基础积分',
    'plan.feat.baseGift': '每月 {base} 基础 + {gift} 赠送',
    'plan.feat.officialSlots': '官方优化模型：语音 / 视觉 / 回复',
    'plan.feat.byok': '自配 Key：不消耗积分、自费模型',
    'plan.feat.local': '本地模型：数据不出机、本地不费钱',
    'plan.feat.nocode': '适合日常语音与帮我对话',
    'plan.feat.heavy': '适合高频看屏幕与重度使用',
    'plan.feat.light': '适合轻量试用',
    'plan.feat.priority': '优先支持与容量保障',

    'help.title': '帮助',
    'help.subtitle': '即刻对话怎么用、安装权限、会员与常见问题',
    'help.meta.title': '帮助 · 即刻对话 TalkNow',
    'help.meta.desc': '即刻对话帮助：点按贴原话、按住增强提示词、安装权限、官方会员与常见问题。',
    'help.guide.title': '即刻对话怎么用',
    'help.guide.lead': '同一颗键，两种手势：点按贴原话，按住按屏幕增强成提示词。都不会自动发送。',
    'help.guide.keysMac': 'Mac 默认右 Command（可在设置改成右 Option / Fn）',
    'help.guide.keysWin': 'Windows 为 Alt',
    'help.guide.tapTitle': '点按：贴原话',
    'help.guide.tapLead': '微信、备忘录、浏览器——只要嫌打字慢。',
    'help.guide.tap1': '光标放进输入框',
    'help.guide.tap2': '点一下触发键，开始录音',
    'help.guide.tap3': '说完再点一下结束',
    'help.guide.tap4': '原话贴进去，你自己决定发不发',
    'help.guide.holdTitle': '按住：增强提示词',
    'help.guide.holdLead': '对着 ChatGPT、Cursor 等 AI 输入框说话，它会扩写成一份能执行的任务说明；屏幕上有报错或代码时会写进去。',
    'help.guide.hold1': '光标放进那个输入框，屏幕上留着相关内容',
    'help.guide.hold2': '按住触发键超过约 0.4 秒，底部出现增强提示',
    'help.guide.hold3': '说话，说完松手',
    'help.guide.hold4': '改写后的提示词贴进去，看过再回车',
    'help.guide.notesTitle': '注意',
    'help.guide.note1': 'Mac 备用键右 Command+8、Windows 的 Win+8 只有点按贴原话，按住不会增强。',
    'help.guide.note2': '已经在点按录音中，再按只结束并贴原话，不会改成增强。',
    'help.guide.note3': '看屏幕正在听你说话时，点按仍是结束提问，不会开增强。',
    'help.guide.note4': '按住时又按了别的键（例如复制），这次增强会取消。',
    'help.guide.note5': '随时按 Esc 立刻停下。帮我对话是快速双击，看屏幕是另一套组合键。',
    'help.faqTitle': '常见问题',
    'help.q1': '如何下载安装？',
    'help.a1': '打开官网首页下载区，选择 macOS 或 Windows 安装包。安装包由本站直链提供。',
    'help.q2': 'Mac 需要哪些权限？',
    'help.a2': '麦克风（语音）、屏幕录制（按住增强 / 帮我对话 / 看屏幕）、辅助功能（全局快捷键与填字）。授权后若快捷键无效，请完全退出再打开 App。',
    'help.q7': '点按和按住有什么区别？',
    'help.a7': '点按贴你说的原话；按住超过约 0.4 秒会看一眼整屏，把口述扩写成给 AI 的任务说明再贴入。两种都不会自动发送。详见本页上方说明书。',
    'help.q3': '官方会员和自配 Key 有什么区别？',
    'help.a3': '官方会员免填第三方 Key，按次扣统一积分；自配 Key / 本地模型不消耗本产品积分，费用按你的服务商账单。',
    'help.q4': '如何开通或更换套餐？',
    'help.a4': '下载 App 或打开「订阅」页，登录后用 Stripe 支付开通；也可联系客服线下办理。套餐与个人中心一致。',
    'help.q5': '积分不够怎么办？',
    'help.a5': '可购买加量包，或升级更高档位；也可临时改用自配 Key / 本地模型继续使用。',
    'help.q6': '找不到更新日志？',
    'help.a6': '页脚有「更新日志」入口；也可在 App 内「更新」页查看。',

    /* footer */
    'footer.tag': '即刻对话 TalkNow · www.talknow.cn',
    'footer.rights': '保留所有权利',
    'footer.github': 'GitHub',
    'footer.changelog': '更新日志',
    'footer.subscribe': '订阅',
    'footer.help': '帮助',
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
    'nav.subscribe': 'Subscribe',
    'nav.help': 'Help',
    'nav.scenarios': 'Scenarios',
    'nav.capabilities': 'Features',
    'nav.trust': 'Privacy',
    'nav.howto': 'Get Started',
    'nav.download': 'Download',
    'nav.pricing': 'Subscribe',
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

    'scenarios.ai.name': 'Talk to AI',
    'scenarios.ai.tag': 'Hold to enhance prompts',
    'scenarios.ai.s1.title': 'Build a website faster',
    'scenarios.ai.s1.desc': 'Hold and speak your request into Cursor or a code window — it turns spoken words into an executable build prompt from the screen.',
    'scenarios.ai.s2.title': 'Make a better PPT brief',
    'scenarios.ai.s2.desc': 'Dictate the outline and key points; it becomes a clear “generate slides page by page” instruction.',
    'scenarios.ai.s3.title': 'Write code / fix a bug',
    'scenarios.ai.s3.desc': 'Say the error, what to change, and the expected result — rewritten as a debug prompt the AI can act on.',
    'scenarios.ai.s4.title': 'Brief ChatGPT for a proposal',
    'scenarios.ai.s4.desc': 'Hold and dump messy ideas; they become a brief with goal, constraints, and output format.',

    'scenarios.chat.name': 'Reply Helper',
    'scenarios.chat.tag': 'Let it draft for you',
    'scenarios.chat.s1.title': 'Instant work replies',
    'scenarios.chat.s1.desc': 'WeChat, Feishu, DingTalk messages piling up? AI drafts a reply — you tweak and send.',
    'scenarios.chat.s2.title': 'When you are stuck for words',
    'scenarios.chat.s2.desc': 'QQ groups, class chats — tricky messages you do not know how to answer? Let it draft.',
    'scenarios.chat.s3.title': 'Break the ice',
    'scenarios.chat.s3.desc': 'Soul, dating apps — AI helps you come up with topics and openers that actually work.',
    'scenarios.chat.s4.title': 'Email replies without dread',
    'scenarios.chat.s4.desc': 'Got an email you don\'t know how to answer? It reads the context and writes the reply.',

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
    'caps.voice.whenText': 'Chatting, writing emails, drafting documents, talking to an AI — whenever typing is too slow.',
    'caps.voice.result': 'Result',
    'caps.voice.resultText': 'Tap to paste verbatim. Hold to rewrite it into a prompt from the screen. Neither auto-sends.',
    'caps.voice.shortcut': 'Shortcut',
    'caps.voice.shortcutText': 'Mac: tap or hold right Command (changeable). Windows: Alt. Tap = verbatim, hold = enhance.',

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
    'howto.tip': 'TalkNow: tap to paste verbatim; hold about 0.4s and release to enhance a prompt from the screen. Shortcuts are customizable.',

    'download.eyebrow': 'Download',
    'download.title': 'Pick one, install and go',
    'download.subtitle': 'Free · macOS (Apple Silicon & Intel) · Windows 10/11',
    'download.mac': 'macOS',
    'download.win': 'Windows',
    'download.version': 'Current version',
    'download.changelog': 'View changelog',
    'download.note': 'Installers are hosted under this site’s downloads folder. The repo is open source — build it yourself anytime.',

    'pricing.badge': 'BYOK forever free · Official mode uses unified credits',
    'pricing.title': 'Subscribe & plans',
    'pricing.subtitle': 'Same tiers as in-app Account. Activate offline via support until online payment is ready.',
    'pricing.note': 'How to buy: install the app → Account → transfer per instructions and message support.',

    'subscribe.badge': 'BYOK forever free · Official mode uses unified credits',
    'subscribe.title': 'Subscribe & plans',
    'subscribe.subtitle': 'Same tiers as in-app Account. Pay with Stripe Checkout (test) or activate offline via support.',
    'subscribe.billingMonth': 'Monthly',
    'subscribe.billingYear': 'Yearly (save more)',
    'subscribe.loading': 'Syncing plans…',
    'subscribe.live': 'Synced with server plans',
    'subscribe.fallback': 'Could not reach server — showing product-default tiers',
    'subscribe.ratesTitle': 'How credits are spent',
    'subscribe.rate.voice': 'Voice (official ASR): ~{n} credits / minute',
    'subscribe.rate.reply': 'Reply assist: ~{n} credits / run',
    'subscribe.rate.screen': 'Screen ask: ~{n} credits / run',
    'subscribe.rate.topup': 'Top-up pack: {credits} credits / ¥{yuan}',
    'subscribe.rate.voiceLabel': 'Voice · official ASR',
    'subscribe.rate.replyLabel': 'Reply assist',
    'subscribe.rate.screenLabel': 'Screen ask',
    'subscribe.rate.topupLabel': 'Top-up pack',
    'subscribe.rate.nPerMin': '~{n} credits / min',
    'subscribe.rate.nPerRun': '~{n} credits / run',
    'subscribe.rate.topupValue': '{credits} credits / ¥{yuan}',
    'subscribe.note': 'Sign in on this page to pay with Stripe, or buy in the app. BYOK / local models do not spend app credits.',
    'subscribe.cta': 'Download the app',
    'subscribe.payStripe': 'Pay with Stripe',
    'subscribe.loginToPay': 'Sign in to pay',
    'subscribe.phone': 'Phone',
    'subscribe.code': 'Code',
    'subscribe.sendCode': 'Send code',
    'subscribe.doLogin': 'Sign in',
    'subscribe.logout': 'Sign out',
    'subscribe.loggedIn': 'Signed in as {phone}',
    'subscribe.needLogin': 'Sign in with the same phone as the app before paying',
    'subscribe.opening': 'Opening Stripe…',
    'subscribe.successTitle': 'Payment submitted',
    'subscribe.successBody': 'If payment succeeded, credits and plan update in a few seconds. Open the app Account page and refresh.',
    'subscribe.backPlans': 'Back to plans',

    'plan.popular': 'Popular',
    'plan.price.free': 'Limited free',
    'plan.price.perMonth': '/mo',
    'plan.price.perYear': '/yr',
    'plan.price.yearHint': '~¥{n}/mo',
    'plan.price.yearSaveHint': 'Save ¥{n} yearly',
    'plan.creditsUnit': 'credits / mo',
    'plan.blurb.trial': 'Light official-cloud trial',
    'plan.blurb.standard': 'Daily voice & reply assist',
    'plan.blurb.advanced': 'Best for frequent screen ask',
    'plan.blurb.flagship': 'Heavy use & priority support',
    'plan.feat.baseCredits': '{n} base credits / month',
    'plan.feat.baseGift': '{base} base + {gift} bonus / month',
    'plan.feat.officialSlots': 'Official models: voice / vision / reply',
    'plan.feat.byok': 'BYOK: no app credits, pay your provider',
    'plan.feat.local': 'Local: on-device, free locally',
    'plan.feat.nocode': 'Daily voice & reply assist',
    'plan.feat.heavy': 'Heavy screen-ask usage',
    'plan.feat.light': 'Light trial use',
    'plan.feat.priority': 'Priority support & capacity',

    'help.title': 'Help',
    'help.subtitle': 'How to use TalkNow, install, permissions, membership, FAQ',
    'help.meta.title': 'Help · TalkNow',
    'help.meta.desc': 'TalkNow help: tap to paste verbatim, hold to enhance a prompt, install, permissions, membership, FAQ.',
    'help.guide.title': 'How to use TalkNow voice',
    'help.guide.lead': 'One key, two gestures: tap to paste verbatim, hold to enhance a prompt from the screen. Neither auto-sends.',
    'help.guide.keysMac': 'Mac default: right Command (changeable to right Option / Fn in Settings)',
    'help.guide.keysWin': 'Windows: Alt',
    'help.guide.tapTitle': 'Tap: paste verbatim',
    'help.guide.tapLead': 'WeChat, notes, the browser — anywhere typing is slow.',
    'help.guide.tap1': 'Put the cursor in an input field',
    'help.guide.tap2': 'Tap the trigger key to start recording',
    'help.guide.tap3': 'Tap again when you are done',
    'help.guide.tap4': 'Your words are pasted — you decide whether to send',
    'help.guide.holdTitle': 'Hold: enhance the prompt',
    'help.guide.holdLead': 'Speak into ChatGPT, Cursor, or similar. It expands what you said into a task brief; errors or code on screen get included.',
    'help.guide.hold1': 'Focus that input and keep related content on screen',
    'help.guide.hold2': 'Hold the trigger over about 0.4s until the enhance hint appears',
    'help.guide.hold3': 'Speak, then release',
    'help.guide.hold4': 'The rewritten prompt is pasted — review, then press Enter yourself',
    'help.guide.notesTitle': 'Notes',
    'help.guide.note1': 'Hardware backups right Command+8 (Mac) and Win+8 (Windows) are tap-only — they never enhance.',
    'help.guide.note2': 'If a tap-to-talk recording is already running, the next press only stops it and pastes verbatim.',
    'help.guide.note3': 'If Screen Ask is listening, a tap still ends the question — it will not start enhance.',
    'help.guide.note4': 'Pressing another key while holding (for example Copy) cancels this enhance.',
    'help.guide.note5': 'Press Esc to stop immediately. Reply Assist is a double-tap; Screen Ask uses a different chord.',
    'help.faqTitle': 'FAQ',
    'help.q1': 'How do I install?',
    'help.a1': 'Use the download section on the home page for macOS or Windows. Packages are hosted on this site.',
    'help.q2': 'What permissions does Mac need?',
    'help.a2': 'Microphone (voice), Screen Recording (hold-to-enhance / reply / screen ask), Accessibility (global hotkeys & paste). If hotkeys fail after granting, fully quit and reopen the app.',
    'help.q7': 'Tap vs hold?',
    'help.a7': 'Tap pastes what you said. Hold over about 0.4s looks at the screen and expands it into a task brief for the AI. Neither auto-sends. See the guide above.',
    'help.q3': 'Official membership vs BYOK?',
    'help.a3': 'Official mode needs no third-party key and spends unified credits. BYOK / local models do not spend app credits.',
    'help.q4': 'How do I subscribe or change plans?',
    'help.a4': 'Sign in on Subscribe or in the app Account page, then pay with Stripe. Offline support is still available. Same tiers everywhere.',
    'help.q5': 'Out of credits?',
    'help.a5': 'Buy a top-up pack, upgrade, or temporarily switch to BYOK / local models.',
    'help.q6': 'Where is the changelog?',
    'help.a6': 'Footer link “Changelog”, or the Updates page inside the app.',

    'footer.tag': 'TalkNow · On-Device AI Assistant',
    'footer.rights': 'All rights reserved',
    'footer.github': 'GitHub',
    'footer.changelog': 'Changelog',
    'footer.subscribe': 'Subscribe',
    'footer.help': 'Help',
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

  function t(key, vars) {
    var lang = getLang();
    var d = dicts[lang] || zh;
    var val = d[key] !== undefined ? d[key] : (zh[key] !== undefined ? zh[key] : key);
    if (vars && typeof val === 'string') {
      Object.keys(vars).forEach(function (k) {
        val = val.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return val;
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

  function withLangQuery(url) {
    if (!url) return url;
    var hash = '';
    var hashIdx = url.indexOf('#');
    if (hashIdx >= 0) {
      hash = url.slice(hashIdx);
      url = url.slice(0, hashIdx);
    }
    // Always rebuild as ?lang=… — never append &lang without a leading ?
    // (assigning a.href absolutizes; a second pass used to produce /path/&lang=zh → IIS 404)
    var base = url.split('?')[0];
    return base + '?lang=' + getLang() + hash;
  }

  function keepLangLinks() {
    var links = document.querySelectorAll('a[data-keep-lang]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (!href || href.charAt(0) === '#') continue;
      links[i].setAttribute('href', withLangQuery(href));
    }
  }

  function withLang(url) {
    return withLangQuery(url);
  }

  function toggleLang() {
    setLang(getLang() === 'zh' ? 'en' : 'zh');
    applyI18n();
    keepLangLinks();
    try {
      document.dispatchEvent(new CustomEvent('talknow:lang'));
    } catch (e) {}
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
    get lang() { return getLang(); },
    getLang: getLang,
    setLang: setLang,
    t: t,
    applyI18n: applyI18n,
    keepLangLinks: keepLangLinks,
    withLang: withLang,
    toggleLang: toggleLang
  };
})();
