# 即刻对话 — 文档与产品变更日志

> 约定：凡改功能，**先改文档、记本日志，再改代码**。  
> 用户可见快捷键按平台写：Mac 用 `Command` / `Option`；Windows 用 `Alt` / `Ctrl`。改一端勿动另一端默认行为。

---

## 2026-08-04

### 产品 / 文档

- **设置页改版**：快捷键集中成表（芯片展示、**按下自动识别**、行内恢复、还原全部快捷键）；能力开关 / 帮我对话偏好 / 语言 / 数据 / 权限分组。即刻对话 Mac 触发键三选一（右 Command 默认 / 右 Option / Fn）。增强提示词本期不做。详见 `docs/design-settings-shortcuts.md`、`docs/design-voice-trigger.md`。
- **即刻对话触发键可选（Mac）**：设置里可选右 Command（默认）/ 右 Option / Fn；Windows 仍为 Alt。帮我对话双击与看屏幕组合键不随此项改动。详见 `docs/design-voice-trigger.md`。
- **看屏幕答案 HUD**：长文不再固定 20 秒就消失；按字数拉长停留（约 20–90 秒），鼠标悬停时暂停，移出后再宽限收起。详见 `docs/design-screen-ask.md`。
- **官网顶栏品牌锁**：左图形标 + 右「即刻对话」/ 其下驼峰 `TalkNow`。
- **品牌 Logo 换 A 方案**：气泡 + 声波（TalkNow）；统一 `resources/icon.png`、官网 `website/assets/icon.png`、安装包 `build/icon.*`、侧栏品牌标。详见 `docs/design-vi-ink-signal.md`。
- **官网订阅页展示**：套餐卡层次、积分总量、年付折算、扣费说明卡片化；同步状态不再误留「正在同步」。
- **Dock / 安装包图标**：主标圆角外去白底（透明），并加约 10% 透明留白，避免比系统图标显大；开发态红色 DEV 角标仅 dev 有。
- **官网加载卡顿**：内联 Logo 改用压缩 `icon-web.png`（避免每页重复 ~50KB×3）；订阅页默认不再写「正在同步」，拉 `/v1/plans` 带超时并静默回退到本地档位。
- **官网三页**：首页（现有单页保留）+ **订阅** + **帮助**；订阅页与 App「个人中心」套餐同源（`plan-catalog` + `/v1/plans`）。详见 `docs/design-marketing-site.md`。
- **换套餐**：已开通会员可升级 / 预约降级 / 续费；后台「会员变更」按动作改档位与积分（升级保留到期、默认补差额）。客户端套餐卡区分「升级到此档 / 申请换到此档 / 续费延长」。详见 `docs/design-membership.md`、`docs/ops-offline-membership.md`。
- **账号展示与昵称**：`GET /v1/me` 已有 `displayName`；新增 `POST /v1/me-save` 可改昵称。首页 / 个人中心 / 轨底展示已登录账号；个人中心可设置昵称。详见 `docs/design-membership.md`。
- **后台开单重构**：用户列表直接显示档位/到期；「开通会员」与「流量包充值」拆开；支持设到期日与积分发放方式。详见 `docs/ops-offline-membership.md`。
- **默认体验版**：注册/登录后若未购买付费档，自动落体验版订阅并发放体验积分；`/v1/me` 拉取时也会补齐。

## 2026-08-03

### 产品 / 文档

- **官方会员与统一积分**：双轨（BYOK 永久免费 + 官方免配 Key 扣积分）；首版线下收款 + 管理后台 + 薄代理（硅基流动）；在线支付后置。详见 `docs/design-membership.md`、`docs/ops-offline-membership.md`、`server/`、`website/pricing/`。
- **内部后台**：会员运营 + 知识库 + 产品规划任务看板，登录见 `server/.env`；入口 `/admin/`（`/ops` 跳转）。勿挂公开导航。
- **看屏幕提示音**：播报文案由「屏幕我看到了，你想让我做什么？」改为「我看到屏幕了，你想让我做什么？」。
- **英文品牌 TypeNow → TalkNow**：App 英文界面、`en-US` catalog、发版 `productEn`、安装包英文描述统一为 TalkNow；内部包名仍为 `typenow` / `com.typenow.app`。详见 `docs/design-i18n.md`、`docs/design-branding.md`。
- **宣传站换成 TalkNow 新站**：以 `website/`（原 `website-new/`）覆盖旧 TypeNow 站；英文品牌 TalkNow、域名 talknow.cn；默认中文。详见 `docs/design-marketing-site.md`、`website/README.md`。

## 2026-08-02

### 产品 / 文档

