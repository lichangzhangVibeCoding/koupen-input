# 即刻对话 · 墨色信号 VI

> 状态：**已落地（v0.4.0）**  
> 气质：浅底、墨黑为主、电青为唯一强调色；工具感、干净、「即刻」。  
> 范围：App 图标 + 托盘 + 窗口 UI + HUD + 权限引导 + 安装包外观。  
> 宣传站与商用壳层见 0.5.0：[`design-marketing-site.md`](design-marketing-site.md) · [`design-ui-commercial-v1.md`](design-ui-commercial-v1.md)。

---

## 1. 品牌不变

| 项 | zh-CN | en-US |
|---|---|---|
| 产品 | 即刻对话 | TalkNow |
| 一句话 | 本机对话助手，少打字、快回人 | Local chat assistant — type less, reply faster |
| 能力 A | 即刻对话 | TalkNow |
| 能力 B | 帮我对话 | Reply Assist |
| 能力 C | 看屏幕 | Screen Ask |

内部包名 / appId 仍为 `typenow` / `com.typenow.app`。

---

## 2. 色板（CSS）

| Token | 值 | 用途 |
|---|---|---|
| `--ink` | `#12141A` | 主字 / Logo |
| `--ink-2` | `#3A3F4D` | 次级字 |
| `--muted` | `#7A8194` | 说明 |
| `--bg0` | `#F4F6F8` | 页面底 |
| `--bg1` | `#FFFFFF` | 卡片 / 侧栏 |
| `--bg2` | `#EEF1F5` | 输入填充 |
| `--bg3` | `#E4E8EF` | 更深填充 |
| `--line` | `rgba(18,20,26,0.10)` | 分割线 |
| `--signal` | `#00B4C8` | **唯一强调**电青 |
| `--signal-strong` | `#0098AB` | hover |
| `--signal-soft` | `rgba(0,180,200,0.12)` | 选中底 |
| `--ok` | `#0F9D6B` | 成功 |
| `--danger` | `#E0396B` | 错误 |
| `--warn` | `#C98A00` | 警告 |

兼容别名：`--text`→`--ink`，`--accent*`→`--signal*`（旧选择器不碎）。

**禁止**：紫色渐变、紫 glow、多色能力色条。三能力同一电青，靠字形图标区分。

---

## 3. 字体

- Display / 正文：`Avenir Next`, `PingFang SC`, `Hiragino Sans GB`, `Microsoft YaHei`, sans-serif  
- `kbd`：`SF Mono`, `Menlo`, `Consolas`, monospace  
- 品牌字：墨色实色，不用渐变字

---

## 4. Logo / 图标

- **主标（2026-08 TalkNow A 方案）**：墨底圆角方标 + 白描边对话气泡（含声波轮廓）+ 电青点；源文件 `resources/icon.png`（1024）；**圆角外必须透明**（勿留白底方框）；画布四周约 **10% 透明留白**，避免 Dock 视觉比系统图标更大  
- 开发态 Electron 会叠红色 **DEV** 角标，也会显得「多出一块」；正式安装包无此角标  
- **官网 / 安装包 / 侧栏**：同源；官网 `website/assets/icon.png`；Mac/Win 包 `build/icon.icns` / `build/icon.ico`  
- **托盘**：Mac 菜单栏用 `resources/trayTemplate.png`（16pt）+ `resources/trayTemplate@2x.png`（32）。由主标 `icon.png` 的 **alpha 轮廓**生成（黑字透明底，勿反相）。托盘带固定 GUID，并在图标旁显示「即」，避免被系统当成无名 `Item-0` 藏进菜单栏。左键弹出快捷菜单。若仍看不见：系统设置 → 菜单栏，打开「即刻对话」或开发态「Electron」；并看时钟左侧折叠箭头。  
- **DMG**（可选）：浅底背景 + Logo + 一句话

> 旧版「十字 + 底条」与 CSS 假「即」标已废弃，勿再混用。

---

## 5. HUD

- 底：墨色 `#1A1D26`（或近黑半透明）  
- 动效高亮：电青  
- 保留 look / listen / speak / think / write 语义动效  
- 进行中不自动隐藏

---

## 6. 能力图标（同一电青）

| 能力 | 形 |
|---|---|
| 即刻对话（语音） | 声波竖条 |
| 帮我对话 | 对话气泡 |
| 看屏幕 | 取景方框 |

---

## 7. 验收

- [ ] 应用内无品牌紫  
- [ ] 侧栏 / 首页 / 模型 / 对话 / 设置 / 权限引导 / HUD 色系统一  
- [ ] 菜单栏托盘可见且左键能弹出快捷菜单  
- [ ] 安装包图标为新「即」标  
- [ ] 三能力名 + 一句话成对出现  
