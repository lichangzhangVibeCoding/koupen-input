# 即刻对话 · 语音触发键（可选）

> 状态：**已落地**  
> 按住增强提示词：见 `docs/design-prompt-enhance.md`（点按贴口述，可选去水词/改错别字；按住 ≥400ms 才增强）。

## 目标

Mac 上「即刻对话」的点按触发键可三选一，默认保持现网行为。同一颗键支持 **点按贴原话（即刻对话） / 按住增强（与AI对话）**，不另开快捷键。

| 选项 | 对外名 | 说明 |
|---|---|---|
| `rightCommand`（默认） | 右 Command | 与现网一致：单击开始/结束录音 |
| `rightOption` | 右 Option | 单击右 Option；不与左 Option 混淆 |
| `fn` | Fn（地球键） | 单击 Fn；依赖辅助功能 + uIOhook，部分外接键盘可能收不到 |

Windows 仍为 **Alt**（设置页不展示上述三选一）：点按贴原话，按住 ≥400ms 增强。

## 与其它能力的关系

| 能力 | 键 | 是否随语音触发改动 |
|---|---|---|
| 即刻对话（单击贴口述） | 用户所选触发键 | 是 |
| 与AI对话（按住增强） | 同一触发键 | 是（两种手势同一键） |
| 帮我对话（双击修饰键） | 仍为右 Command / Win Alt | **否**（热键设置独立） |
| 看屏幕 / 答题 / 硬件备用 | 仍为右 Command 组合 | **否** |

当语音触发仍是「右 Command」时：单击 / 双击 / 按住共用同一键。短间隔内第二次**点按** = 帮我对话；**按住 ≥400ms** = 提示词增强，并取消本会单击/双击。点按贴原话的开始/结束逻辑与现网相同。

当语音触发改成 Option / Fn 时：该键负责语音点按与按住增强；右 Command 的双击与组合键行为不变；单独点一下右 Command **不再**开录音。

硬件备用 `右 Command+8` / `Win+8` **仍为点按原话**，不走按住增强。Windows Alt 同样：点按原话、按住增强。

## 设置入口

设置 → **能力开关**（即刻对话旁）：

1. 启用开关  
2. **触发键**（快捷键表；仅 Mac）：右 Command / 右 Option / Fn  
3. 一句话提示：选 Fn 时注明部分键盘可能无效  
4. **自动去除水词**（默认开）：去掉嗯、啊、呃、那个、就是等口语填充，保留实义；本地规则，不调文字模型  
5. **自动改错别字**（默认关）：按上下文修正转写错字（含中英混听，如 茶是→茶室），不扩写、不编造；会多等一轮回复模型，需要时在设置里开  
6. **云端二次校对**（默认关，仅本地听写打开后出现在设置里）：本地先贴，再用官方 SenseVoice 重转（扣语音积分）

听写引擎不在设置里改：模型 → **能力状态 · 语音** → **本机语音**（默认关）。有本机 Zipformer 时可开，边说边出字、不扣积分；关掉则录完走官方文件 ASR。  

首页指挥台 / 帮助页的快捷键文案随所选触发键更新。

## 转写后处理（点按原话 / 按住增强共用）

点按仍是「口述贴进输入框」，但可选做**校对**，不是提示词增强：

| 开关 | 默认 | 行为 |
|---|---|---|
| `voiceStripFillersEnabled` | **开** | 去掉无意义水词；拿不准则保留；不调模型 |
| `voiceFixSttTyposEnabled` | **关** | 按上下文改 STT 错字；禁止发明新内容；开了会多一次 `reply` 调用 |

流水线（`src/main/voice-input.ts`，STT 之后）：

1. 两开关都关 → 直接贴 STT 原文（点按）或原文进增强（按住）  
2. 只开水词 → 本地规则去掉填充词，**不调文本模型**  
3. 开了改错别字（可同时开水词）→ **一次**文字槽调用（`chatCompletion` / 回复模型），提示词收紧：只校对、输出同一句、不扩写。失败则回退到规则清洗或原文，不阻断粘贴  

按住增强：校对发生在 **STT 之后、`rewriteSpokenAsAiPrompt` 之前**，便于场景路由吃到正确词（如茶室而不是茶是）。不要把具体错词对写进场景包。

会员：不新增能力码。只开水词不扣文本积分；改错别字走现有 `reply` 槽（官方会员扣 `replyCredits` 一次）。BYOK / 本地不扣官方积分。详见 `docs/design-membership.md`。

## 技术要点

- 配置字段：`voiceTrigger: 'rightCommand' | 'rightOption' | 'fn'`，默认 `rightCommand`  
- 听写引擎：`voiceAsrMode: 'local-stream' | 'cloud'` 默认 `cloud`；`voiceCloudProofread` 默认 `false`  
- 转写校对：`voiceStripFillersEnabled` 默认 `true`，`voiceFixSttTyposEnabled` 默认 `false`；写入 `settings.json`  
- 监听仍走 `modifier-tap`（uIOhook）；Fn 使用 libuiohook `VC_FUNCTION`（`0x020E`）  
- 保存设置后立即按新触发键生效，无需重装  
- 按住增强的 400ms 判定、与双击的互斥见 `docs/design-prompt-enhance.md`

## 转写链路

即刻对话要的是口述贴字。听写默认仍是**官方/自配云端文件 ASR**（录完再转）。模型页能力状态语音卡可打开「本机语音」：有本机 Zipformer 时走 sherpa-onnx **中英双语** 2023-02-20 int8，16kHz PCM 边录边解码。边说边出字（beam search 会自己改前面几个字）；停顿约 1 秒切一句并补标点、重置解码器，所以可以连续说很久；松手后短句会整段再解一次，HUD 若有改动会闪一下纠正再贴上，**不等硅基**。标点另下一套约 76MB 的 CT-Transformer（中英），Zipformer 词表本身不含逗号句号。不经会员 PHP、不扣 `voiceCredits`。首次打开该开关时下载模型到 `userData/models/asr-stream/`（语音约 200MB + 标点约 76MB，优先 hf-mirror），不绑 Ollama、不走 Whisper 整段推理。旧中文 14M 包会在新模型就绪后删掉。单次录音上限约 10 分钟。

| `voiceAsrMode` | 行为 |
|---|---|
| `cloud`（默认） | 整段录完后 `POST /audio/transcriptions`（官方会员或自配 Key） |
| `local-stream` | 本机流式；HUD 增量出字；松手整段再解、有改动则闪校对再贴；本地未就绪才走云端文件 ASR |

`voiceCloudProofread`（默认关）：本地已贴上后，再用 SenseVoice 重转一次，不阻塞首贴。云端稿若不同，**撤销上一次粘贴再贴校对稿**，不要叠成两段。开了才扣官方语音积分。

硅基流动只有文件转写、没有 WebSocket 流式接口；IIS PHP 也代理不了音频流。旧 Xenova Whisper 本地套件仍可用（`sttInferenceMode: local`），不当默认引擎。  