- **宣传站单页重写**：七区叙事（Hero → Promise → Modes → Trust → Flow → Download）；语音能力名统一为「即刻对话 / TypeNow」；场景并入四能力深讲，去掉重复场景/快捷键专章。详见 `docs/design-marketing-site.md`、`website/`。
- **宣传站「对号入座」**：四模式各自补充典型应用场景，方便访客对照用法。详见 `docs/design-marketing-site.md`、`website/`。
- **宣传站部署绕过 WAF**：独立 `*.js`/`*.css` 会被清空；新增 `website/deploy-inline-ftp.py` 内联后上传。
- **宣传站文案对齐产品**：首页改为四能力（含看屏幕答题）；Mac 快捷键改为右 Command；新增本机卖点段（联系人 / HUD+Esc / 模型）；能力句与 App `brand.*` 对齐。详见 `docs/design-marketing-site.md`、`website/`。

## 2026-08-01

### 产品 / 文档

- **Mac 快捷键统一右侧 Command**：单击/双击/看屏幕/答题/备用键均只认右 Command（需辅助功能；Electron 分不出左右故走键监听）。Mac 含 `Command` 的项不再注册 `globalShortcut`（避免左键也能触发）。默认 `右 Command+Shift+1/2`，避开浏览器标签键。
- **看屏幕答题**：从「看屏幕」细分；截整屏后只给正确答案。流程改为 **视觉模型读题 → 文字模型对照知识库作答**。知识库为 **Datawhale × 魔搭 Agent Engineer**（`resources/exam-knowledge-base.txt`）。详见 `docs/design-screen-ask.md`。
- **模型 429 限流**：请求失败时解析硅基等限流错误并友好提示；对 429 自动短暂重试。
- **硅基视觉推荐**：截图理解默认改为 `Qwen/Qwen3-VL-32B-Instruct`（文档/中文屏更稳；原 Kimi-Code / 8B 易读错题）。
- **硅基文字推荐**：回复生成默认改为 `deepseek-ai/DeepSeek-V4-Flash`（比 V3 更不易排队；V3 仍可用但常 429）。
- **Mac 播报音色**：`say -v Shelley` 会误选英文 Shelley；改为按 `zh_CN` 选完整音色名。默认优先经典「婷婷」（神经多语种 Shelley 听感常偏怪）。
- **播报改硅基 CosyVoice2**：看屏幕/答题等语音优先 `FunAudioLLM/CosyVoice2-0.5B`（复用硅基 Key）；失败再回退系统 TTS。
- **CosyVoice 降延迟**：流式边收边播（ffplay）；启动预热；去掉冗长指令前缀。看屏幕等播报一律 CosyVoice（不再短句回退婷婷）。
- **CosyVoice 再降感延迟**：固定短句本地缓存（二次起近乎瞬时）；看屏幕在截屏同时预取提示语；有 ffplay 时改 PCM 流式减少解码等待。说明：云端首包本身仍约 0.5s，流式只能边下边播，抹不平生成等待。
- **修复 CosyVoice EPIPE 崩溃**：ffplay 提前退出/Esc 打断时忽略 stdin 断管，不再弹出主进程异常框。
- **开发版程序坞角标**：Dock 用 `DEV`（中文「开发」在部分 macOS 上不显示）；附属窗恢复后会重新打角标。
- **移除蓝牙遥控**：删除自拍杆/远程键全部能力（设置项、学习按键、相关快捷键逻辑），不再占用任何媒体键或学习键码。

## 2026-07-29

### 产品 / 文档

- **Mac 默认快捷键改右 Command**：即刻对话 = 单击右侧 Command；帮我对话 = 快速双击右侧 Command（不再用左侧 Command）。Windows 仍为 Alt 单击/双击。

## 2026-07-28

### 产品 / 文档

- **取消音量键/F11·F12 抢占**：蓝牙遥控不再全局注册 VolumeUp/VolumeDown（Mac 上常对应 F11/F12）；遥控仅在「学习按键」后生效，默认关闭。
- **修本地套件一键安装（v0.5.7）**：打包缺 `sharp`/`libvips` 导致一点安装就崩；补齐依赖与发版校验，错误改为人话。详见 `docs/design-model-config.md`。
- **发版 v0.5.6**：多次触发功能后主窗被 HUD 藏掉导致程序坞消失的补全修复。
- **发版 v0.5.5**：缩小主窗口后再触发功能时，保留程序坞图标（HUD/录音窗不再把主窗弄丢）。
- **发版 v0.5.4**：Mac 关闭窗口改为缩到程序坞，避免「缩小后消失」。
- **发版 v0.5.3**：Mac 未签名包禁用会触发辅助功能弹窗的 API（uIOhook / System Events）；快捷键改用 Command+8/0/1。
- **发版 v0.5.2**：Mac 辅助功能勾选后提示重开（不再反复弹窗）；麦克风主动申请。同步宣传站更新日志并打安装包。

## 2026-07-27

### 产品 / 文档

- **发版 v0.5.1**：稳定与开发版标识；更新 `docs/releases.json` / 宣传站 Changelog / 安装包。约定：**每次功能更新后同步更新宣传站更新日志并出安装包**。

