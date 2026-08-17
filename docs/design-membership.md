# 即刻对话 · 官方会员与积分（设计）

> 状态：**线下收款 + Stripe Checkout 测试结算 + 管理后台 + 薄代理**  
> 微信/支付宝商户：**后置**（公司主体就绪后）  
> 原则：自配 Key / 本地 = 永久免费；官方会员 = 免配 Key、统一扣积分

---

## 1. 双轨

| 模式 | 模型 Key | 扣官方积分 | 数据路径 |
|------|----------|------------|----------|
| **BYOK / 本地** | 用户自己的或本机 | 否 | 客户端 → 用户服务商 / 本机 |
| **官方会员** | 服务端持有（硅基流动等） | 是 | 客户端 → 即刻对话薄代理 → 第三方 |

---

## 2. 统一积分（P0 单价与档位）

### 2.1 扣费单价（后台可改；以下为种子默认）

| 能力 | 字段 | 默认 | 说明 |
|------|------|------|------|
| 即刻对话（官方 ASR） | `voiceCreditsPerMinute` | **2** | `ceil(秒/60) * 单价`，不足 1 分钟按 1 分钟 |
| 帮我对话 · 读屏 | `replyVisionCredits` | **5** | 截图识别 |
| 帮我对话 · 生成 | `replyCredits` | **10** | 文本回复；与读屏合计约 **15**/次 |
| 看屏幕 | `screenAskCredits` | **25** | 整屏视觉 + 回答 |
| 看屏幕答题（每步） | `screenQuizCredits` | **15** | 读题与作答各扣一次，约 **30**/整次 |

BYOK / 本地路径 **不扣**。

展示换算（非第二账本）：

- 1000 积分 ≈ 500 分钟语音 **或** ≈ 66 次帮我对话 **或** ≈ 40 次看屏幕

### 2.2 成本核算草案（硅基流动量级，用于定价，非精确账单）

| 能力 | 粗估上游成本 | 默认扣分零售（按 1 分≈¥0.01） | 毛利方向 |
|------|--------------|-------------------------------|----------|
| 语音 1 分钟 | ≪ ¥0.01～0.03 | ¥0.02 | 薄利，引流 |
| 帮我对话 1 次 | 视觉+文本约 ¥0.05～0.20 | ¥0.15 | 覆盖波动 |
| 看屏幕 1 次 | 更高 tokens | ¥0.25 | 同上 |

**卖 1000 积分标价 ¥20**（加量包）时，若用户全打在帮我对话（约 66 次），上游粗估 ¥3～13，需用真实流水校准；视觉偏贵时上调 `replyCredits`。

### 2.3 套餐档位（展示价；后台 `plans` 表可改）

| 档位 id | 名称 | 月付标价 | 年付标价 | 每月基础 | 每月赠送 | 权益要点 |
|---------|------|----------|----------|----------|----------|----------|
| `trial` | 体验版 | ¥0 | — | **500** | 0 | 试用官方；可 BYOK / 本地 |
| `standard` | 标准版 | **¥99** | **¥668** | **2000** | **2000** | 日常语音 + 帮我对话 |
| `advanced` | 高级版 | **¥199** | **¥1338** | **4000** | **5000** | 高频看屏幕 |
| `flagship` | 旗舰版 | **¥999** | **¥6713** | **20000** | **30000** | 重度使用 + 优先支持 |

加量包：**1000 积分 / ¥20**（线下同价）。

新用户：注册后默认落 **体验版** 并发放体验积分；可用兑换码加积分。

官网订阅页与 App 个人中心共用 `plan-catalog` + `/v1/plans`，见 `docs/design-marketing-site.md`。

消耗顺序（若拆余额）：先 `monthly_grant`，再 `purchased`。首版可用单余额 + ledger 的 `grant_type` 区分；**充值积分不过期**，月赠按订阅周期重置。

---

## 3. 架构

- **自建**：`server/` — 账号、积分账本、管理后台、薄代理（鉴权 → 扣分 → 转发 OpenAI 兼容上游）
- **不自建**：完整 AI 中转站；上游先用硅基流动，后台改 `baseUrl`/`apiKey`/`model` 即可换折扣渠道
- **支付**：`orders.source = offline` 仍可用；**Stripe Checkout**（`source=stripe`）走托管结算页 + webhook 履约；预留 `wechat` / `alipay`

