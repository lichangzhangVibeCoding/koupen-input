# 宣传站（即刻对话 / TalkNow）

> 状态：**website/ 现站**  
> 源码：仓库 `website/`  
> 品牌域名：**https://www.talknow.cn/**（已购；DNS 正式启用后指向本站）  
> 过渡部署：`lizhenning.com/other/typenow/`（WAF 内联上传）

## 品牌

| 项 | 值 |
|---|---|
| 中文名 | **即刻对话** |
| 英文名 | **TalkNow** |
| 域名 | **www.talknow.cn** |
| 下载 | GitHub Releases |

## 站点 IA（三页）

| 路径 | 文件 | 说明 |
|---|---|---|
| `/` | `website/index.html` | **首页**：现有单页内容保留（场景 / 能力 / 信任 / 上手 / 下载） |
| `/subscribe/` | `website/subscribe/index.html` | **订阅**：套餐与积分；已登录可 Stripe Checkout |
| `/help/` | `website/help/index.html` | **帮助**：安装、权限、会员 FAQ；「即刻对话」点按 / 按住说明书（`docs/guide-prompt-enhance.md`） |
| `/changelog/` | `website/changelog/index.html` | 更新日志（页脚入口，非主导航） |
| `/pricing/` | 重定向 → `/subscribe/` | 旧链接兼容 |

主导航：**首页 · 订阅 · 帮助**（+ 语言切换 + 下载 CTA）。  
品牌锁：左 **Logo 图形** + 右 **即刻对话**，其下驼峰 **TalkNow**。

文案：`website/js/i18n.js`（默认中文；`?lang=en`）。  
发版：`website/js/releases-data.js`（`siteUrl` = www.talknow.cn）。

## 套餐同源（强制）

个人中心与官网订阅页必须展示同一套档位。数据分两层：

| 层 | 来源 | 内容 |
|---|---|---|
| **数字** | `GET /v1/plans`（后台 `tn_plans` 可改） | 名称、基础/赠送积分、月付/年付价、加量包、扣费单价 |
| **营销结构** | `src/shared/plan-catalog.ts` | 档位顺序、哪几条权益、是否推荐高亮、文案 key |

约定：

1. 改价格/积分 → 后台改 `plans`（或 seed）；App 与官网都拉 `/v1/plans`，无需改前端文案数字。  
2. 改权益条目/文案结构 → **只改** `plan-catalog.ts`，再跑 `npm run sync:plans` 生成 `website/js/plan-catalog.js`。  
3. 改 i18n 权益句子 → App `src/shared/i18n` **与** `website/js/i18n.js` 的 `plan.*` 键同步（脚本会提示，人工对齐短句）。  
4. 禁止在 `subscribe/index.html` 或 `AccountPage` 再硬编码四档价格。

当前四档 id：`trial` → `standard` → `advanced` → `flagship`（与 `docs/design-membership.md`、PHP seed 一致）。

官网 API 默认：  
`https://www.lizhenning.com/other/typenow/talknowAPi/index.php/v1/plans`  
（与客户端 `membershipServerUrl` 同源。）

## 首页内容（摘要）

Hero → 场景导览 → 能力详解 → 信任 → 上手 → 下载 → Footer。  
细节以 `website/README.md` 与页面源码为准。

## 部署（WAF）

主机对独立 `*.js` / `*.css` 常返回空体、图片常 403。用内联上传：

```bash
npm run sync:plans
FTP_PASS='…' python3 website/deploy-inline-ftp.py
```

脚本把 CSS + JS 打进 HTML；品牌标用压缩 `assets/icon-web.png` 的 data URI（勿内联完整 `icon.png`，否则单页可到 ~300KB）。订阅页先画本地档位，后台拉 `/v1/plans`（4s 超时），失败只提示一次，不卡在「正在同步」。
