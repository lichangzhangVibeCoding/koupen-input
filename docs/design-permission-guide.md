# Mac 权限引导（安装后首次打开）

> 状态：**已落地（v0.3.1）**  
> 目标：安装后首次打开时，用分步引导完成屏幕录制 / 麦克风 / 辅助功能，减少「不知道去哪勾选」的摩擦。

## 规则

1. 仅 **macOS** 显示全屏引导层；Windows 不弹。  
2. 设置项 `permissionGuideCompleted`：用户点「开始使用」或「稍后再说」后为 `true`。  
3. 若未完成且权限未齐：每次启动仍可显示引导（`permissionGuideCompleted === false`）。  
4. 引导内提供：状态灯、一键打开对应系统设置、麦克风可走系统授权弹窗、刷新状态、辅助功能「我已勾选，重试」。  
5. **禁止**自动调用 `isTrustedAccessibilityClient(true)`（会反复弹窗）。  
6. 设置页保留权限列表；可增加「重新打开权限引导」。

## 包名

- npm / 工程名：`typenow`（原 `streamer-vip-chat` / 仓库曾用 koupen-input）  
- appId：`com.typenow.app`  
- 产品显示名仍为 **即刻对话**  
- 首次启动若新 userData 为空，尝试从旧目录迁移配置与数据库。
