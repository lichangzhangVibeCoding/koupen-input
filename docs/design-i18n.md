# 多语言（i18n）设计 — TalkNow / 即刻对话

> 状态：**已落地（v0.3.2 基础）**；英文品牌 **TalkNow**（2026-08-03）  
> 目标：长期支持多语言；首期 **中文（zh-CN）+ 英文（en-US）**。

## 产品名

| 语言 | 产品显示名 | 包名 / appId |
|---|---|---|
| 中文 | **即刻对话** | `typenow` / `com.typenow.app`（内部不变） |
| English | **TalkNow** | 同上 |

能力对外名随语言切换（须与一句话解释成对出现）：

| # | 能力 | zh-CN | en-US |
|---|---|---|---|
| 1 | 即刻对话 | 即刻对话（点按贴口述） | TalkNow (tap = verbatim) |
| 2 | 与AI对话 | 与AI对话（按住增强提示词，与即刻对话同一键） | Talk to AI (hold = enhance prompt, same key) |
| 3 | 帮我对话 | 帮我对话 | Reply Assist |
| 4 | 看屏幕 | 看屏幕 | Screen Ask（含口述「这道题选什么」答题） |

对外口号：四个能力，一个助手 / Four capabilities, one assistant。答题并入 #4，不是第五能力。

## 原则

1. **单一文案源**：`src/shared/i18n/`，main 与 renderer 共用 `t()`。  
2. **设置项 `locale`**：`system` | `zh-CN` | `en-US`；默认 `system`（按系统语言，`zh*` → 中文，其余 → 英文）。  
3. **禁止**在 UI / HUD / 托盘硬编码用户可见中文或英文（LLM 系统提示词、微信窗口标题启发式除外，见下）。  
4. **品牌**：`getBrand()` / 兼容用的 `BRAND` getter，随当前 locale 变化。  
5. **安装包 `productName`**：仍可用中文「即刻对话」服务国内分发；英文界面内显示 TalkNow。系统隐私列表名称以 Bundle 名为准，引导文案用 `brand.name`。  
6. **扩展新语言**：在 `locales/` 增加同结构 catalog + 注册到 `catalogs`，无需改调用方。

## 目录

```
src/shared/i18n/
  types.ts          # LocalePreference / ResolvedLocale
  catalogs/zh-CN.ts
  catalogs/en-US.ts
  index.ts          # setLocale / getLocale / t / getBrand
```

## 不纳入 UI i18n（一期）

- LLM 生成回复 / 提示词增强的系统提示（回复仍以中文私聊语境为主；增强提示词按用户口述语言输出。后续可按联系人语言或设置拆 `prompts/`）  
- 微信 / QQ 窗口标题匹配关键词  
- 性格包场景触发词（中文聊天场景）  
- 文档 `docs/*.md`（可另开中英文档）

## 设置与同步

- 设置页「语言 / Language」切换 → `saveSettings` → main `applyLocale` → 刷新托盘；renderer Context 重渲染。  
- 首次启动：读设置 → `resolveLocale` → `setLocale`。

## 验收

- [ ] 系统语言英文时，默认 UI 为 TalkNow 英文  
- [ ] 设置强制中文 / 英文立即生效（含侧栏、首页、托盘）  
- [ ] 权限引导与 Mac 权限文案随语言切换  
