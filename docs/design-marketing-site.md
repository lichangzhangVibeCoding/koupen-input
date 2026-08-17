# 宣传站（即刻对话 / TalkNow）

> 状态：**权威源码在 lizhenning.com 仓库**  
> 源码：`/Users/tank/Downloads/lizhenning.com/other/typenow/`（相对：`lizhenning.com/other/typenow/`）  
> 本 App 仓库 `website/`：**勿改**，仅镜像 / 脚本偶发写入  
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

| 路径 | 文件（相对 typenow 根） | 说明 |
|---|---|---|
| `/` | `index.html` | **首页**：场景 / 能力 / 信任 / 上手 / 下载 |
| `/subscribe/` | `subscribe/index.html` | **订阅**：套餐与积分；已登录可 Stripe Checkout |
| `/help/` | `help/index.html` | **帮助**：安装、权限、会员 FAQ；「即刻对话」点按 / 按住说明书 |
| `/changelog/` | `changelog/index.html` | 更新日志（页脚入口，非主导航） |
| `/pricing/` | 重定向 → `/subscribe/` | 旧链接兼容 |

主导航：**首页 · 订阅 · 帮助**（+ 语言切换 + 下载 CTA）。顶栏品牌锁旁展示 **当前安装包版本**（小字，如 `v0.5.9`，来自发版数据最新一条）。  
品牌锁：左 **Logo 图形** + 右 **即刻对话**，其下驼峰 **TalkNow**。

下载：

- **Windows**：真实安装包（GitHub Releases 或站内 `dl/` 直链）。  
- **macOS**：暂不提供 dmg；按钮为「敬请期待」（toast / 禁用，禁止触发下载）。

文案：`js/i18n.js`（默认中文；`?lang=en`）。  
发版：`js/releases-data.js`（`siteUrl` = www.talknow.cn）。

## 套餐同源（强制）

个人中心与官网订阅页必须展示同一套档位。数据分两层：

| 层 | 来源 | 内容 |
|---|---|---|
| **数字** | `GET /v1/plans`（后台 `tn_plans` 可改） | 名称、基础/赠送积分、月付/年付价、加量包、扣费单价 |
| **营销结构** | `src/shared/plan-catalog.ts` | 档位顺序、哪几条权益、是否推荐高亮、文案 key |

约定：

1. 改价格/积分 → 后台改 `plans`（或 seed）；App 与官网都拉 `/v1/plans`，无需改前端文案数字。  
2. 改权益条目/文案结构 → **只改** `plan-catalog.ts`，再跑 `npm run sync:plans`（会写入 lizhenning `other/typenow/js/plan-catalog.js`，并镜像本仓库 `website/js/`）。  
3. 改 i18n 权益句子 → App `src/shared/i18n` **与** typenow `js/i18n.js` 的 `plan.*` 键同步。  
4. 禁止在 `subscribe/index.html` 或 `AccountPage` 再硬编码四档价格。

当前四档 id：`trial` → `standard` → `advanced` → `flagship`（与 `docs/design-membership.md`、PHP seed 一致）。

官网 API 默认：  
`https://www.lizhenning.com/other/typenow/talknowAPi/index.php/v1/plans`  
（与客户端 `membershipServerUrl` 同源。）

## 首页内容（摘要）

Hero → 场景导览（含「与AI对话」）→ 能力详解 → 信任 → 上手 → 下载 → Footer。  
细节以 lizhenning `other/typenow/README.md` 与页面源码为准。

## 部署（WAF）

主机对独立 `*.js` / `*.css` 常返回空体、图片常 403。用内联上传：

```bash
cd /Users/tank/Downloads/lizhenning.com/other/typenow
# 若刚改了 App 套餐结构：在 koupen-input 先 npm run sync:plans
FTP_PASS='…' python3 deploy-inline-ftp.py
```

脚本把 CSS + JS 打进 HTML；品牌标用压缩 `assets/icon-web.png` 的 data URI。订阅页先画本地档位，后台拉 `/v1/plans`（4s 超时），失败只提示一次。
