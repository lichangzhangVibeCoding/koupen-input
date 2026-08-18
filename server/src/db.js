import Database from 'better-sqlite3'
import { createHash, randomBytes } from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export function openDb(dataDir) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  const db = new Database(join(dataDir, 'membership.sqlite'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  seed(db)
  return db
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT '',
      frozen INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_codes (
      phone TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      monthly_credits INTEGER NOT NULL,
      price_month_cents INTEGER NOT NULL,
      price_year_cents INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL REFERENCES plans(id),
      status TEXT NOT NULL DEFAULT 'active',
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      pending_plan_id TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credit_accounts (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      balance INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credit_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason TEXT NOT NULL,
      grant_type TEXT NOT NULL DEFAULT '',
      request_id TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      source TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT '',
      external_trade_no TEXT NOT NULL DEFAULT '',
      plan_id TEXT NOT NULL DEFAULT '',
      credits INTEGER NOT NULL DEFAULT 0,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      paid_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS model_routes (
      slot TEXT PRIMARY KEY,
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model_id TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credit_prices (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS redeem_codes (
      code TEXT PRIMARY KEY,
      credits INTEGER NOT NULL,
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kb_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      body TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roadmap_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phase TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)

  // older DBs may lack pending_plan_id
  const cols = db.prepare(`PRAGMA table_info(subscriptions)`).all()
  if (!cols.some((c) => c.name === 'pending_plan_id')) {
    db.exec(`ALTER TABLE subscriptions ADD COLUMN pending_plan_id TEXT NOT NULL DEFAULT ''`)
  }
}

function nowIso() {
  return new Date().toISOString()
}

function seed(db) {
  const plans = db.prepare('SELECT COUNT(*) AS c FROM plans').get().c
  if (plans === 0) {
    const ins = db.prepare(
      `INSERT INTO plans (id, name, monthly_credits, price_month_cents, price_year_cents, sort_order, active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    )
    ins.run('trial', '体验版', 500, 0, 0, 0)
    ins.run('standard', '标准版', 4000, 9900, 66800, 10)
    ins.run('advanced', '高级版', 9000, 19900, 133800, 20)
    ins.run('flagship', '旗舰版', 50000, 99900, 671300, 30)
  }

  const prices = [
    ['voiceCreditsPerMinute', 2],
    ['replyCredits', 10],
    ['replyVisionCredits', 5],
    ['screenAskCredits', 25],
    ['screenQuizCredits', 15]
  ]
  const priceIns = db.prepare(
    `INSERT OR IGNORE INTO credit_prices (key, value, updated_at) VALUES (?, ?, ?)`
  )
  for (const [k, v] of prices) priceIns.run(k, v, nowIso())
  // Upgrade older DBs that only had replyCredits=15
  const hasVision = db
    .prepare(`SELECT value FROM credit_prices WHERE key = 'replyVisionCredits'`)
    .get()
  if (!hasVision) {
    db.prepare(
      `INSERT INTO credit_prices (key, value, updated_at) VALUES ('replyVisionCredits', 5, ?)`
    ).run(nowIso())
  }

  const baseUrl = process.env.UPSTREAM_BASE_URL || 'https://api.siliconflow.cn/v1'
  const apiKey = process.env.UPSTREAM_API_KEY || ''
  const routes = [
    ['asr', process.env.UPSTREAM_ASR_MODEL || 'FunAudioLLM/SenseVoiceSmall'],
    ['vision', process.env.UPSTREAM_VISION_MODEL || 'Qwen/Qwen3-VL-32B-Instruct'],
    ['chat', process.env.UPSTREAM_CHAT_MODEL || 'deepseek-ai/DeepSeek-V4-Flash']
  ]
  const routeIns = db.prepare(
    `INSERT OR IGNORE INTO model_routes (slot, base_url, api_key, model_id, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  )
  for (const [slot, model] of routes) {
    routeIns.run(slot, baseUrl, apiKey, model, nowIso())
  }

  const set = db.prepare(`INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`)
  set.run(
    'ops_payment_hint',
    process.env.OPS_PAYMENT_HINT ||
      '请转账至对公账户（主体就绪后更新），备注你的手机号，并联系客服开通。'
  )
  set.run('ops_support_contact', process.env.OPS_SUPPORT_CONTACT || '客服微信：待填写')

  seedInternalKb(db)
}

const AI_PROMPT_SCENES_KB_BODY = `与AI对话 = 即刻对话「按住说」：对着任意 AI 输入框，口述加成可执行提示词再贴入（不发送）。

【核心竞争力】管道只维护一次；好用靠场景包变多变准。不加第五技能、不按 App 名硬编码。

【技术路线】
按住 → 截屏+录音 → STT
  → 读屏摘要（视觉）
  → 场景路由 website | ppt | debug | brief | generic
  → 套场景包（骨架 / 允许补全 / 禁止）
  → 文字模型写提示词 → 粘贴

【首发四包】与官网四卡对齐
- website 做网站：页面模块；用户点到的功能再展开；禁写成 HTML 幻灯
- ppt 做 PPT：HTML 分页幻灯（第 N 页 + 要点）；禁止 .ppt/.pptx
- debug 修 Bug：现象/复现/期望/范围；屏幕报错原文；禁新开产品需求
- brief 写方案：目标、约束、输出格式
- generic 回落：轻度扩写，禁止套建站电商模块。Debug 与建站同时像时 debug 优先。

【黄金口试】公司官网→website；十页融资PPT→ppt（HTML 幻灯）；对着红字修这个→debug；周报结构→brief；含糊弄一下→generic

【演进】P0 四包+路由（本期）；P1 跟进句 followup；P2 继续加包，每包两条口试。

规格：docs/design-prompt-enhance.md
代码：src/shared/prompt-scenes/`

function seedInternalKb(db) {
  const kbCount = db.prepare('SELECT COUNT(*) AS c FROM kb_articles').get().c
  if (kbCount === 0) {
    const t = nowIso()
    const ins = db.prepare(
      `INSERT INTO kb_articles (slug, title, category, body, sort_order, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    ins.run(
      'product-positioning',
      '产品定位',
      '产品',
      `即刻对话 / TalkNow：本机对话助手，少打字、快回人。\n\n核心能力：\n- 即刻对话：语音转文字并贴入输入框\n- 帮我对话：截图读聊天 + 人设回复（不代发）\n- 看屏幕 / 看屏幕答题：整屏问答与考试辅助\n\n原则：本地优先、粘贴不代发、自配 Key 永久可用。`,
      10,
      t,
      t
    )
    ins.run(
      'membership-model',
      '会员与积分模型',
      '商业',
      `双轨：BYOK/本地永久免费；官方会员免配 Key，统一扣积分。\n\n默认单价（后台可改）：\n- 语音 2 分/分钟\n- 帮我对话约 15 分/次（读屏 5 + 回复 10）\n- 看屏幕 25 分/次\n- 答题每步 15 分\n\n档位：Free 100/月 · Pro 2000/¥29 · Max 10000/¥99\n加量包：1000 分 / ¥20\n\n首版线下收款 + 管理后台入账；微信/支付宝后置（公司主体就绪后）。\n上游：第三方（先硅基流动），自建仅薄代理。`,
      20,
      t,
      t
    )
    ins.run(
      'tech-stack',
      '技术与仓库要点',
      '工程',
      `客户端：Electron + React（typenow）\n会员服务：server/（Express + SQLite）\n文档：docs/design-membership.md · docs/ops-offline-membership.md\n官网：website/（公开站，不含本内部后台）\n\n启动会员服务：cd server && npm start → http://127.0.0.1:8788/admin/`,
      30,
      t,
      t
    )
    ins.run(
      'competitor-shandianshuo',
      '竞品对照：闪电说',
      '调研',
      `闪电说：沟通 Agent；短按直接说 / 长按帮我说；记忆+词典+技能；时长+Agent 积分双账本；会员免配 Key。\n\n我们取舍：统一积分（更清晰）；线下先开；不自建中转站；联系人/性格包是差异化；技能模块可后做且要做得比对方稳。`,
      40,
      t,
      t
    )
    ins.run(
      'ai-prompt-scenes',
      '与AI对话：场景包技术路线',
      '核心架构',
      AI_PROMPT_SCENES_KB_BODY,
      50,
      t,
      t
    )
  }

  const tKb = nowIso()
  db.prepare(
    `INSERT OR IGNORE INTO kb_articles (slug, title, category, body, sort_order, updated_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'ai-prompt-scenes',
    '与AI对话：场景包技术路线',
    '核心架构',
    AI_PROMPT_SCENES_KB_BODY,
    50,
    tKb,
    tKb
  )

  const rmCount = db.prepare('SELECT COUNT(*) AS c FROM roadmap_items').get().c
  if (rmCount === 0) {
    const t = nowIso()
    const ins = db.prepare(
      `INSERT INTO roadmap_items (phase, title, detail, status, sort_order, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const items = [
      ['P0', '积分单价与档位 / 成本核算草案', 'design-membership.md 已定默认单价与 Free/Pro/Max', 'done', 10],
      ['P1', '账号登录 + 管理后台（用户/套餐/线下开单）', 'server/ 已落地', 'done', 20],
      ['P2', '薄代理接硅基流动并扣积分', 'ASR + chat/vision proxy', 'done', 30],
      ['P3', '客户端会员页 + byok|membership 双路由', 'App 侧栏「会员」', 'done', 40],
      ['P4', '线下收款 SOP / 兑换码 / 客服话术', 'docs/ops-offline-membership.md', 'done', 50],
      ['P5', '微信/支付宝单次与连续订阅', '公司主体就绪后；API 已 501 预留', 'deferred', 60],
      ['P6', '官网定价页 + 会员设计文档', 'website/pricing/ + design-membership.md', 'done', 70],
      ['产品', '性格包 W2（主播维系场景）', '已落地；W3 导入/商城未做', 'done', 80],
      ['产品', '与AI对话场景包（管道+路由）', 'website/ppt/debug/brief；见 design-prompt-enhance.md', 'building', 85],
      ['产品', '技能模块（对标闪电说且做强）', '未做；触发稳定性/联系人绑定/表单优先', 'pending', 90],
      ['产品', '真实短信验证码登录', '现为 DEV_LOGIN_CODE 开发码', 'pending', 100],
      ['商业', '经营主体 + 支付商户号', '约还需一个月', 'pending', 110],
      ['工程', '内部知识库与规划看板（本后台）', 'kb_articles + roadmap_items', 'done', 5]
    ]
    for (const [phase, title, detail, status, sort] of items) {
      ins.run(phase, title, detail, status, sort, t, t)
    }
  }

  const roadTitle = '与AI对话场景包（管道+路由）'
  const hasRoad = db.prepare('SELECT COUNT(*) AS c FROM roadmap_items WHERE title = ?').get(roadTitle)
  if (hasRoad.c === 0) {
    const t = nowIso()
    db.prepare(
      `INSERT INTO roadmap_items (phase, title, detail, status, sort_order, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      '产品',
      roadTitle,
      'website/ppt/debug/brief；见 design-prompt-enhance.md',
      'building',
      85,
      t,
      t
    )
  }
}

export function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex')
}

export function newToken() {
  return randomBytes(32).toString('hex')
}

export function addMonths(iso, months) {
  const d = new Date(iso)
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

export { nowIso }
