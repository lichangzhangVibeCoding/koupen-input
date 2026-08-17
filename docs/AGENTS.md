# 即刻对话 — Agent / 开发约定

## 工作顺序（必须）

1. **先改文档**（`docs/mvp-v1.md` 等）  
2. **写入变更日志**（`docs/CHANGELOG.md`）  
3. **再改代码 / 配置**  
4. 需要时更新 `README.md`

不要先写代码再补文档。

## 平台文案

- **Mac 构建 / Mac 用户界面**：写 `Command`、`Option`；不要混写 Windows 键名  
- **Windows 构建 / Windows 用户界面**：写 `Alt`、`Ctrl`；热键为 Alt 单击/双击  
- UI 文案按 `process.platform` / `vipChat.getPlatform()` 分支，**不要**改另一平台默认行为  
- Windows 细节见 `docs/design-windows-v0.1.md`

## 打包安装包

生成 `.dmg` / `.app` 时必须是**干净初始版**：

- 不打包本机 `userData`、API Key、客户、聊天、本地模型缓存
- 先跑干净检查（见 `docs/design-user-data.md` §5），失败则中止
- 交付说明写清：用户数据仅在安装后本机生成

## 品牌文案

用户可见名称以 `docs/design-branding.md` 为准：

- 产品：**即刻对话**（曾用名：口喷输入）
- 语音能力：**即刻对话**（曾用名：我来口喷）
- 截图回复：**帮我对话**（曾用名：帮你口喷）
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
- 宣传站：`docs/design-marketing-site.md` · 源码 `website/`（TalkNow；默认中文，`?lang=en`）
- 发版数据：`docs/design-releases.md` · `docs/releases.json`（**每次用户可见更新后**：同步 `website/` + `src/shared/` + `website/js/releases-data.js`，并打安装包；**中英 `title`/`titleEn`、`highlights`/`highlightsEn` 一起写**）
- 系统测试：`docs/qa/system-test-plan-0.5.0.md` · `docs/qa/system-test-report-0.5.0.md`
- 模型配置：`docs/design-model-config.md`
- 用户配置与数据：`docs/design-user-data.md`
- 内测 UI 优化：`docs/design-ui-beta-v0.1.md`
- 性格包 W2（场景技巧）：`docs/design-persona-pack-w2.md`
- Mac 权限引导 / 包名 typenow：`docs/design-permission-guide.md`
- 多语言（即刻对话 / TalkNow）：`docs/design-i18n.md`
- 看屏幕问答 / 看屏幕答题：`docs/design-screen-ask.md`
- 按住说 = 提示词增强：`docs/design-prompt-enhance.md` · 用户说明书 `docs/guide-prompt-enhance.md`
- 官方会员 / 积分 / 薄代理：`docs/design-membership.md` · 服务端 `server/` · 线下 SOP `docs/ops-offline-membership.md`
