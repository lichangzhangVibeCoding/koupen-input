# 品牌与功能命名设计（即刻对话 / TalkNow）

> 状态：**已落地**（中文 **即刻对话** · 英文 **TalkNow** · 官网 **www.talknow.cn**）  
> 视觉体系见 [`docs/design-vi-ink-signal.md`](design-vi-ink-signal.md)（墨色信号 VI）  
> 商用壳层见 [`docs/design-ui-commercial-v1.md`](design-ui-commercial-v1.md)  
> 宣传站源码：`website/`（目标域名 www.talknow.cn；会员 API 仍可暂挂过渡主机）  
> 原则：先文档后代码；通用软件定位；对外名 + 一句话解释同时出现在界面。

---

## 1. 产品定位（通用）

**即刻对话（TalkNow）**是本机运行的对话助手：把聊天窗口里的对话按人建档，记住人设与历史，用快捷键把「你说的话」或「该回的话」填进输入框（不自动发送）；也可看整屏回答问题。

- 不面向某一行业（不用主播 / 公会 / 榜一等话术）  
- 目标用户：需要维护多段私聊、又希望少打字的人  
- 数据仅存本机；用户主动触发；粘贴后由用户自行确认发送  

---

## 2. 品牌资产

| 项 | 值 |
|---|---|
| 中文名 | **即刻对话** |
| 英文名 | **TalkNow** |
| 双语并列 | 即刻对话 TalkNow |
| 官网 | **https://www.talknow.cn/** |
| 内部包名 / appId | `typenow` / `com.typenow.app`（勿改，避免升级丢数据） |

代码常量：`src/shared/brand.ts`（`BRAND_SITE` / `BRAND_NAME_ZH` / `BRAND_NAME_EN`）。

---

## 3. 对外名与一句话（必须成对出现）

| 层级 | 对外名 | 一句话解释（界面副文案） |
|---|---|---|
| 产品 | **即刻对话** / **TalkNow** | 本机对话助手，少打字、快回人 |
| 能力 A（语音） | **即刻对话** / **TalkNow** | 你说，我转成字并贴进当前输入框（Mac 触发键默认可改：右 Command / 右 Option / Fn） |
| 能力 B（截图回复） | **帮我对话** / **Reply Assist** | 看当前聊天截图，按人设生成回复并填入（不发送） |
| 能力 C（看屏幕） | **看屏幕** / **Screen Ask** | 我看着整屏，你说要干什么，我按你说的办 |
| 能力 D（答题） | **看屏幕答题** / **Screen Quiz** | 看题直接给正确答案，不啰嗦 |

多语言实现见 `docs/design-i18n.md`。视觉见 `docs/design-vi-ink-signal.md`。宣传站见 `docs/design-marketing-site.md`。

硬件隐藏快捷键（设置页可不强调）：语音 `右 Command+8` / `Win+8`；帮我对话 `右 Command+0` / `Win+0`；看屏幕 `右 Command+Shift+1` / `Win+Shift+1`；看屏幕答题 `右 Command+Shift+2` / `Win+Shift+2`。

约定：

1. 凡出现对外名，附近必须有一句话解释。  
2. 一句话用白话，写「做什么 / 结果是什么」，不写技术词（Whisper、Vision、OCR）。  
3. 危险动作仍单独提示：不自动发送、需本机权限等。  
4. 中文界面可并列展示英文名 TalkNow；英文界面可并列「即刻对话」。  
5. 对外链接默认 `https://www.talknow.cn/`（发版 `siteUrl`、更新页「打开官网」）。

---

## 4. 界面落点

### 4.1 全局

| 位置 | 文案 |
|---|---|
| 窗口标题 / 菜单栏 App 名 | 即刻对话（en：TalkNow） |
| 首页英雄标题 | 即刻对话 + TalkNow + www.talknow.cn |
| 侧栏轨顶 | TalkNow A 方案图标（`brand-icon.png`） |
| 安装包 / DMG 名 | 即刻对话（如 `即刻对话-0.5.7-arm64.dmg`） |
| `package.json` productName | 即刻对话 |

### 4.2 首页

1. 品牌双语 + 产品一句话 + 官网域名  
2. 就绪状态 + 能力指挥台  
3. 未就绪时两步引导  

### 4.3 侧栏导航

首页 · 对话 · 联系人 · 模型 · 更新 · 设置

### 4.4 HUD

墨底 + 电青动效；忙时持续可见阶段文案（见 `design-hud-progress.md`）。

---

## 5. 术语对照

| 旧 | 新 |
|---|---|
| 口喷输入 / 我来口喷 / 帮你口喷 | 即刻对话 / 即刻对话（语音）/ 帮我对话 |
| 客户 | 联系人 |
| 品牌紫 UI | 墨色信号 VI |
| lizhenning.com/other/typenow/（对外宣传） | **www.talknow.cn** |

内部包名：`typenow` / `com.typenow.app`；用户可见显示名仍为「即刻对话 / TalkNow」。

---

## 6. 验收

- [x] 安装包/窗口标题为「即刻对话」  
- [x] 英文 UI 为 TalkNow  
- [x] 发版 `siteUrl` = `https://www.talknow.cn/`  
- [x] 官网页 footer / canonical 为 www.talknow.cn  
