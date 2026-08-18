# 新手引导：按默认快捷键练完四个能力

> 状态：**落地中**  
> 相关：[`design-permission-guide.md`](design-permission-guide.md)（Mac 权限，冷启动）· [`design-voice-trigger.md`](design-voice-trigger.md) · [`design-membership.md`](design-membership.md)  
> 作废：[`design-ui-beta-v0.1.md`](design-ui-beta-v0.1.md) §4.2「欢迎 / 去配模型 / 记住快捷键」三步弹窗（默认已是官方会员，缺的是手会按）。

## 目标

登录成功后进**训练场**（`/onboarding`）：用户用**当前系统默认快捷键**把四个能力各做一遍。首页「运行」按钮不计入完成。帮助页可随时再进。

## 原则

1. **过关条件是快捷键，不是按钮。** 主进程在修饰键 / 组合键真正跑完（贴上或 HUD 出答案）后发 `skill-guide:step`。UI 点按、硬件 `Win+8` / `Win+0` 不发。
2. **只显示当前系统会按到的键。** `formatVoiceTapBindLabel` / `formatVoiceHoldBindLabel` / `formatHotkeyLabel`。Windows：Alt / `Win+Shift+1`；Mac：右 Command / `右 Command+Shift+1`。
3. **训练在应用内。** 练习台自带输入框 / 假聊天窗 / 假题目，避免赶到微信、记事本后失焦。练完一句：之后在微信 / Cursor 里同样按。
4. **可跳过、可再进。** 跳过或完成都写 `skillGuideCompleted: true`，避免每次登录再弹。帮助「新手引导」再打开；可「重新练一遍」。
5. **Mac 权限仍走现有全屏层。** 顺序：权限（仅 Mac）→ 注册登录 → 本引导。没麦/没录屏时步骤拦住并链到设置，不假装能练。

## 流程

```text
注册/登录成功 且 skillGuideCompleted !== true
  → /onboarding
帮助「新手引导」
  → /onboarding（可从头再练）
```

冷启动不拦本页（冷启动拦的是 Mac 权限）。未登录仍先去个人中心。

## 步骤

| 步 | 练习台 | 用户动作 | 完成信号 |
|---|---|---|---|
| 欢迎 | 四能力对照（键按平台填） | 下一步 | 点击 |
| 即刻对话 | 空输入框，光标在框内 | 点按语音键 → 说「你好即刻」→ 再点按 | `voice` 贴完 |
| 与AI对话 | 同一输入框可清空 | 按住同一键 ≥0.4s → 说一句散的需求 → 松手 | `aiTalk` 贴完 |
| 帮我对话 | 假聊天窗 + 底部输入框 | 点进假输入框，快速双击语音键 | `reply` 贴完 |
| 看屏幕 | 假题目 / 英文句 | 看屏幕默认键，再按一次结束 | `screenAsk` HUD 出答案 |
| 收尾 | Esc、不代发、帮助还能再进 | 开始使用 | 写完成标记 |

官方会员真实走一遍会扣少量体验积分，步骤上写明。不另做假打勾。Esc 随时取消当前录音（现网）。

## 配置

`settings.skillGuideCompleted: boolean`，默认 `false`。跳过全部或收尾「开始使用」后为 `true`。

## 不做

- 硬件备用键作为引导主路径
- 用首页「运行」代替按键过关
- 把人赶到微信 / 记事本才能练
- 每次冷启动强制弹出（那是权限引导的职责）
