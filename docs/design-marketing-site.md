# 宣传站（即刻对话 / TalkNow）

> 状态：**线上 HTML / 会员 API 仍部署自 lizhenning.com**  
> 部署源码：`/Users/tank/Downloads/lizhenning.com/other/typenow/`  
> 本 App 仓库 `website/`：**勿当 FTP 部署源**  
> **产品信息（隐私、本机路径）从现在起在本仓库维护**：`docs/design-user-data.md`；App 设置/帮助会展示。官网首页**不再主讲**「不是云端 SaaS / 数据不出门」，底部改讲「语音搭子」。  
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
| `/` | `index.html` | **首页**：语音搭子定位 / 场景 / 能力 / 上手 / 下载 |
| `/subscribe/` | `subscribe/index.html` | **订阅**：套餐与积分；已登录可 Stripe Checkout |
| `/help/` | `help/index.html` | **帮助（说明书）**：30 秒搞懂 → 新手上手 → 四个能力 → 案例模拟 → 设置/会员 → 排障 → 数据 → FAQ。点按/按住备用键只写帮助页，首页不写 Command+8 |
| `/changelog/` | `changelog/index.html` | 更新日志（页脚入口，非主导航） |
| `/pricing/` | 重定向 → `/subscribe/` | 旧链接兼容 |

主导航：**首页 · 订阅 · 帮助 · 场景 · 能力**（+ 语言切换 + 下载 CTA）。内页「场景 / 能力」链回首页 `#scenarios` / `#capabilities`。顶栏品牌锁旁展示 **当前安装包版本**（小字，如 `v0.5.9`，来自发版数据最新一条）。  
品牌锁：左 **Logo 图形** + 右 **即刻对话**，其下驼峰 **TalkNow**。

下载：

- **Windows**：真实安装包。Hero 主按钮为「下载 Windows 版」（电青），下方灰色小字当前版本；macOS 为次按钮「macOS 内测中」。  
- **macOS**：暂不提供 dmg；按钮为「macOS 内测中」（toast / 禁用，禁止触发下载）。

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

Hero 主句：**AI 时代的语音搭子**（小字：站在所有智能体前面）。卖点是「用 AI 的时候，用我来输入」。  

Hero → 情感钩子 → **为什么需要语音搭子**（`#why`，一核三辅）→ 场景导览（**与AI对话先行**）→ 能力详解 → 上手 → 下载 → Footer。  

官网场景组顺序（差异化先行，**不等于**客户端指挥台顺序）：

1. **与AI对话** — 按住同一语音键，按屏幕增强提示词  
2. **即刻对话** — 点按贴原话（微信 / 邮件 / 写稿，以及 Cursor / IDE vibe coding：说注释和指令，不是按住增强）  
3. **帮我对话** — 截图回复  
4. **看屏幕** — 整屏问答；答题并入本组，不是第五技能  

客户端首页指挥台仍是即刻对话 → 与AI对话 → 帮我对话 → 看屏幕。  

看屏幕四卡：答题 / 翻译 / 论文 / 作业。勿把答题或茶馆预约做成独立能力。  

`#why` 一核三辅：

- 核心大卡：把口语变成能执行的提示词（对着屏幕按住说；贴进输入框，不自动发送）。首页勿写「蓄水池」；「场景包」勿当卖点，改用日常说法。  
- 三张辅卡：全平台语音输入 / 说完就是字 / 看屏幕问答  

Hero 小字「站在所有智能体前面」，不要用「数据不出门」当头。页脚不再写隐私句；本机路径仍在 App 设置与帮助。

知识库 `js/kb-data.js` 仍可写本机存储事实，但首页不再展开信任四卡。  
**本机路径**：Mac `~/Library/Application Support/typenow/`；Windows `%APPDATA%\typenow\`。官网帮助页「数据与不代发」一节同样写清路径。

### 帮助页（说明书）

`/help/` 是给小白到熟练用户看的长文，不是首页的缩写。结构固定：

1. 30 秒搞懂（四能力对照表）
2. 新手从这里开始（Windows 可装；**macOS 内测中、无 dmg**）
3. 四个能力说明书（点按 / 按住 / 双击 / 看屏幕；备用键只写这里）
4. 案例模拟（即刻对话含 Cursor 贴原话；与AI对话含网站 / PPT / 修 Bug / 写方案；勿写「蓄水池」）
5. 设置、模型、会员（价格以订阅页为准）
6. 权限与排障
7. 数据与不代发
8. FAQ

中英都在 `js/i18n.js`。

不要改本仓库 `website/` 去部署。

## 部署（WAF）

主机对独立 `*.js` / `*.css` 常返回空体、图片常 403。用内联上传：

```bash
cd /Users/tank/Downloads/lizhenning.com/other/typenow
# 若刚改了 App 套餐结构：在 koupen-input 先 npm run sync:plans
FTP_PASS='…' python3 deploy-inline-ftp.py
```

脚本把 CSS + JS 打进 HTML；品牌标用压缩 `assets/icon-web.png` 的 data URI。订阅页先画本地档位，后台拉 `/v1/plans`（4s 超时），失败只提示一次。
