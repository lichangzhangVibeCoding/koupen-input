# 口喷输入 — 文档与产品变更日志

> 约定：凡改功能，**先改文档、记本日志，再改代码**。  
> 用户可见快捷键按平台写：Mac 用 `Command` / `Option`；Windows 用 `Alt` / `Ctrl`。改一端勿动另一端默认行为。

---

## 2026-07-18

### 文档

- **Windows 帮你口喷识别修复**：Win 改为优先截前台聊天窗口（非整屏）；窗口标题解析联系人名作为兜底，解决「未能识别联系人名称」。
- **Windows 绿色版**：`npm run dist:win:green` 出 portable 单文件 + zip 解压版；Actions 工作流 **Build Windows Green** → Artifact `koupen-windows-green`。
- **Windows 版**：Mac 行为不动；Win 上 Alt 单击=我来口喷、Alt 双击=帮你口喷；截屏/粘贴走 Windows API；无 Windows 本机时用 GitHub Actions（`Build Windows`）出 NSIS。详见 `docs/design-windows-v0.1.md`。
- **内测 UI 优化规划（已搁置）**：曾起草 Onboarding / 模型折叠 / 版本角标等方案，暂不实施。详见 `docs/design-ui-beta-v0.1.md`。
- **帮你口喷默认触发**：由 `Command+8` 改为**快速双击左 Command**；单击左 Command 仍为「我来口喷」。本地仍为旧默认 `Command+8` 时启动自动迁移。
- **品牌重定位（已落地）**：产品 **口喷输入**；能力 **我来口喷** / **帮你口喷**（各带一句话解释）；通用对话助手，去掉主播/榜一话术；「客户」→「联系人」。详见 `docs/design-branding.md`。

### 产品 / 代码

- **UI 改浅色主题（Mac 主线）**：整体从近黑深紫改为**浅色 + 紫色主调**，提升对比与层次；统一字号层级、间距、卡片阴影；输入/按钮/徽章/联系人/微信聊天流按浅色重排；HUD 悬浮胶囊保持紫渐变不变。方向经用户确认（浅色 + 紫）。
- **Windows 热键 / 截屏 / 粘贴**：Alt 单击=我来口喷、Alt 双击=帮你口喷；`desktopCapturer` 截屏；PowerShell Ctrl+V 粘贴；Mac 仍为左 Command 单击/双击（`modifier-tap.ts`）
- **HUD 紫渐变**：底部悬浮状态条与主界面一致的紫色 AI 渐变（进行中 / 完成 / 失败）
- **双击左 Command → 帮你口喷**；单击 → 我来口喷；设置默认热键 `DoubleCommand`

## 2026-07-17

### 文档

- **用户配置与数据管理（一期已落地）**：个性化配置独立 `settings.json`；客户/聊天为业务数据；导出配置（默认不含 Key）、还原默认配置；打包干净检查。详见 `docs/design-user-data.md`。
- **模型配置优化（一期已落地）**：独立「模型」页；三能力槽（语音识别 / 截图理解 / 回复生成）；服务商卡片；硅基一键推荐；本地套件（本地语音 + Ollama 对话）一键安装；设置页降噪。详见 `docs/design-model-config.md`。
- **设置页分类重构**：两大核心功能用 Tab 切换——「帮你口喷」与「我来口喷」；共用本地 Ollama 安装区；安装后两个功能各自可独立切换「本地 / 在线」。详见 `mvp-v1.md` §4.1。
- **联系人详情页重构**：顶部独立「人设配置」+「人物画像/标签/关键事实」；下方仿微信聊天记录（保留时间、可按日期时间段筛选）；人设/画像可据历史聊天更新并打标签。详见 `mvp-v1.md` §4.5。
- **长文本我来口喷**：新增「左 Command 点按开始 / 再按结束」语音输入法；结束后自动粘贴到当前输入框，并保留在剪贴板；转写走 OpenAI 兼容 Whisper 接口；需麦克风与辅助功能权限。详见 `mvp-v1.md` §4.2.1。
- **「已损坏，无法打开」**：说明此为 Gatekeeper / 隔离属性误报（尤其经微信传输后常见），处理方式：`xattr -cr` 清除隔离，或终端执行对应命令；并补充到 README。
- **Mac 安装包**：说明通过 `npm run dist` 产出 `.dmg`，产物目录为 `release/`；当前为未签名安装包（本机安装可能需右键打开）。
- **默认快捷键**改为 `Command + 8`（不再使用 `Control + Option + V`、`Option + Space`）。
- 全文快捷键说明改为 **仅 Mac 表述**；去掉 Windows / Electron 内部别名对用户的展示。
- 新增本文件 `docs/CHANGELOG.md`，用于留存文档与产品决策变更。
- 新增 `docs/AGENTS.md`：开发顺序（先文档后代码）、Mac 文案约定。

### 产品 / 代码（文档确认后实施）

- **模型页三槽可编辑**：语音识别 / 截图理解 / 回复生成各自展开配置（本地·在线、URL/Key/模型名、保存、测一下）；快捷推荐保留在顶部
- **硅基快捷推荐默认三模型**：语音 `FunAudioLLM/SenseVoiceSmall`、截图 `moonshotai/Kimi-K2.7-Code`、回复 `deepseek-ai/DeepSeek-V3`；一点同步到下方三槽
- **模型页三槽可编辑**：语音识别 / 截图理解 / 回复生成各自有配置区（本地·在线、URL/Key/模型名、保存、测一下）；顶部保留快捷推荐
- **联系人详情恢复纵向布局**：顶部独立「人设」+「画像/标签/关键事实」配置区；下方全宽微信风格聊天流（保留时间、可按日期筛选）；支持据聊天更新人设/画像
- **品牌「口喷输入」**：侧栏/窗口/安装包改名；首页两能力卡（我来口喷 / 帮你口喷 + 一句话）；客户→联系人；HUD 带能力前缀
- **用户配置一期**：`userData/config/settings.json` 为配置真源（旧 SQLite settings 自动迁移）；设置页「导出配置 / 还原默认配置」；`npm run dist` 前跑 `ensure-clean-release` 防脏包
- **模型页（一期）**：侧栏独立「模型」入口；三槽（语音 / 截图 / 回复）状态 +「测一下」；硅基一键推荐；本地套件（内置 Whisper + Ollama）一键安装；设置页只保留快捷键/开关/权限
- **设置页 Tab**：帮你口喷 / 我来口喷分栏；各自本地·在线切换；共用 Ollama 安装
- **联系人详情**：顶部人设/画像配置（自动保存、标签、关键事实、按历史生成）；下方微信风格聊天流 + 时间筛选
- **语音输入**：左 Command 点按切换录音 → Whisper 兼容转写 → 粘贴到当前输入框 + 保留剪贴板；设置页可开关与配置转写 Key
- 打包 Mac `.dmg` / `.app`（electron-builder，`release/`）
- 默认全局快捷键：`Command+8`
- 若本地仍保存旧默认（`Alt+Space` / `Option+Space` / `Control+Alt+V`），启动时自动迁移为 `Command+8`
- 设置页、首页、README 中的快捷键示例改为 Mac 写法
