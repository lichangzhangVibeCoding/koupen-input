# 官网源码已迁出（勿在此改）

**权威维护目录：**  
`/Users/tank/Downloads/lizhenning.com/other/typenow/`

线上：https://www.lizhenning.com/other/typenow/  
品牌域名：https://www.talknow.cn/

本目录仅作历史镜像。改文案、场景、样式、订阅/帮助、会员 API、部署 → 到 **lizhenning.com** 项目的 `other/typenow/`。

## App 侧脚本（在 koupen-input 根目录跑）

| 命令 | 作用 |
|---|---|
| `npm run sync:plans` | 写入 lizhenning `other/typenow/js/plan-catalog.js`（并镜像本目录） |
| `npm run sync:releases` | 写入 lizhenning `other/typenow/js/releases-data.js` + `src/shared/releases.json` |

## 部署

```bash
cd /Users/tank/Downloads/lizhenning.com/other/typenow
FTP_PASS='…' python3 deploy-inline-ftp.py
```

详见：`docs/design-marketing-site.md`、lizhenning `other/typenow/README.md` · `AGENTS.md`。
