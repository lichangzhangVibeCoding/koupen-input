# Windows 版设计（v0.1）

> 状态：**已落地**；GitHub Actions 已能打出 NSIS `.exe`（仓库 `lichangzhangVibeCoding/koupen-input`）。  
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
| 截屏 | `screencapture` + active-win | 优先 `desktopCapturer` 截前台窗口；失败则整屏裁剪；联系人名可从窗口标题兜底 |
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

产物：

| 类型 | 文件名示例 | 用法 |
|---|---|---|
| 安装版 | `口喷输入-0.1.0-x64.exe`（NSIS Setup） | 双击安装 |
| **绿色版（单文件）** | `口喷输入-0.1.0-绿色版-x64.exe` | 免安装，双击即用，可放 U 盘 |
| **绿色版（压缩包）** | `口喷输入-0.1.0-x64.zip` | 解压后运行目录内 `口喷输入.exe` |

GitHub Actions：

- 安装版：**Build Windows** → Artifact `koupen-windows`
- 绿色版：**Build Windows Green** → Artifact `koupen-windows-green`（含 portable + zip）

本地命令：

```bash
npm run dist:win        # 安装版
npm run dist:win:green  # 绿色版（portable + zip）
```

未签名，Windows 可能提示「未知发布者」，选仍要运行即可。

---

## 4. 明确不做（本版）

- 改动 Mac 默认热键或截屏/粘贴路径  
- Windows 商店上架 / 代码签名（内测可先无签名）  
