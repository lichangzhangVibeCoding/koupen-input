# 即刻对话 / TalkNow 官网

面向中国用户推广的产品官网。纯静态 HTML/CSS/JS，无构建步骤。  
**品牌域名：https://www.talknow.cn/**

## 三页结构

| 路径 | 说明 |
|---|---|
| `/` | 首页（现有单页内容保留） |
| `/subscribe/` | 订阅（与 App 个人中心套餐同源） |
| `/help/` | 帮助（含即刻对话点按 / 按住说明书） |
| `/changelog/` | 更新日志（页脚） |
| `/pricing/` | 重定向到 `/subscribe/` |

主导航：**首页 · 订阅 · 帮助**。

## 套餐同源

- 数据：`src/shared/plan-catalog.json`
- App：`src/shared/plan-catalog.ts` + `GET /v1/plans`
- 官网：`npm run sync:plans` → `website/js/plan-catalog.js`，订阅页拉同一 API

改档位结构后务必：

```bash
npm run sync:plans
```

## 目录

```
website/
├── index.html
├── subscribe/
├── help/
├── changelog/
├── pricing/          # redirect
├── css/ink-signal.css
├── js/i18n.js · plan-catalog.js · subscribe.js · releases-*.js
└── assets/
```

## 部署

```bash
npm run sync:plans
FTP_PASS='…' python3 website/deploy-inline-ftp.py
```

目标过渡路径：`lizhenning.com/other/typenow/`。