默认本地 Node API：`http://127.0.0.1:8788`。  
**正式环境（官网 PHP + MySQL）**：客户端 `membershipServerUrl` 默认  
`https://www.lizhenning.com/other/typenow/talknowAPi/index.php`  
（IIS PATH_INFO：`index.php/v1/...`；代码在 `website/talknowAPi/`，PHP 5.2）

---

## 4. 管理后台能力

1. 用户查询 / 冻结  
2. 套餐模板  
3. 线下开单（套餐或充值 + 付款凭证备注）  
4. 积分流水  
5. 官方模型路由（asr / vision / chat）  
6. 扣费单价  
7. 兑换码  

默认管理员：环境变量 `ADMIN_USER` / `ADMIN_PASS`（见 `server/.env.example`）。

后台同时承载**团队内部**能力（勿挂官网公开导航）：

- **产品规划**：任务看板（状态：未开始 / 进行中 / 已完成 / 后置）
- **知识库**：产品定位、会员模型、竞品笔记等可编辑条目
- 入口：正式 `…/talknowAPi/admin/index.php`（推荐内联版）；本地 Node 为 `/admin/`

---

## 5. 薄代理 API（客户端会员模式）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/v1/auth/request-code` | 手机号验证码（开发态固定码，见 README） |
| POST | `/v1/auth/login` | 换 access token |
| GET | `/v1/me` | 套餐、积分余额、`displayName` 昵称、派生展示 |
| POST | `/v1/me-save` | 更新资料：`{ displayName }`（1–32 字），返回最新 `/v1/me` |
| POST | `/v1/redeem` | 兑换码 |
| POST | `/v1/proxy/audio/transcriptions` | 官方 ASR；按音频时长扣分 |
| POST | `/v1/proxy/chat/completions` | 官方 chat/vision；Header `X-TalkNow-Capability: reply\|screen_ask\|screen_quiz` |
| POST | `/v1/orders` | 创建订单。`source=offline` 待后台确认；`source=stripe` 返回 `checkoutUrl` |
| GET | `/v1/orders/:id` | 查单（支付回跳后可轮询） |
| POST | `/v1/stripe/webhook` | Stripe 验签履约（`checkout.session.completed` / `async_payment_succeeded` / `invoice.paid`） |

失败策略：上游失败 **不扣**（或预扣后回滚）；积分不足返回 `402` + 明确文案。

---

## 6. 客户端

- 设置字段：`modelRoutingMode: 'byok' | 'membership'`、`membershipServerUrl`、`membershipAccessToken`
- 侧栏「会员」页：登录、余额、套餐、**Stripe 支付**、客服/付款说明、兑换码
- 已开通用户：更高档「升级到此档」走 Stripe；更低档「申请换到此档」仍弹客服微信；当前档「续费延长」走 Stripe
- 会员模式：`stt` / `llm` 走薄代理；本地与 BYOK 仍可用且不扣分
- HUD：积分不足时提示并引导打开会员页

---

## 6.1 换套餐规则（线下）

档位序：`trial < standard < advanced < flagship`。

| 动作 | 档位 | 到期 | 积分默认 |
|------|------|------|----------|
| 首开 | 立刻写入 | 从今天起算 | 1 账期月赠 |
| 升级 | 立刻改更高档 | **保留原 period_end** | 目标档月赠 − 当前档月赠（差额，≤0 不发） |
| 续费同档 | 不变 | 在现有到期上叠加（过期则从今天） | 1 账期月赠 |
| 降级（到期生效） | 写 `pending_plan_id`，到期切档 | 到期切档后开新账期 | 切档日发新档 1 账期；不扣钱包 |
| 降级（立刻） | 立刻改更低档 | 保留原到期 | 默认不发；不扣钱包 |

管理 API：`POST /v1/admin/subscription-save` 带 `changeType`：`open|upgrade|renew|downgrade|downgrade_now`；`grantMode`：`diff|one|months|none`。

---

## 7. 线下运营 SOP（P4）

会员开通与流量包**分开操作**（勿同一单混开）。详见 [`ops-offline-membership.md`](./ops-offline-membership.md)。

