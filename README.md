# 即刻对话

本机对话助手，少打字、快回人。支持 macOS 与 Windows。  
视觉体系：**墨色信号 VI**（见 [docs/design-vi-ink-signal.md](./docs/design-vi-ink-signal.md)）。  
官网品牌域名：[www.talknow.cn](https://www.talknow.cn/)（权威源码在 **lizhenning.com** 仓库 [`other/typenow/`](../../lizhenning.com/other/typenow/)；本仓库 [`website/`](./website/) 仅镜像，勿改；DNS 启用前过渡路径 lizhenning.com/other/typenow/）。中文名 **即刻对话**，英文名 **TalkNow**。  
下载：[GitHub Releases](https://github.com/lichangzhangVibeCoding/koupen-input/releases/latest)。  
（曾用名：口喷输入）

## 四大能力

| 对外名 | 一句话 | macOS | Windows |
|---|---|---|---|
| **即刻对话**（语音） | 点按贴口述（可去水词/改错别字，不发送） | 点按触发键开始/结束 | 点按 **Alt** |
| **与AI对话** | 按住同一语音键，按屏幕增强提示词再贴入（不发送） | 按住 ≥0.4 秒松手；首页可点按开始/再点结束 | 按住 **Alt** 增强 |
| **帮我对话** | 看当前聊天截图，按人设生成回复并填入（不发送） | 快速双击右 **Command** | 快速双击 **Alt** |
| **看屏幕** | 我看着整屏，你说要干什么；说「这道题选什么」会直接给答案 | **Command+Shift+1** | **Win+Shift+1** |

硬件隐藏键：语音 `Command+8` / `Win+8`；帮我对话 `Command+0` / `Win+0`。

## 其它功能

- **模型页**：三槽（语音 / 截图 / 回复）；硅基一键推荐；本地套件一键安装  
- **联系人**：人设、画像、关键事实；仿微信聊天记录与时间筛选  
- **对话**：看屏幕问答归档  
- **配置导出 / 还原默认**：设置页；还原不动联系人与聊天  
- **底部 HUD**：墨底 + 电青动效，长流程阶段可见  
- **Esc 取消**：任一能力进行中按 Esc 立刻停下  

说明见 [docs/mvp-v1.md](./docs/mvp-v1.md)、[docs/design-branding.md](./docs/design-branding.md)。

## 开发启动

```bash
cd ~/Downloads/LichangzhangVibeCoding/koupen-input
npm install
npx electron-rebuild -f -w better-sqlite3,uiohook-napi
npm run dev
```

重新生成图标 / 托盘资源：

```bash
python3 scripts/generate-vi-assets.py
```

## 打包

```bash
# macOS .dmg
npm run dist

# Windows NSIS .exe（需在 Windows 或 GitHub Actions 上执行）
npm run dist:win
```
