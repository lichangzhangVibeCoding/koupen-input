# 口喷输入 — Agent / 开发约定

## 工作顺序（必须）

1. **先改文档**（`docs/mvp-v1.md` 等）  
2. **写入变更日志**（`docs/CHANGELOG.md`）  
3. **再改代码 / 配置**  
4. 需要时更新 `README.md`

不要先写代码再补文档。

## 平台文案

- **Mac 构建 / Mac 用户界面**：写 `Command`、`Option`；不要混写 Windows 键名  
- **Windows 构建 / Windows 用户界面**：写 `Alt`、`Ctrl`；热键为 Alt 单击/双击  
- UI 文案按 `process.platform` / `vipChat.getPlatform()` 分支，**不要**改另一平台默认行为  
- Windows 细节见 `docs/design-windows-v0.1.md`

## 打包安装包

生成 `.dmg` / `.app` 时必须是**干净初始版**：

- 不打包本机 `userData`、API Key、客户、聊天、本地模型缓存
- 先跑干净检查（见 `docs/design-user-data.md` §5），失败则中止
- 交付说明写清：用户数据仅在安装后本机生成

## 品牌文案

用户可见名称以 `docs/design-branding.md` 为准：

- 产品：**口喷输入**
- 语音：**我来口喷**
- 截图回复：**帮你口喷**
- 对外名旁必须带一句话解释；勿写主播/榜一等行业话术

## 相关文档

- 功能规格：`docs/mvp-v1.md`
- 变更日志：`docs/CHANGELOG.md`
- 品牌命名：`docs/design-branding.md`
- 模型配置：`docs/design-model-config.md`
- 用户配置与数据：`docs/design-user-data.md`
- 内测 UI 优化：`docs/design-ui-beta-v0.1.md`
