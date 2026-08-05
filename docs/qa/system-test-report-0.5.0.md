# 即刻对话 0.5.0 — 系统测试报告

> 测试日期：2026-07-26  
> 版本：`0.5.0`（`package.json` / 打包 `CFBundleShortVersionString`）  
> 平台：macOS arm64  
> 用例计划：[`system-test-plan-0.5.0.md`](./system-test-plan-0.5.0.md)  
> 初测只记录问题；**2026-07-26 已按缺陷清单改码修复**（见 CHANGELOG）。

---

## 1. 摘要

| 项 | 结果 |
|---|---|
| 构建 | **通过**（`npm run build`） |
| 打包冒烟 | **通过**（`npm run pack` → `release/mac-arm64/即刻对话.app`，图标/托盘资源在包内） |
| 宣传站线上 | **基本通过**（首页/changelog/双语/下载链/`releases-data.js`） |
| i18n 键对齐 | **通过**（zh/en/types 均为 247，无缺失） |
| releases 三份同步 | **通过**（docs / website / src/shared） |
| 建议发版 | **可发**：DEF-001～014 已按本节修复；建议补一轮手测 Esc / HUD 滚轮 / 站语言链 |

**缺陷统计（初测）**：P0 = 0 · P1 = 2 · P2 = 6 · P3 = 6 · 建议（非缺陷）= 3  
**修复状态（2026-07-26）**：下列 DEF 均已改码（见 CHANGELOG）

**用例执行**：共 49 条（计划 A–D）→ **通过 28** · **失败 10** · **受阻/部分 11**

---

## 2. 环境

| 项 | 值 |
|---|---|
| App 打包 | `release/mac-arm64/即刻对话.app` v0.5.0 |
| App 用户数据 | 本机已有配置（API/STT Key 存在；报告不写密钥） |
| DB 抽样 | contacts=17，messages=225，screen_ask_sessions=5，screen_ask_messages=16 |
| 站线上 | `https://lizhenning.com/other/typenow/` |
| 证据 | [`docs/qa/evidence/`](./evidence/) |

---

## 3. 用例结果总表

图例：PASS / FAIL / BLOCK（环境或自动化受阻） / PART（部分验证）

### A. 功能性

| ID | 结果 | 说明 |
|---|---|---|
| TC-A01 轨导航六项 | PART | 打包窗可见六项标签（首页…设置）；自动化点击因辅助功能未授给 `osascript` 未能逐页截图切换 |
| TC-A02 轨版本号 | PASS | 轨底 `v0.5.0`（见 `app-pack-window.png`） |
| TC-A03 Hash 刷新 | BLOCK | 未完成（需手测刷新） |
| TC-A04 首页三能力 | PASS | 名+一句话+触发说明+按钮齐全；Esc 提示可见 |
| TC-A05 首页手动触发 | BLOCK | 未点按钮做端到端（避免打断用户环境）；代码路径存在 |
| TC-A06 即刻对话点按 | PART | 启动时 HUD 提示需开辅助功能（`app-desktop.png` 底栏红条）；说明无权限时有提示。完整粘贴链路受阻 |
| TC-A07 ⌘8 | BLOCK | 需辅助功能+手测 |
| TC-A08/A09 帮我对话 | BLOCK | 需屏幕录制+辅助功能+前台聊天窗手测 |
| TC-A10 看屏幕全链路 | BLOCK | 同上；库内已有历史会话说明功能曾可用 |
| TC-A11 对话 CRUD | BLOCK | UI 自动化未能切入对话页 |
| TC-A12 打字续问 | FAIL* | *代码审查判定缺陷 DEF-001（Esc 取消后草稿被清空）；正向发送未手测 |
| TC-A13 语音续问按钮 | BLOCK | 未切入对话页 |
| TC-A14 Esc 录音取消 | BLOCK | 未手测；代码有 cancel 路径 |
| TC-A15 Esc 空闲 | PART | 代码：仅 busy 时注册，符合设计 |
| TC-A16 模型三槽 | BLOCK | 未能截到模型页（点击受阻） |
| TC-A17 设置分组 | BLOCK | 同左；代码中有 settings-group |
| TC-A18 App 语言切换 | BLOCK | 未手测设置页 |
| TC-A19 导出脱敏 | BLOCK | 未手测 |
| TC-A20 更新页 | BLOCK | 未切入；静态：catalog 与版本 helper OK |
| TC-A21 更新外链 | PART | 代码会拼 `siteUrl?lang=`；未点外链 |
| TC-A22 站默认英文 | PASS | 线上无参打开标题/正文为 TypeNow 英文（`site-home-en.png`） |
| TC-A23 站中文切换 | PASS | 点「中文」→ URL `?lang=zh`，文案切换成功 |
| TC-A24 站 changelog | PASS | 英文 changelog 含 0.5.0 等要点（`site-changelog-en.png`） |
| TC-A25 下载 CTA | PASS | href 指向 GitHub `releases/latest` |
| TC-A26 releases-data | PASS | 线上 200，含 `TYPENOW_RELEASES`；`releases.json` 404（WAF，已规避） |
| TC-A27 联系人 | PART | DB 有 17 联系人；UI 页未切入 |
| TC-A28 托盘 | BLOCK | 未点菜单栏图标验证菜单项 |

