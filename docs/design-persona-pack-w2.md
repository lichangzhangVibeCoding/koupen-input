# 性格包 · W2 规划（全免费阶段）

> 状态：**W2 已落地（全免费）**  
> 前提：当前产品全免费；不做支付 / License / 兑换码  
> 目标：让「帮你口喷」在命中高价值场景时，按**场景技巧**生成回复（先做主播向 3 个王牌场景）  
> 原则：先文档后代码；可卖差异在「包」，不先训 LoRA

---

## 0. 和 W1 的关系（本阶段合并交付）

全免费阶段不单独拉一个「只能选性格、没有场景」的 W1 版本。  
**W2 一次做完最小闭环**，内含 W1 必需底座：

| 能力 | 本阶段是否做 | 说明 |
|------|-------------|------|
| 选择默认性格包 | ✅ | 设置里：`通用` / `主播维系（免费）` |
| 包内默认人设 + 硬规则注入 | ✅ | 无联系人人设时也能有行业默认语气 |
| 场景匹配 + 技巧注入 | ✅ **本周主角** | 3 个王牌场景 |
| 支付 / 加密包 / 商城 | ❌ | 明确不做 |
| LoRA / 微调模型 | ❌ | 明确不做 |

对外仍可叫「主播性格」；对内实现名：**PersonaPack + Scenario**。

---

## 1. W2 成功标准（做完算过）

1. 设置页能选 **默认性格：通用 | 主播维系（免费）**，保存后立即生效。  
2. 选「主播维系」时，帮你口喷 prompt 带上包的 `defaultPersona` + `hardRules`。  
3. 最近对话命中下列任一场景时，HUD 或日志可感知「已套用场景技巧」（至少开发期 `console` / 可选 HUD 一句）：  
   - **约吃饭 · 想拒**  
   - **要微信/联系方式 · 想拒或缓**  
   - **约见面 · 想拒**  
4. 未命中场景时：行为与现在一致（人设 + 历史 + 去 AI 味），不乱套剧本。  
5. 联系人详情里手写的人设 **优先于** 包默认人设（包只补行业底色与场景）。  
6. 全流程无联网鉴权、无付费墙。

---

## 2. 产品交互（免费版）

### 2.1 设置页（帮你口喷区块）

新增：

```
默认性格
○ 通用（不注入行业包）
● 主播维系（免费）— 含约饭/要联系方式/约见面等婉拒技巧
```

说明文案（白话）：

> 选「主播维系」后，帮你口喷会按主播常用边界来回；若对方在约吃饭、要微信、要约见面，会自动套用对应话术技巧。联系人里单独写的人设仍然优先。

不展示价格、不展示「解锁」。

### 2.2 运行时（用户无感为主）

- 正常双击帮你口喷即可。  
- 可选（推荐做）：命中场景时 HUD 短提示  
  - `帮你口喷：已套用「约吃饭婉拒」技巧`  
  - 方便内测验证，也增强「包有用」的感知。  
- 不做「场景选择器」弹窗（打断粘贴节奏）。

### 2.3 联系人详情

- **不改版式**（W2 不做大改）。  
- 规则写进文档即可：`personaPrompt` 非空 → 用联系人人设；包的 defaultPersona 仍可作为「补充行业约束」弱注入（见 §5）。

---

## 3. 数据包：内置主播免费包

### 3.1 文件位置

```
src/shared/persona-packs/streamer-free-v1.ts
```

（或同级 `streamer-free-v1.json` + TS 类型；优先 TS 便于类型检查。）

### 3.2 类型（冻结）

```ts
export type PersonaPackId = 'none' | 'streamer-free-v1'

export interface PersonaPack {
  id: PersonaPackId
  name: string
  blurb: string
  version: string
  defaultPersona: {
    title: string
    prompt: string
    tags: string[]
  }
  hardRules: string[]
  scenarios: Scenario[]
}

export interface Scenario {
  id: string
  name: string
  /** 用于 HUD */
  shortName: string
  /** 关键词（对方或近期对话里出现） */
  triggers: string[]
  /** 负向词：出现则降权/否决，避免误伤 */
  excludeTriggers?: string[]
  goal: string
  tactics: string[]
  exampleReplies: string[]
  antiPatterns: string[]
  /** 匹配分权重，默认 1 */
  weight?: number
}
```

