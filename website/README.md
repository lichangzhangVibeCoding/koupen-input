# 即刻对话 / TalkNow 官网

本目录是宣传站与会员 API 的**唯一源码**。

线上：https://www.lizhenning.com/other/typenow/  
品牌域：https://www.talknow.cn/

## 改什么

| 路径 | 内容 |
|------|------|
| `index.html`、`css/`、`js/`、`help/`、`changelog/`、`subscribe/` | 宣传站 |
| `talknowAPi/` | 会员 PHP API / 后台 |

不要再改 `lizhenning.com/other/typenow/` 里的页面（那边只留部署入口）。已删除本仓库旧草案 `website-new/`。

## 部署

```bash
cd /Users/tank/Downloads/LichangzhangVibeCoding/koupen-input/website
python3 deploy-inline-ftp.py
```

凭据在本目录 gitignore 的 `.env`。主机 WAF 会清空独立 `*.js` / `*.css`，必须走内联脚本。

会员 API：`python3 talknowAPi/deploy-ftp.py`

## 从 App 同步

在仓库根目录：

- `npm run sync:plans` → `website/js/plan-catalog.js`
- `npm run sync:releases` → `website/js/releases-data.js` 与 `website/releases.json`
