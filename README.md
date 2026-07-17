# 口喷输入

本机对话助手：记人设、攒记忆，帮你少打字。支持 macOS 与 Windows。

## 两大能力

| 对外名 | 一句话 | macOS | Windows |
|---|---|---|---|
| **我来口喷** | 你说，我转成字并贴进当前输入框 | 单击左 **Command** 开始/结束 | 单击 **Alt** 开始/结束 |
| **帮你口喷** | 看当前聊天截图，按人设生成回复并填入（不发送） | 快速双击左 **Command** | 快速双击 **Alt** |

## 其它功能

- **模型页**：三槽（语音 / 截图 / 回复）；硅基一键推荐；本地套件一键安装  
- **联系人**：人设、画像、关键事实；仿微信聊天记录与时间筛选  
- **配置导出 / 还原默认**：设置页；还原不动联系人与聊天  
- **底部 HUD**：进行中 / 已填入 / 失败提示  

说明见 [docs/mvp-v1.md](./docs/mvp-v1.md)、[docs/design-branding.md](./docs/design-branding.md)。

## 开发启动

```bash
cd other/streamer-vip-chat
npm install
npx electron-rebuild -f -w better-sqlite3,uiohook-napi
npm run dev
```

## 打包

```bash
# macOS .dmg
npm run dist

# Windows NSIS .exe（需在 Windows 或 GitHub Actions 上执行）
npm run dist:win
```

**没有 Windows 电脑**：把本目录推到 GitHub → Actions → **Build Windows** → 下载 Artifact `koupen-windows`。详见 [docs/design-windows-v0.1.md](./docs/design-windows-v0.1.md)。

产物在 `release/`。当前为**未签名**安装包。

Mac 若提示 **「已损坏，无法打开」**：

```bash
xattr -cr "/path/to/口喷输入-0.1.0-arm64.dmg"
xattr -cr "/Applications/口喷输入.app"
```

## 首次使用

1. 打开侧栏 **「模型」**，用硅基推荐或本地套件把能力跑通  
2. 授予权限：Mac（屏幕录制 / 麦克风 / 辅助功能）；Windows（麦克风 / 屏幕捕获）  
3. **帮你口喷**：打开聊天窗口后双击修饰键（Mac：左 Command；Win：Alt）  
4. **我来口喷**：单击同一修饰键开始/结束  

快捷键与开关在 **「设置」**。

## 技术栈

Electron + Vite + React + TypeScript + SQLite（better-sqlite3）