### 3.3 设置字段

`AppSettings` 新增：

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `personaPackId` | `PersonaPackId` | `'none'` | `'streamer-free-v1'` 启用主播包 |

旧配置无此字段 → `normalizeSettings` 填 `'none'`（不强迫所有人变主播）。

---

## 4. W2 三个王牌场景（内容规格）

每个场景必须写满：`triggers` / `goal` / `tactics`(≥5) / `exampleReplies`(≥4) / `antiPatterns`(≥3)。

### 4.1 `invite-dinner-refuse` — 约吃饭 · 想拒

| 项 | 内容要点 |
|----|----------|
| **goal** | 拒绝线下吃饭，不伤对方面子，保留线上互动/打赏关系 |
| **triggers** | 吃饭、吃顿饭、请你吃、出来吃、约饭、饭局、聚餐、请吃饭、宵夜（视语境）… |
| **exclude** | 吃什么（问外卖）、吃了吗（寒暄）— 需结合「出来/见面/请你」等加强条件 |
| **tactics** | 先感谢；用直播排期/身体累/公司或家人规矩软拒；给线上替代（连麦、点歌、下次活动）；不给具体餐厅/时间；不说「讨厌你」 |
| **antiPatterns** | 冷漠「不去」；假答应；索要打赏才肯见；讲大道理教训对方 |

### 4.2 `ask-contact-defer` — 要微信/联系方式 · 想拒或缓

| 项 | 内容要点 |
|----|----------|
| **goal** | 不轻易给私人微信号/电话；可缓、可引导公域（直播间/粉丝群） |
| **triggers** | 微信、加你、留个号、手机号、怎么联系、私聊方式、VX、wx、双微… |
| **tactics** | 强调直播间互动更方便；公司不让随意外泄；已有粉丝群/客服；可「回头直播间说」模糊化 |
| **antiPatterns** | 直接甩真实微信号；厉声指责；完全已读不回式冷暴力文案 |

### 4.3 `meetup-refuse` — 约见面 · 想拒

| 项 | 内容要点 |
|----|----------|
| **goal** | 拒绝单独见面，边界清晰但语气仍甜/稳 |
| **triggers** | 见面、出来玩、见一面、线下、到播、接你、上门、开房（若出现则更强调安全边界）… |
| **tactics** | 感谢心意；安全与规定；直播忙；把期待转到下场直播/活动；必要时明确「暂不见面」 |
| **antiPatterns** | 暧昧吊着不拒；恐吓式拒绝；透露住址行程 |

**匹配优先级（同时命中时）：**  
`meetup-refuse` > `invite-dinner-refuse` > `ask-contact-defer`  
（见面 > 吃饭 > 联系方式；实现用 `priority` 数值。）

---

## 5. 场景匹配算法（W2：规则即可）

**不做** 额外 LLM 分类调用（省 token、稳、好测）。

### 5.1 输入文本

取 `history` 最近 **N=8** 条，拼成一段 `haystack`（优先给 `role=them` 的内容更高权重：them 计 2 次，me 计 1 次，或只扫 them 最近 6 条）。

**推荐 W2 实现：只扫对方（them）最近 6 条**，降低「我自己在说吃饭」误触。

### 5.2 计分

对每个 scenario：

```
score = 命中的 trigger 个数 × weight
若命中任一 excludeTriggers → score = 0（或 -99）
```

取 `score > 0` 中最高者；并列按 `priority`。  
若最高分 < 1 → **无场景**。

### 5.3 加强条件（约饭防误伤）

对 `invite-dinner-refuse`：仅有「吃了吗 / 吃饭了没」且无「出来|见面|请你|约」→ 不命中。  
实现：该场景 `requireAny: ['出来','见面','请','约','一起']` 与 triggers 同时满足（triggers 命中餐饮类 + requireAny 命中邀约类）。

---