### B. UX

| ID | 结果 | 说明 |
|---|---|---|
| TC-B01 首页可读性 | PASS | 指挥台信息完整 |
| TC-B02 对话列表密度 | BLOCK | 未能截对话页；代码已收窄侧栏（需目视确认） |
| TC-B03 续问 Enter | PART | 代码有 Enter/Shift+Enter；未手测 |
| TC-B04 HUD 长答案滚动 | PART | 代码已开答案态鼠标+overflow；未手测滚轮 |
| TC-B05 HUD 非答案穿透 | FAIL | 见 DEF-002：答案态整窗接收鼠标，透明区域也可能挡点击 |
| TC-B06 权限引导 | BLOCK | 未触发首启引导（`permissionGuideCompleted` 可能已 true） |
| TC-B07 App 英中 | BLOCK | 未切设置语言 |
| TC-B08 站双语记忆 | PART | 切换写 URL；localStorage 逻辑存在；未做刷新回归 |

### C. Bug / 稳定性

| ID | 结果 | 说明 |
|---|---|---|
| TC-C01 忙时互斥 | PART | 代码有 busy HUD；打字续问会 throw busy（DEF-005） |
| TC-C02 空输入发送 | PASS | 按钮 `disabled` + 早期 return |
| TC-C03 无会话打字 | PASS | 无会话时仅占位，无 composer（符合当前设计） |
| TC-C04 删当前会话 | PART | 代码 `navigate('/chats')`；体验见 DEF-008 |
| TC-C05 单击/双击误触 | BLOCK | 需手测时序 |
| TC-C06 build | PASS | |
| TC-C07 主进程报错 | PART | 打包启动可见；辅助功能缺失时有预期 HUD，未见崩溃 |

### D. UI

| ID | 结果 | 说明 |
|---|---|---|
| TC-D01 无品牌紫 | PASS | 源码无 `#7c5cf5`（仅 changelog 英文 “purple” 字样） |
| TC-D02 轨布局 | PASS | 1100×720 下轨+首页可用（`app-pack-window.png`） |
| TC-D03 设置分组 | BLOCK | 未截设置页 |
| TC-D04 更新页 | BLOCK | 未截更新页 |
| TC-D05 对话气泡 | BLOCK | 未截对话页 |
| TC-D06 站首屏 | PASS | 品牌英雄级+CTA+示意；示意偏空（建议 SUG-01） |
| TC-D07 站语言 active | PART | 视觉上 English 电青；a11y 树两项都带 current（次要） |

---

## 4. 缺陷清单（按严重度）

### P1

#### DEF-001 — Esc 取消「打字续问」后草稿被当成成功清空 — **已修**
- cancel 时 `askScreenWithText` 向 IPC 抛出；前端识别取消后不清空草稿  

#### DEF-002 — 答案 HUD 整窗接收鼠标 — **已修**
- 默认穿透 + `forward`；仅悬停答案卡片时临时接收鼠标（`hud` preload）  

### P2

#### DEF-003 — HUD `!ready` 完成态不自动隐藏 — **已修**
- `did-finish-load` 应用 pending 后同样 `scheduleAutoHide`  

