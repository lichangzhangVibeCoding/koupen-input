# ESC 立即取消

> 状态：**已落地（v0.4.1）**

## 行为

任一能力进行中（即刻对话 / 帮我对话 / 看屏幕），按 **Esc** → **立刻停下**：

- 停麦、停 TTS、中断进行中的转写 / 模型请求  
- 不粘贴、不写入看屏幕归档  
- HUD 提示「好，停下了」  

空闲时 Esc **不拦截**（不占用系统 Esc）。

## 实现要点

- 忙时注册 `globalShortcut` `Escape`；回到 idle 注销  
- 辅助功能已开时，uIOhook 也听 Escape（双保险）  
- `AbortController` 打断 `fetch`（LLM / 云端 STT）  
- 录音中：丢弃音频，不走转写  

## 文案

| key | zh |
|---|---|
| `hud.cancelled` | 好，停下了 |
| `hud.cancelledDetail` | 再按快捷键就能重来 |
