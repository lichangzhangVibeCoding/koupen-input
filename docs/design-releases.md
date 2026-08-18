# 发版数据源（releases.json）

> 状态：**已落地（含中英要点）**  
> 权威文件：[`docs/releases.json`](releases.json)  
> 消费者：宣传站 Changelog、App「更新」页。

## 字段

- 顶层：`product`, `productEn`, `repo`, `releasesUrl`, `latestUrl`, `siteUrl`, `releases[]`  
- 每条：
  - `version`, `date`
  - `title` / `titleEn`（英文必填）
  - `highlights[]` / `highlightsEn[]`（英文必填，条数与中文对齐）
  - `downloads.{macArm64,macX64,winX64}`

展示：语言为 en 时用 `*En`，缺省回退中文。

下载拼 URL：

`{repo}/releases/download/v{version}/{filename}`

## 发版流程

**约定：每次有用户可见更新后，必须同步宣传站更新日志，并打出最新安装包。**

宣传站权威目录：`lizhenning.com/other/typenow/`（本仓库 `website/` 勿改）。

1. bump `package.json` version  
2. 改 `docs/releases.json`（置顶新版本，**中英 title/highlights 一起写**）  
3. 改根 `CHANGELOG.md` / `docs/CHANGELOG.md`  
4. 同步 App + 站用 JS（WAF 拦 `*.json`，线上靠 JS）：

```bash
npm run sync:releases
```

（写入 `src/shared/releases.json`，以及 lizhenning `other/typenow/js/releases-data.js`，变量名 `TALKNOW_RELEASES`。）

5. `npm run dist`（Mac DMG）/ 需要时跑 Windows CI；产物名与 `downloads.*` 一致  
6. 部署宣传站：

```bash
cd /Users/tank/Downloads/lizhenning.com/other/typenow
FTP_PASS='…' python3 deploy-inline-ftp.py
```

7. 打 tag `vX.Y.Z`；把产物传到 GitHub Releases（下载 CTA 指向这里）  

