# 竞品专项：DoNotType

> 仓库：[bojieli/DoNotType](https://github.com/bojieli/DoNotType)（MIT）  
> 管理后台种子 slug：`donottype`

## 1. 定位

BYOK、无中转服务器；macOS / Windows / Android / iOS。与 TalkNow **语音输入 + 读屏上下文** 层重叠最高，但不是四条能力套件。

## 2. Pipeline（架构摘要）

```
hotkey
  → Phase1: 焦点捕获 (~20ms)
  → record
  → Phase2: AX/UIA + screenshot (500ms cap)
  → context-first LLM（先上下文后音频）
  → paste（Dictate 默认 verbatim / Rewrite 可选）
```

- 四端共享 `prompt/` 契约
- 个人词典 + eval 驱动替换测试
- CLI `dnt`

详见上游 `docs/ARCHITECTURE.md`。

## 3. 与 TalkNow 对照

| 维度 | DoNotType | TalkNow |
|------|-----------|---------|
| 核心路径 | dictation + 屏幕上下文 | 四条能力 + 场景包 |
| 发送行为 | paste | paste，**不代发** |
| 会员 | BYOK | BYOK + 统一积分官方 |
| 差异化 | 低延迟焦点/读屏、词典 | 联系人/性格包、看屏/答题、场景路由 |

代码参照：

- 语音主路径：`src/main/voice-input.ts`
- 截图/读屏：`src/main/capture.ts`
- 场景增强：`docs/design-prompt-enhance.md`

## 4. 可借鉴 vs 不跟进

**可借鉴（已 seed 进需求池）**

- Phase1/Phase2 延迟对标与文档化（P2）
- 个人词典 / 替换词表 UX 调研（P2）

**不盲目跟进**

- 纯 Agent 壳或 marketplace
- 移动端为主而牺牲桌面全局热键体验
- 自动发送消息

## 5. 后续 deep_dive

在管理后台为该竞品追加 `deep_dive` 报告，更新 `key_findings` 与需求池；满 30 天写 `periodic` 跟踪 GitHub release。