## 2026-07-26

### 产品 / 文档

- **系统测试缺陷修复**：按 `docs/qa/system-test-report-0.5.0.md` 修复 Esc 取消草稿、HUD 点击穿透/自动隐藏、答案 TTS 可 Esc、站语言链与 title/FOUC、对话空态文案与删除跳转等。
- **系统测试报告（v0.5.0）**：[`docs/qa/system-test-report-0.5.0.md`](qa/system-test-report-0.5.0.md)（用例 [`system-test-plan-0.5.0.md`](qa/system-test-plan-0.5.0.md)）。
- **看屏幕对话体验**：HUD 长答案可滚动；对话页列表更紧凑，右侧可打字/语音续问。详见 `docs/design-screen-ask.md`。
- **商用 UI + 宣传站 + 更新日志（v0.5.0）**：图标轨与指挥台；`website/` 部署到 lizhenning.com/other/typenow/（`?lang=zh|en`）；`docs/releases.json` 双端共用并含英文字段。详见 `docs/design-ui-commercial-v1.md`、`docs/design-marketing-site.md`、`docs/design-releases.md`。
- **Esc 取消（v0.4.1）**：语音 / 帮我对话 / 看屏幕进行中按 Esc 立刻停下。详见 `docs/design-esc-cancel.md`。
- **墨色信号 VI（v0.4.0）**：浅底墨黑 + 电青强调；App/托盘图标、窗口 UI、HUD、权限引导与安装包外观统一去紫。详见 `docs/design-vi-ink-signal.md`。
- **HUD 过程反馈（v0.3.6）**：看屏幕等长流程底部浮窗持续显示阶段与动效；撞车时重亮进度而非干瘪「还在忙」。详见 `docs/design-hud-progress.md`。
- **看屏幕语音播报**：优先用系统增强中文音色（Shelley/Sandy 等），语速略慢；旧「婷婷」垫底。
- **看屏幕快捷键（v0.3.5）**：默认改为 Command+1（Win+1）；Command+0 仍为帮我对话。
- **看屏幕快捷键（旧）**：曾尝试连点两次 Command+0，易与帮我对话冲突，已弃用。
- **看屏幕对话归档（v0.3.4）**：对话列表存截图与问答；可继续同一会话。详见 `docs/design-screen-ask.md`。
- **看屏幕问答（v0.3.3）**：全屏截图 + 语音提问 → HUD 回答。详见 `docs/design-screen-ask.md`。
- **中英文 i18n（v0.3.2）**：设置可选语言；产品名 即刻对话 / TypeNow。详见 `docs/design-i18n.md`。
- **Mac 权限引导 + 包名 typenow（v0.3.1）**：安装后首次打开分步授权；appId `com.typenow.app`；旧数据迁移。详见 `docs/design-permission-guide.md`。
- **能力更名 + 硬件键（v0.3.0）**：我来口喷→即刻对话，帮你口喷→帮我对话；内置隐藏快捷键 Command/Win+8（语音）、Command/Win+0（回复）。
- **品牌更名**：产品名 **口喷输入 → 即刻对话**（v0.2.9）。详见 `docs/design-branding.md`。

## 2026-07-19

### 产品 / 代码

- **性格包 W2 落地（v0.2.7）**：设置「默认性格」；内置主播维系免费包；三场景关键词匹配注入 + HUD；详见 `docs/design-persona-pack-w2.md`。
- **性格包 W2 规划（全免费）**：定稿 `docs/design-persona-pack-w2.md`。
- **帮你口喷 · 去除 AI 味儿（v0.2.6）**：设置页可开关（默认开）；开启时强化真人私聊语气约束。详见根目录 `CHANGELOG.md`。
- **Mac 菜单栏托盘（v0.2.4）**：补回右上角「口」图标与快捷菜单（迁移时漏实现）。详见根目录 `CHANGELOG.md`。
- **帮你口喷截屏省 token（v0.2.3）**：ROI 裁剪聊天区 + 1024 限宽 + JPEG；联系人名走窗口标题。详见根目录 `CHANGELOG.md`。
- **Mac 辅助功能反复弹窗（v0.2.2）**：未授权时不启动 uIOhook / osascript / active-win；设置页展示权限状态与重试；授权后自动启用快捷键。详见根目录 `CHANGELOG.md`。

## 2026-07-18

### 文档

- **Windows 帮你口喷识别修复**：Win 改为优先截前台聊天窗口（非整屏）；窗口标题解析联系人名作为兜底，解决「未能识别联系人名称」。
- **CI**：GitHub Actions 构建 Node 20 → 22，消除 runner 弃用警告。
- **模型页**：默认三槽对齐硅基流动在线配置；槽位状态展示「服务商 · 模型名」；测试结果改在对应「测一下」按钮旁提示。
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