1. 用户转账备注手机号；换档在 App 点升级/换档/续费后加客服微信说明目标档  
2. 后台「用户」搜索 → 看清 **当前档位 / 到期 / 积分 / 预约降档** → 「管理」  
3. **会员变更**：选动作（首开/升级/续费/降级）→ 目标档与积分策略 → 确认  
4. **流量包**：只加积分，不改档位  
5. 用户 App 刷新见余额 / 档位  

管理 API：`POST /v1/admin/subscription-save`、`POST /v1/admin/credit-topup`；用户列表含订阅字段。

客服话术要点：

- 自配 Key 可一直免费用官方外壳  
- 官方模式免配 Key，按积分扣；语音约 2 分/分钟，帮我对话约 15 分/次  
- 升级立刻变档、到期一般不动；降级默认到期再生效，积分不清空  
- 公司主体未就绪前仅支持线下转账，到账后人工开通  

兑换码：后台生成 → 用户 App 内兑换 → 写 ledger。

---

## 8. 在线支付（Stripe · 测试结算）

公司主体未就绪前，**先用 Stripe 测试模式**接入订阅结算（沙盒账号「TalkNow 沙盒」）。微信/支付宝仍后置。

### 8.1 产品模型

每个付费档位一个 Stripe Product（标准 / 高级 / 旗舰），月付与年付各一条 Price；加量包单独 Product + 一次性 Price。  
**不要**把不同档位挂在同一个 Product 上。

测试环境结算币种用 **HKD**（香港账户；官网页仍展示 ¥ 标价，数值与档位表一致，上线前按主体改币种）。

| 本地档位 | Stripe Product id | 月付 Price key | 年付 Price key |
|----------|-------------------|----------------|----------------|
| `standard` | `talknow_standard` | `standard_month` | `standard_year` |
| `advanced` | `talknow_advanced` | `advanced_month` | `advanced_year` |
| `flagship` | `talknow_flagship` | `flagship_month` | `flagship_year` |
| 加量包 1000 分 | `talknow_topup` | `topup`（一次性） | — |

### 8.2 结算路径

1. 已登录用户 `POST /v1/orders`，`source=stripe`，带 `planId` + `interval=month|year`，或加量包 `credits` + `amountCents`  
2. 服务端建 pending 订单，再创建 Checkout Session（套餐 `mode=subscription`，加量包 `mode=payment`），**不传** `payment_method_types`（动态支付方式）  
3. 返回 `checkoutUrl`；App 用系统浏览器打开，官网订阅页直接跳转  
4. **履约只认 webhook**（成功页不发积分）：  
   - `checkout.session.completed` 且 `payment_status=paid`  
   - `checkout.session.async_payment_succeeded`  
   - `invoice.paid` 且 `billing_reason=subscription_cycle`（续费再发 1 账期）  
5. 履约与线下同一套 `tn_change_subscription` / `credit_ledger`；`orders.external_trade_no` 存 Session / Invoice id，重复通知幂等

配置：PHP `config.php` 的 `stripe_secret_key` / `stripe_webhook_secret` / `stripe_prices`；本地 Node 用环境变量 `STRIPE_*`。  
Webhook 公网：`…/talknowAPi/index.php/v1/stripe/webhook`（Dashboard 或 `stripe listen`）。

Customer Portal、Stripe Tax、微信/支付宝：**未做**。若向美欧收款，需另开 [Stripe Tax 登记](https://docs.stripe.com/billing/taxes/collect-taxes) 后再开 `automatic_tax`。

`source=wechat|alipay` 仍返回 `501 Payment not enabled`。

---

## 9. 隐私与文案

- 会员路径：内容经薄代理转发上游，**服务端不落对话/截图明文**（只记用量元数据）  
- BYOK：不经官方服务器  
- 用户协议 / 隐私政策主体：公司执照下来前用占位，收款正式上线前替换  

---

## 10. 验收

- [ ] 后台能为用户加 1000 积分并在 App 可见  
- [ ] 无客户端 Key、会员模式可完成一次语音 + 一次帮我对话并扣分  
- [ ] 积分为 0 时官方路径被拦；切 BYOK 仍可用  
- [ ] 线下开单有凭证备注；兑换码可用  
- [ ] 官网定价页与档位数字一致；付费档可 Stripe 结算（测试卡），线下客服仍可用  