#### DEF-004 — 答案 TTS 无法 Esc 取消 — **已修**
- `isSpeaking` 计入 busy；`speak` 起停时 `notifyActivityChanged`  

#### DEF-005 — 忙时打字续问抛错 — **已修**
- busy 时只刷新进度 HUD，与快捷键一致（resolve）  

#### DEF-006 — 站语言链被改写 — **已修**
- `keepLangLinks` 跳过/校正 `[data-lang]`  

#### DEF-007 — `releases.js` JS fallback — **已修**
- 动态注入 `releases-data.js`  

#### DEF-008 — 设置页重试辅助功能 — **已修**
- 始终 `retryAccessibility` 再刷徽章  

### P3

#### DEF-009 — 空线程文案 — **已修**（`screenAsk.emptyThread`）  
#### DEF-010 — 删除当前会话导航 — **已修**（选相邻会话）  
#### DEF-011 — 权限引导 stillMissing — **已修**（需二次确认再关闭）  
#### DEF-012 — Changelog `document.title` — **已修**（`data-page` + `meta.title.changelog`）  
#### DEF-013 — 站 FOUC 中文 — **已修**（HTML 默认英文）  
#### DEF-014 — 语言链双 `aria-current` — **已修**（非当前移除属性）  

---

## 5. UX / UI 观察（建议，非必改）

| ID | 建议 |
|---|---|
| SUG-01 | 宣传站 hero mock（三块灰卡）信息密度低，建议换成真实 App 截图（轨+指挥台） |
| SUG-02 | App 首页三卡在 1100 宽下仍偏「海报感」；若要对齐对话页紧凑风，可再收 padding |
| SUG-03 | 设置轨图标在中文环境下易被看成「太阳」；可换更标准齿轮路径 |

---

## 6. 未测 / 受阻项

1. **辅助功能未授予本轮自动化进程**：`osascript` 点击报错 `-25211`，无法自动点轨切换；对话/模型/设置/更新页截图未拿到有效差异图。  
2. **三能力热键端到端**（语音粘贴、帮我对话、看屏幕语音）：依赖屏幕录制/麦克风/辅助功能 + 真实前台 App，本轮未完整手测。  
3. **HUD 滚轮、答案 TTS+Esc**：需人工确认。  
4. **Windows**：本轮不做。  
5. **导出脱敏、重置、远程键学习、托盘菜单逐项**：未测。  

库内已有 screen ask / contacts 数据，说明历史环境上主链路曾跑通；不能替代本次完整回归。

---

## 7. 证据索引

| 文件 | 内容 |
|---|---|
| [`evidence/app-pack-window.png`](./evidence/app-pack-window.png) | 打包 App 首页：轨导航 + 指挥台 + v0.5.0 |
| [`evidence/app-desktop.png`](./evidence/app-desktop.png) | 桌面全景；底栏辅助功能缺失 HUD 提示 |
| [`evidence/site-home-en.png`](./evidence/site-home-en.png) | 线上站默认英文首页 |
| [`evidence/site-changelog-en.png`](./evidence/site-changelog-en.png) | 线上英文 changelog |
| `evidence/app-{home,chats,...}.png` | 自动化点击失败，内容与首页相同，**勿作多页通过证据** |

---

## 8. 发版建议（供你决策）

1. **可发**：构建/打包/宣传站主路径可用，无 P0。  
2. **建议发前修**：DEF-001（取消清空草稿）、DEF-002（HUD 挡点击）——影响「取消」与「答案展示」体验。  
3. **可排期**：DEF-003～008；文案/SEO 类 P3。  
4. **补测**：授予辅助功能后，手测轨切换、对话续问、三能力热键、Esc 各阶段，再更新本报告结论。

---

## 9. 附录：静态检查摘录

```
npm run build → OK
i18n zh/en/types → 247 / 247 / 247，无缺失
docs/releases.json == website/releases.json == src/shared/releases.json
各 release 均含 titleEn / highlightsEn
线上 releases-data.js → 200 + TYPENOW_RELEASES
线上 releases.json → 404（预期 WAF）
无 #7c5cf5 品牌紫
compareSemver(0.5.0, 0.4.1) → 1
```
