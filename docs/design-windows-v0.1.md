# Windows 版设计（v0.1）

> 状态：**已落地（代码）**；正式 `.exe` 建议在 Windows 本机执行 `npm run dist:win`（原生模块交叉编译可能失败）。  
> 原则：**Mac 行为与文案逻辑不变**；Windows 用独立热键与系统能力实现。

---

## 1. 热键（按平台）

| 能力 | macOS（不变） | Windows |
|---|---|---|
| **我来口喷** | 单击左 Command | 单击 **Alt** |
| **帮你口喷** | 快速双击左 Command | 快速双击 **Alt** |

设置里默认值：

- Mac：`DoubleCommand`  
- Windows：`DoubleAlt`  

自定义 Electron 加速键仍可选（两平台各自）。

---

## 2. 系统能力

| 能力 | Mac | Windows |
|---|---|---|
| 截屏 | `screencapture` + active-win | `desktopCapturer` + active-win |
| 粘贴 | AppleScript Command+V | PowerShell SendKeys Ctrl+V |
| 修饰键监听 | uiohook Meta | uiohook Alt / AltRight |

---

## 3. 打包（没有 Windows 电脑）

原生模块无法在 Mac 上交叉编译。推荐用 **GitHub Actions** 白嫖云端 Windows：

1. 把 `other/streamer-vip-chat/` 推到任意 GitHub 仓库（可私有）
2. 打开仓库 → **Actions** → **Build Windows** → **Run workflow**
3. 跑完后在该次运行底部 **Artifacts** 下载 `koupen-windows`（内含 `.exe`）

工作流文件：`.github/workflows/build-windows.yml`（支持手动触发 `workflow_dispatch`）。

本机若有 Windows，也可直接：

```bash
npm ci
npx electron-rebuild -f -w better-sqlite3,uiohook-napi,active-win
npm run dist:win
```

产物一般为 `release/口喷输入 Setup 0.1.0.exe`。未签名，Windows 可能提示「未知发布者」，选仍要运行即可。

---

## 4. 明确不做（本版）

- 改动 Mac 默认热键或截屏/粘贴路径  
- Windows 商店上架 / 代码签名（内测可先无签名）  
