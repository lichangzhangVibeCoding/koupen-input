# TalkNow 会员服务端

账号、统一积分账本、管理后台、薄代理（转发硅基流动等 OpenAI 兼容上游）。

设计见仓库 [`docs/design-membership.md`](../docs/design-membership.md)。

## 启动

```bash
cd server
cp .env.example .env   # 填 UPSTREAM_API_KEY、ADMIN_PASS
npm install
npm start
```

- API / 代理：`http://127.0.0.1:8788`
- 管理后台：`http://127.0.0.1:8788/admin/`（同 `/ops`）
- 开发登录：任意手机号 + `.env` 里 `DEV_LOGIN_CODE`（默认 `888888`）
- **内部账号**（知识库 / 产品规划 / 会员运营）：默认 `admin` / 见 `.env` 的 `ADMIN_PASS`（示例为 `Lizhenning@521`）

本后台为**团队私密**，不要挂到官网公开导航。

## 目录

- `src/` — Express API
- `public/admin/` — 管理后台静态页
- `data/` — SQLite（运行后生成，勿提交密钥）

## 线下开单

管理后台 → 用户 → 线下开单 → 选套餐或充值积分 → 填付款凭证备注 → 确认。

## Stripe Checkout（测试）

`.env` 填 `STRIPE_SECRET_KEY` 与 `STRIPE_WEBHOOK_SECRET`。本地可用 `stripe listen --forward-to localhost:8788/v1/stripe/webhook`。  
`POST /v1/orders` 且 `source=stripe` 返回 `checkoutUrl`；履约只认 webhook。
