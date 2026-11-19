# 即刻对话 — Agent / 开发约定

## 工作顺序（必须）

1. **先改文档**（`docs/mvp-v1.md` 等）  
2. **写入变更日志**（`docs/CHANGELOG.md`）  
3. **再改代码 / 配置**  
4. 需要时更新 `README.md`

不要先写代码再补文档。

## 平台文案

Win / Mac 有差异时，**分别对应现实**：只写当前系统用户会真正按到 / 看到的键与路径。

- **Mac 构建 / Mac 用户界面**：写 `右 Command`、`Option`、`Fn`；不要混写 Alt / Win / Super
- **Windows 构建 / Windows 用户界面**：写 `Alt`、`Ctrl`、`Win`；热键为 Alt 单击/按住/双击；看屏幕 `Win+Shift+1`。用户可见**不要**写内部名 `Super`（加速键仍可存 `Super+…`）
- UI 文案按 `process.platform` / `vipChat.getPlatform()` 分支，**不要**改另一平台默认行为
- Windows 细节见 `docs/design-windows-v0.1.md`

## 打包安装包

生成 `.dmg` / `.app` 时必须是**干净初始版**：

- 不打包本机 `userData`、API Key、客户、聊天、本地模型缓存
- 先跑干净检查（见 `docs/design-user-data.md` §5），失败则中止
- 交付说明写清：用户数据仅在安装后本机生成

## 品牌文案

用户可见名称以 `docs/design-branding.md` 为准：

- 产品：**即刻对话**（曾用名：口喷输入）；对外口号 **四个能力，一个助手**
- 能力 1 语音：**即刻对话**（曾用名：我来口喷；点按贴口述）
- 能力 2 与AI对话：**与AI对话**（按住同一语音键增强提示词；首页 / 官网第二能力；不是新快捷键）
- 能力 3 截图回复：**帮我对话**（曾用名：帮你口喷）
- 能力 4 看屏幕：**看屏幕**（答题并入，不是第五技能）
- Mac 快捷键默认**右 Command**（Electron 分不出左右，走 uIOhook；需辅助功能）。即刻对话触发键可在设置改为右 Option / Fn，见 `docs/design-voice-trigger.md`。硬件备用：语音 `右 Command+8` / Win `Win+8`；回复 `右 Command+0` / Win `Win+0`
- 勿再为 Mac 注册含 `Command` 的 `globalShortcut`（会同时响应左/右 Command）
- 对外名旁必须带一句话解释；勿写主播/榜一等行业话术

## 相关文档

- 功能规格：`docs/mvp-v1.md`
- 变更日志：`docs/CHANGELOG.md`
- 品牌命名：`docs/design-branding.md`
- 视觉 VI（墨色信号）：`docs/design-vi-ink-signal.md`
- Esc 取消进行中任务：`docs/design-esc-cancel.md`
- 商用 UI：`docs/design-ui-commercial-v1.md`
- 宣传站：`docs/design-marketing-site.md` · **源码在本仓库 `website/`**（部署 `website/deploy-inline-ftp.py`；`lizhenning.com/other/typenow/` 只转发）  
- 产品信息真源（本仓库）：隐私口径、本机存储路径 → `docs/design-user-data.md`（用户可见：设置「配置与数据」、帮助「数据与隐私」）。官网首页讲语音搭子，不主讲信任/SaaS
- **四能力用户文案对齐（内部、不对用户展示）**：`docs/ops-copy-sync.md`（勿写入 `docs/releases.json`）
- 发版数据：`docs/design-releases.md` · `docs/releases.json`（**每次用户可见更新后**：`npm run sync:releases` → `website/js/releases-data.js` + `src/shared/`，并打安装包；**中英 `title`/`titleEn`、`highlights`/`highlightsEn` 一起写**）
- 套餐结构：`npm run sync:plans` → `website/js/plan-catalog.js`
- 系统测试：`docs/qa/system-test-plan-0.5.0.md` · `docs/qa/system-test-report-0.5.0.md`
- 模型配置：`docs/design-model-config.md`
- 用户配置与数据：`docs/design-user-data.md`
- 内测 UI 优化：`docs/design-ui-beta-v0.1.md`
- 性格包 W2（场景技巧）：`docs/design-persona-pack-w2.md`
- Mac 权限引导 / 包名 typenow：`docs/design-permission-guide.md`
- 新手引导（登录后按默认快捷键练四能力）：`docs/design-onboarding.md`
- 多语言（即刻对话 / TalkNow）：`docs/design-i18n.md`
- 看屏幕问答（含口述答题意图）：`docs/design-screen-ask.md`
- 按住说 = 提示词增强：`docs/design-prompt-enhance.md` · 场景包 `src/shared/prompt-scenes/` · 用户说明书 `docs/guide-prompt-enhance.md`
- 官方会员 / 积分 / 薄代理：`docs/design-membership.md` · 服务端 `server/` · 线下 SOP `docs/ops-offline-membership.md`
- **默认跑法是官方会员**：新安装需注册/登录，登录后三槽走官方模型。自配 Key / 本地可在模型页改；已有自配 Key 的配置不要强制改写。