## 6. Prompt 注入顺序（改 `generateReply`）

最终 user/system 块顺序建议：

1. 角色与硬性输出格式（现有）  
2. **去 AI 味儿**（现有开关）  
3. **性格包 hardRules**（若 pack ≠ none）  
4. **性格包 defaultPersona**（若 pack ≠ none；若联系人 `personaPrompt` 非空，标注「以下为行业补充，联系人人设优先」）  
5. **联系人人设 / 画像 / 关键事实**（现有）  
6. **【当前场景技巧】**（若命中）：`name + goal + tactics + examples + antiPatterns`  
7. 最近对话  
8. 「请生成下一条…」

场景块示例标题：

```
【当前命中场景：约吃饭婉拒】
目标：…
技巧：…
可参考语气（勿照抄）：…
千万不要：…
```

Temperature：保持与去 AI 味逻辑一致；命中场景时不必再升高。

---

## 7. 代码改动清单（实现时按此拆 PR）

| # | 文件 | 改动 |
|---|------|------|
| 1 | `src/shared/persona-packs/types.ts` | 类型 |
| 2 | `src/shared/persona-packs/streamer-free-v1.ts` | 三场景内容 + 默认人设 |
| 3 | `src/shared/persona-packs/index.ts` | `getPack(id)` / `listPacks()` |
| 4 | `src/shared/persona-packs/match-scenario.ts` | 纯函数匹配，可单测 |
| 5 | `src/shared/types.ts` + `user-config.ts` | `personaPackId` |
| 6 | `src/main/llm.ts` | `generateReply` 注入 |
| 7 | `src/main/pipeline.ts` | 可选：把命中场景 shortName 传给 HUD |
| 8 | `src/renderer/.../SettingsPage.tsx` | 默认性格单选 |
| 9 | `docs/CHANGELOG.md` + 根 `CHANGELOG.md` | 记一笔 |
| 10 | （可选）`src/shared/persona-packs/match-scenario.test.ts` | 关键词用例 |

**不改**：支付、账号、托盘、截屏 ROI。

---

## 8. 测试用例（手工 / 单测共用）

| 对方近句 | 期望场景 |
|----------|----------|
| 「姐姐周末出来吃顿饭呗」 | invite-dinner-refuse |
| 「加个微信方便聊」 | ask-contact-defer |
| 「我想见你一面」 | meetup-refuse |
| 「你吃了吗」 | 无 |
| 「今晚播吗」 | 无 |
| 「出来见面吃个饭」 | meetup-refuse（优先级高于约饭） |
| 仅我方历史在说「吃饭」 | 无（只扫 them） |

生成抽检（人工）：  
拒约要有温度、不假答应、不去 AI 长文、不泄露「我是主播包设定」。

---

## 9. 排期（全免费、一人可推）

| 日 | 产出 |
|----|------|
| D1 | 类型 + `streamer-free-v1` 三场景文案定稿 + 设置项 UI |
| D2 | `match-scenario` + `generateReply` 注入 + HUD 提示 |
| D3 | 用例打磨 triggers/requireAny；去 AI 味叠加实机测；打一版 DMG 内测 |

总工期约 **2～3 天** 可出可测包。

---

## 10. 明确不做（防 scope 膨胀）

- 付费墙、包商城、云端下发包  
- 用户自定义场景编辑器（可放 W3）  
- 第二行业包（电商客服等）  
- 用视觉模型做场景分类  
- 微调 / LoRA  
- 改品牌文案回「榜一大哥」话术堆砌（边界助手定位，技巧写婉拒与安全）

---

## 11. W3 预告（本文不实施）

- 用户导入自己的 `.koupenpack.json`  
- 场景库扩到 15～30 个  
- 设置里「命中场景时 HUD 提示」开关  
- 若免费用户增长稳定，再谈会员与付费包（与 W2 解耦）

---

## 12. 开发入口一句话

> 实现 W2 = **内置免费主播 PersonaPack + 关键词场景匹配 + generateReply 注入 + 设置页选择**；支付为零。

确认本文后即可按 §7 清单改代码。
