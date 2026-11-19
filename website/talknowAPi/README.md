# TalkNow 会员 API（正式环境）

PHP 5.2 + MySQL，部署目录：`website/talknowAPi/` → FTP  
`/lizhenning/wwwroot/other/typenow/talknowAPi`

## 公网入口

| 用途 | URL |
|------|-----|
| Health | https://www.lizhenning.com/other/typenow/talknowAPi/index.php/health |
| API | `…/index.php/v1/...` 或 `…/index.php?r=/v1/...` |
| 管理后台 | https://www.lizhenning.com/other/typenow/talknowAPi/admin/index.php（内联版；独立 .js/.css 会被 WAF 清空） |

> **注意（IIS/WAF）**：主机对 `PUT`/`DELETE` 常返回假 200（gzip HTML），**不会写库**。后台写操作一律用 `POST …-save` / `…-delete`。请打开 **`admin/index.php`**（不要只开空的静态壳），改完后强制刷新。


客户端默认 `membershipServerUrl` 应指向 **带 `index.php` 的根**（IIS PATH_INFO）。

## 配置

1. 复制 `config.example.php` → `config.php`（已 gitignore）
2. 填数据库与管理员密码；可选填上游 `api_key`
3. Stripe 测试结算：填 `stripe_secret_key`、`stripe_webhook_secret`（Dashboard 端点 `…/index.php/v1/stripe/webhook`）和 `stripe_prices`
4. 上游模型名与 API Key 只写在本机 `config.php` / 后台「模型路由」，不要提交 dump 或把线上模型写进 example
5. 部署：`FTP_PASS=… python3 deploy-ftp.py`

主机约束：IIS 7 + PHP 5.2.6；勿用短数组 / `??` / `__DIR__` / 函数返回值直接 `[]` 取值。
