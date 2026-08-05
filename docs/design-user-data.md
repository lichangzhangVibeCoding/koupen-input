# 用户配置与数据管理设计

> 状态：**一期已落地**（`settings.json` + 导出配置 + 还原默认 + 打包干净检查；全量备份/清空放二期）  
> 原则：个性化配置单独文件；可还原、可导出；打包安装包只含干净初始态，不含开发机上的用户数据。

---

## 1. 问题

当前实现把「设置」和「客户 / 聊天」都塞在同一 SQLite（`userData/data/vip-chat.sqlite`）里：

| 现状 | 风险 |
|---|---|
| API Key、快捷键、模型偏好在 DB 的 `settings` 表 | 不好单独备份；和业务数据绑死 |
| 联系人档案、人设、聊天记录同库 | 还原设置时容易误伤聊天；导出配置却带不出客户 |
| 打包时若误拷 `userData` / 测试库进安装包 | 会把开发者的 Key、客户名、聊天内容发给用户 |
| 本地 Whisper 模型缓存在 `userData/models` | 体积大，不属于「配置备份」，也不应打进安装包 |

需要把**用户信息**边界划清，并给出：单独配置文件、初始化还原、一键导出、打包出干净包。

---

## 2. 数据分层（先分清再动手）

```
Application Support / typenow/  ← Electron userData（appId `com.typenow.app`；运行时，不进安装包；旧目录会自动迁移）
├── config/
│   └── settings.json                 ← A. 个性化配置（单独文件）
├── data/
│   ├── vip-chat.sqlite               ← B. 用户业务数据（联系人 + 帮我对话消息 + 看屏幕会话）
│   └── screen-ask/                   ← B. 看屏幕截图文件（按会话归档）
├── models/                           ← C. 可重建缓存（本地 Whisper 等）
└── voice/                            ← C. 临时录音（可随时清）
```

安装包（`.app` / `.dmg`）内只含程序代码与资源，**不包含** A/B/C。首次启动在本机 `userData` 自动生成空库 + 默认 `settings.json`。

### A. 个性化配置（`settings.json`）

属于「怎么跑」：

- 快捷键、语音开关、上下文条数  
- 模型槽绑定（本地 / 硅基等）、Base URL、模型名  
- **API Key**（敏感；导出时可勾选「是否包含密钥」）

### B. 用户业务数据（SQLite）

属于「聊了什么、服务谁」：

- 联系人列表、人设、画像、标签、关键事实  
- 聊天记录（含 batch / 时间）

### C. 可重建缓存（默认不备份）

- `models/` 本地语音权重  
- `voice/` 临时音频  
- Ollama 模型在 Ollama 自己的目录，不在本应用 userData

导出「完整备份」时默认 **不含 C**（体积大、可再装）；设置页可另提供「清除本地语音缓存」。

---

## 3. 产品能力（设置页「数据」区）

入口建议：设置页底部新增一块 **「配置与数据」**（不塞进模型页）。

| 能力 | 行为 | 确认文案要点 |
|---|---|---|
| **导出配置** | 弹出「存储位置」对话框，保存 `即刻对话-配置-日期.json` | 默认**不含** API Key；可勾选「包含密钥」 |
| **导出全部用户数据** | 保存 zip：`settings.json` + `vip-chat.sqlite`（或等价 JSON bundle） | 含联系人与聊天，提醒勿外传 |
| **还原默认配置** | 仅把 `settings.json` 写成 `DEFAULT_SETTINGS`，**不动**客户/聊天 | 「只清模型/快捷键等配置」 |
| **清空业务数据** | 清空 contacts + messages（或删库重建），**不动**配置 | 「删除全部联系人与聊天，不可恢复」 |
| **全部初始化** | 默认配置 + 空业务库；可选是否清 `models/` | 二次确认；等同「当新装」 |

一期可不做「从文件导入」；导出格式先固定，二期再加导入。

### 导出文件格式（配置）

```json
{
  "format": "vip-chat-settings",
  "version": 1,
  "exportedAt": "2026-07-17T15:00:00.000Z",
  "appVersion": "0.1.0",
  "includeSecrets": false,
  "settings": { "...": "AppSettings 字段；密钥为空或已脱敏" }
}
```

全部用户数据包（zip）：

```
vip-chat-backup-YYYYMMDD/
  manifest.json      # format / version / exportedAt / includeSecrets
  settings.json
  vip-chat.sqlite    # 仅业务表；或 contacts.json + messages.json
```

---

## 4. 实现要点（确认后编码）

1. **配置文件为设置的唯一真源**  
   - 读写 `config/settings.json`  
   - 启动时：若仅有旧 SQLite `settings` 表 → 迁移到文件后，DB 内 settings 可停用或删除  
2. **SQLite 只保留业务表**（contacts / messages）  
3. **IPC**  
   - `data:exportSettings` / `data:exportAll`  
   - `data:resetSettings` / `data:clearBusiness` / `data:factoryReset`  
   - 使用 `dialog.showSaveDialog`（Mac）选路径  
4. **敏感字段**  
   - `apiKey`、`sttApiKey`、`localSttApiKey`：导出默认置空；勾选后才写入明文  
5. **还原后**  
   - 重新注册快捷键、刷新模型页状态  

---

## 5. 打包：必须出「干净初始版」

### 5.1 原则

> 当执行打包生成安装包时，产物只能是**未使用过的初始程序**：无 API Key、无客户、无聊天、无本机模型缓存、无开发者测试数据。

用户机器上的 `userData` 本来就不会进 `electron-builder` 的 `files`（当前只打 `out/**/*` + `package.json`）。仍要防三类污染：

| 污染源 | 处理 |
|---|---|
| 仓库里误放的 `data/*.sqlite`、测试配置、截图、录音 | `.gitignore`；打包前脚本扫描并失败退出 |
| `release/` 里上次构建残留 | `dist` 前清理或覆盖；禁止把 userData 拷进 `extraResources` |
| asar 内嵌默认用户库 | **禁止**；首次启动再创建空库 |

### 5.2 打包脚本约定（`npm run dist`）

在现有 `build` → `electron-builder` 前增加 **`predist` / `scripts/ensure-clean-release.mjs`**：

1. 检查项目目录内是否存在可疑用户数据路径（如 `src/**/vip-chat.sqlite`、`config/settings.json` 被提交、`fixtures` 含真实 Key）  
2. 确认 `build.files` / `extraResources` **未**包含 `userData`、绝对路径、开发机 `Library/Application Support`  
3. 打印清单：`Clean release: no user settings / contacts / messages bundled`  
4. 任一检查失败 → **中止打包**，避免「脏包」

可选：打包成功后在日志写一句：「安装包为初始化版本；用户数据仅在安装后本机生成」。

### 5.3 Agent 约定（给你下指令「打包」时）

当你说「打包 / 生成安装包」时，Agent 必须：

1. 跑干净检查脚本，不跳过  
2. **不**把当前开发机 `userData` 拷进仓库或 `release/`  
3. **不**为了「演示」把真实客户/聊天打进包  
4. 若需示例数据，只用匿名假数据且默认关闭（MVP 不做示例数据）  
5. 交付物说明：这是**干净初始安装包**；配置与客户数据在用户本机首次使用后生成，可用应用内导出备份  

---

## 6. UI 文案（Mac）

- 「导出配置…」「导出全部用户数据…」  
- 「还原默认配置」「清空联系人与聊天」「全部初始化」  
- 危险操作使用系统确认框，写清**会删什么、不会删什么**  

不在模型页堆这些按钮，避免和「测一下 / 装模型」混淆。

---

## 7. 分期

| 期 | 范围 |
|---|---|
| **一期（建议先做）** | `settings.json` 独立存储 + 旧库迁移；导出配置；还原默认配置；打包干净检查脚本；设置页「配置与数据」入口 |
| **二期** | 导出全部用户数据（zip）；清空业务 / 全部初始化；导出是否含密钥勾选 |
| **三期（可选）** | 从备份导入；自动定时备份；云同步（不做则永不做） |

---

## 8. 待你确认的点

1. 导出配置默认**不含** API Key，需要时再勾选 —— 是否同意？  
2. 「还原默认配置」是否**永远不动**联系人与聊天？（本文按「永远不动」设计）  
3. 一期是否只做「导出配置 + 还原配置 + 打包干净检查」，业务数据清空/全量导出放二期？  
4. 全部用户数据备份格式偏好：zip（sqlite）还是单一大 JSON？

确认后按 `AGENTS.md`：改 `mvp-v1.md` 摘要 → `CHANGELOG` → 再写代码。
