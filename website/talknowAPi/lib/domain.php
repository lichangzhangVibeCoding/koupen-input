<?php
require_once dirname(__FILE__) . '/bootstrap.php';

function tn_ensure_schema() {
  $pdo = tn_db();
  try {
    $pdo->query('SELECT 1 FROM tn_plans LIMIT 1');
  } catch (Exception $e) {
    $sqlFile = dirname(__FILE__) . '/../sql/schema.sql';
    $sql = file_get_contents($sqlFile);
    $parts = explode(';', $sql);
    for ($i = 0; $i < count($parts); $i++) {
      $stmt = trim($parts[$i]);
      if ($stmt === '') continue;
      if (strpos($stmt, '--') === 0) continue;
      if (stripos($stmt, 'SET ') === 0) continue;
      // strip leading comment lines
      $lines = explode("\n", $stmt);
      $clean = array();
      foreach ($lines as $line) {
        if (strpos(trim($line), '--') === 0) continue;
        $clean[] = $line;
      }
      $stmt = trim(implode("\n", $clean));
      if ($stmt === '') continue;
      $pdo->exec($stmt);
    }
  }
  tn_ensure_plan_columns();
  tn_ensure_subscription_columns();
  tn_seed();
}

/** 套餐表补 gift_credits（基础 + 赠送） */
function tn_ensure_plan_columns() {
  $pdo = tn_db();
  try {
    $pdo->query('SELECT gift_credits FROM tn_plans LIMIT 1');
  } catch (Exception $e) {
    $pdo->exec('ALTER TABLE tn_plans ADD gift_credits INT NOT NULL DEFAULT 0 AFTER monthly_credits');
  }
}

/** 订阅表补 pending_plan_id（预约降级） */
function tn_ensure_subscription_columns() {
  $pdo = tn_db();
  try {
    $pdo->query('SELECT pending_plan_id FROM tn_subscriptions LIMIT 1');
  } catch (Exception $e) {
    $pdo->exec("ALTER TABLE tn_subscriptions ADD pending_plan_id VARCHAR(32) NOT NULL DEFAULT '' AFTER period_end");
  }
}

/** 周期发放总量 = 基础 + 赠送 */
function tn_plan_grant($plan) {
  if (!$plan) return 0;
  $base = isset($plan['monthly_credits']) ? (int)$plan['monthly_credits'] : 0;
  $gift = isset($plan['gift_credits']) ? (int)$plan['gift_credits'] : 0;
  return $base + $gift;
}

function tn_plan_public($plan) {
  $base = (int)$plan['monthly_credits'];
  $gift = isset($plan['gift_credits']) ? (int)$plan['gift_credits'] : 0;
  return array(
    'id' => $plan['id'],
    'name' => $plan['name'],
    'baseCredits' => $base,
    'giftCredits' => $gift,
    'monthlyCredits' => $base + $gift,
    'priceMonthCents' => (int)$plan['price_month_cents'],
    'priceYearCents' => (int)$plan['price_year_cents'],
  );
}

/**
 * 四档：体验 / 标准 / 高级 / 旗舰
 * monthly_credits=基础用量，gift_credits=赠送用量
 */
function tn_seed_plans_v2() {
  $pdo = tn_db();
  tn_ensure_plan_columns();
  $flag = tn_setting('plans_tier_v2');
  $rows = array(
    array('trial', '体验版', 500, 0, 0, 0, 0),
    array('standard', '标准版', 2000, 2000, 9900, 66800, 10),
    array('advanced', '高级版', 4000, 5000, 19900, 133800, 20),
    array('flagship', '旗舰版', 20000, 30000, 99900, 671300, 30),
  );
  $ins = $pdo->prepare(
    'INSERT INTO tn_plans (id,name,monthly_credits,gift_credits,price_month_cents,price_year_cents,sort_order,active)
     VALUES (?,?,?,?,?,?,?,1)
     ON DUPLICATE KEY UPDATE name=VALUES(name), monthly_credits=VALUES(monthly_credits),
       gift_credits=VALUES(gift_credits), price_month_cents=VALUES(price_month_cents),
       price_year_cents=VALUES(price_year_cents), sort_order=VALUES(sort_order), active=1'
  );
  if ($flag !== '1') {
    for ($i = 0; $i < count($rows); $i++) {
      $r = $rows[$i];
      $ins->execute(array($r[0], $r[1], $r[2], $r[3], $r[4], $r[5], $r[6]));
    }
    $pdo->exec("UPDATE tn_subscriptions SET plan_id='trial' WHERE plan_id='free'");
    $pdo->exec("UPDATE tn_subscriptions SET plan_id='advanced' WHERE plan_id='pro'");
    $pdo->exec("UPDATE tn_subscriptions SET plan_id='flagship' WHERE plan_id='max'");
    $pdo->exec("UPDATE tn_plans SET active=0 WHERE id IN ('free','pro','max')");
    tn_set_setting('plans_tier_v2', '1');
  } else {
    $chk = $pdo->prepare('SELECT id FROM tn_plans WHERE id=?');
    for ($i = 0; $i < count($rows); $i++) {
      $r = $rows[$i];
      $chk->execute(array($r[0]));
      if (!$chk->fetch()) {
        $ins->execute(array($r[0], $r[1], $r[2], $r[3], $r[4], $r[5], $r[6]));
      }
    }
  }
}

function tn_seed() {
  $pdo = tn_db();
  $cfg = tn_config();
  tn_seed_plans_v2();
  $t = tn_now();
  $prices = array(
    'voiceCreditsPerMinute' => 2,
    'replyCredits' => 10,
    'replyVisionCredits' => 5,
    'screenAskCredits' => 25,
    'screenQuizCredits' => 15,
  );
  $pi = $pdo->prepare('INSERT IGNORE INTO tn_credit_prices (`key`, value, updated_at) VALUES (?,?,?)');
  foreach ($prices as $k => $v) $pi->execute(array($k, $v, $t));

  $up = $cfg['upstream'];
  $ri = $pdo->prepare('INSERT IGNORE INTO tn_model_routes (slot, base_url, api_key, model_id, updated_at) VALUES (?,?,?,?,?)');
  $key = isset($up['api_key']) ? $up['api_key'] : '';
  $ri->execute(array('asr', $up['base_url'], $key, $up['asr'], $t));
  $ri->execute(array('vision', $up['base_url'], $key, $up['vision'], $t));
  $ri->execute(array('chat', $up['base_url'], $key, $up['chat'], $t));

  $si = $pdo->prepare('INSERT IGNORE INTO tn_app_settings (`key`, value) VALUES (?,?)');
  $si->execute(array('ops_payment_hint', isset($cfg['ops_payment_hint']) ? $cfg['ops_payment_hint'] : ''));
  $si->execute(array('ops_support_contact', isset($cfg['ops_support_contact']) ? $cfg['ops_support_contact'] : ''));

  $kb = (int)$pdo->query('SELECT COUNT(*) FROM tn_kb_articles')->fetchColumn();
  if ($kb === 0) {
    $k = $pdo->prepare('INSERT INTO tn_kb_articles (slug,title,category,body,sort_order,updated_at,created_at) VALUES (?,?,?,?,?,?,?)');
    $seedKb = array(
      array('cred-checklist', '凭证清单（请补全）', '凭证账号', "在此分类存放所有密钥与账号，每条一个主题。\n建议条目：MySQL / FTP / 管理后台 / 硅基流动 Key / 短信 / 域名控制台。\n格式示例：\n用途：\n主机：\n账号：\n密码/Key：\n备注：", 10),
      array('arch-overview', '产品与技术总览', '核心架构', "产品：即刻对话 / TalkNow（Electron 桌面助手）\n双轨：自配 Key 永久免费；官方会员免 Key 扣统一积分。\n客户端默认会员 API：…/talknowAPi/index.php\n能力三槽：语音 ASR · 截图视觉 · 回复文本。\n管理后台：admin/index.php（内联，防 WAF 清空 JS/CSS）", 10),
      array('pitfall-waf-put', '踩坑：IIS/WAF 拦截 PUT/DELETE', '踩坑记录', "现象：后台点保存提示成功，刷新后没变。\n原因：主机对 PUT/DELETE 返回假 HTTP 200（gzip HTML），未进 PHP。\n解法：写操作一律 POST …-save / …-delete（如 plans-save、ops-save、kb-save）。\n模型路由一开始用的就是 POST model-routes-save，所以曾出现「只有路由能改」。", 10),
      array('pitfall-sharp', '踩坑：本地语音 sharp/libvips', '踩坑记录', "本地套件一点安装就报 sharp / libvips / dlopen。\n发版前跑 ensure-sharp；asarUnpack 含 sharp 与原生库。\n用户侧可先走官方会员或硅基 Key。", 20),
      array('howto-offline-order', '教程：线下开单与履约', '功能教程', "1. 用户页搜手机号\n2. 线下开单：选套餐或加积分，填付款备注\n3. 待履约订单点「履约」写入积分/订阅\n4. 亦可用兑换码发放试用积分", 10),
      array('howto-client-models', '教程：客户端模型三种跑法', '功能教程', "模型页三选一：官方会员 / 自配 Key / 本地模型。\n三槽（语音·截图·回复）跟当前方案走，不是第四套配置。\n官方需先登录个人中心；自配可一键硅基；本地需 Ollama + Whisper。", 20),
      array('deploy-ftp', '运维：正式环境与 FTP', '运维部署', "公网：https://www.lizhenning.com/other/typenow/talknowAPi/\n健康检查：index.php?r=/health\n后台：admin/index.php（强制刷新）\n部署：website/talknowAPi/deploy-ftp.py（需 FTP_PASS）\n改 admin.js/css 后必须重建内联 index.html 再上传。", 10),
    );
    for ($i = 0; $i < count($seedKb); $i++) {
      $row = $seedKb[$i];
      $k->execute(array($row[0], $row[1], $row[2], $row[3], $row[4], $t, $t));
    }
  }
  // 已有库：按 slug 补齐情报模板（不覆盖已有正文）
  $ki = $pdo->prepare('INSERT IGNORE INTO tn_kb_articles (slug,title,category,body,sort_order,updated_at,created_at) VALUES (?,?,?,?,?,?,?)');
  $tpl = array(
    array('cred-mysql', 'MySQL 数据库', '凭证账号', "主机：\n库名：\n用户：\n密码：\n备注：内网另注", 11),
    array('cred-ftp', 'FTP 部署账号', '凭证账号', "主机：\n用户：\n密码：\n远程根：/lizhenning/wwwroot/other/typenow/talknowAPi", 12),
    array('cred-admin', 'Ops 管理后台', '凭证账号', "入口：…/talknowAPi/admin/index.php\n用户：\n密码：\n（见服务器 config.php admin_user / admin_pass）", 13),
    array('cred-siliconflow', '硅基流动 / 上游模型 Key', '凭证账号', "用途：官方代理上游（ASR/视觉/对话）\nBase URL：https://api.siliconflow.cn/v1\nAPI Key：\n亦可在后台「模型路由」维护", 14),
    array('arch-overview', '产品与技术总览', '核心架构', "产品：即刻对话 / TalkNow（Electron）\n双轨：自配 Key 永久免费；官方会员免 Key 扣积分。\n能力三槽：语音 · 截图 · 回复。\n会员 API：talknowAPi/index.php", 10),
    array('pitfall-waf-put', '踩坑：WAF 拦截 PUT/DELETE', '踩坑记录', "保存假成功、刷新不变 → PUT/DELETE 被拦。写库一律 POST *-save / *-delete。", 10),
    array('pitfall-sharp', '踩坑：本地语音 sharp/libvips', '踩坑记录', "本地安装报 sharp/libvips → 发版跑 ensure-sharp；用户可先用官方/硅基。", 20),
    array('howto-offline-order', '教程：线下开单与履约', '功能教程', "搜用户 → 线下开单（套餐或加积分）→ 履约；或发兑换码。", 10),
    array('howto-client-models', '教程：客户端三种跑法', '功能教程', "模型页：官方会员 / 自配 Key / 本地。三槽跟方案走。", 20),
    array('deploy-ftp', '运维：正式环境与 FTP', '运维部署', "后台用 admin/index.php 并强制刷新。\ndeploy-ftp.py 上传；改 JS/CSS 需重建内联 HTML。\n健康检查：index.php?r=/health", 10),
  );
  for ($i = 0; $i < count($tpl); $i++) {
    $row = $tpl[$i];
    $ki->execute(array($row[0], $row[1], $row[2], $row[3], $row[4], $t, $t));
  }
  // 旧分类条目迁到新分类（仅当仍是种子短文时）
  $pdo->exec("UPDATE tn_kb_articles SET category='核心架构' WHERE slug='product-positioning' AND category='产品'");
  $pdo->exec("UPDATE tn_kb_articles SET category='核心架构' WHERE slug='membership-model' AND category='商业'");
  $pdo->exec("UPDATE tn_kb_articles SET category='运维部署' WHERE slug='deploy-php' AND category='工程'");
  $rm = (int)$pdo->query('SELECT COUNT(*) FROM tn_roadmap_items')->fetchColumn();
  if ($rm === 0) {
    $r = $pdo->prepare('INSERT INTO tn_roadmap_items (phase,title,detail,status,sort_order,updated_at,created_at) VALUES (?,?,?,?,?,?,?)');
    $items = array(
      array('P0', '积分单价与档位', '', 'done', 10),
      array('P1', '账号与管理后台', '', 'done', 20),
      array('P2', '薄代理扣积分', '', 'done', 30),
      array('P3', '客户端会员双路由', '', 'done', 40),
      array('P4', '线下收款 SOP', '', 'done', 50),
      array('P5', '微信/支付宝支付', '后置', 'deferred', 60),
      array('P6', '官网定价页', '', 'done', 70),
      array('工程', 'PHP+MySQL 正式部署', 'talknowAPi PHP5.2', 'done', 5),
      array('产品', '技能模块', '', 'pending', 90),
    );
    foreach ($items as $it) {
      $r->execute(array($it[0], $it[1], $it[2], $it[3], $it[4], $t, $t));
    }
  }
}

function tn_setting($key, $fallback = '') {
  $st = tn_db()->prepare('SELECT value FROM tn_app_settings WHERE `key`=?');
  $st->execute(array($key));
  $v = $st->fetchColumn();
  return ($v === false) ? $fallback : (string)$v;
}

function tn_set_setting($key, $value) {
  $st = tn_db()->prepare('INSERT INTO tn_app_settings (`key`, value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)');
  $st->execute(array($key, $value));
}

function tn_prices() {
  $rows = tn_db()->query('SELECT `key`, value FROM tn_credit_prices')->fetchAll();
  $out = array();
  foreach ($rows as $r) $out[$r['key']] = (int)$r['value'];
  return $out;
}

function tn_add_months($iso, $months) {
  $ts = strtotime($iso);
  if ($ts === false) $ts = time();
  return gmdate('Y-m-d\TH:i:s', strtotime('+' . (int)$months . ' months', $ts)) . '.000Z';
}

/** 把运营填的到期日规范成 ISO；支持 YYYY-MM-DD 或完整 ISO */
function tn_normalize_period_end($raw) {
  $s = trim((string)$raw);
  if ($s === '') return '';
  if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
    return $s . 'T23:59:59.000Z';
  }
  $ts = strtotime($s);
  if ($ts === false) return '';
  return gmdate('Y-m-d\TH:i:s', $ts) . '.000Z';
}

/**
 * 开通/变更会员档位。
 * $months: 时长月数（无自定义到期时用）
 * $periodEnd: 自定义到期（优先）
 * $grantMultiplier: 发放套餐积分倍数；0=不发；1=发 1 个账期；N=按月数倍发
 * 兼容旧调用：等价于 changeType=open
 */
function tn_assign_plan($userId, $planId, $note = '', $months = 1, $periodEnd = '', $grantMultiplier = 1) {
  $grantMode = 'one';
  if ((int)$grantMultiplier <= 0) $grantMode = 'none';
  elseif ((int)$grantMultiplier > 1) $grantMode = 'months';
  return tn_change_subscription($userId, $planId, 'open', $note, $months, $periodEnd, $grantMode);
}

/** 档位高低：trial < standard < advanced < flagship */
function tn_plan_rank($planId) {
  $map = array(
    'trial' => 0,
    'free' => 0,
    'standard' => 1,
    'advanced' => 2,
    'pro' => 2,
    'flagship' => 3,
    'max' => 3,
  );
  return isset($map[$planId]) ? $map[$planId] : -1;
}

/**
 * 会员变更：open | upgrade | renew | downgrade | downgrade_now
 * grantMode：diff | one | months | none
 */
function tn_change_subscription($userId, $planId, $changeType, $note = '', $months = 1, $periodEnd = '', $grantMode = '') {
  tn_ensure_subscription_columns();
  $userId = (int)$userId;
  $planId = trim((string)$planId);
  $changeType = trim((string)$changeType);
  if ($changeType === '') $changeType = 'open';
  $st = tn_db()->prepare('SELECT * FROM tn_plans WHERE id=?');
  $st->execute(array($planId));
  $plan = $st->fetch();
  if (!$plan) throw new Exception('plan not found');

  $pdo = tn_db();
  $subSt = $pdo->prepare('SELECT * FROM tn_subscriptions WHERE user_id=?');
  $subSt->execute(array($userId));
  $sub = $subSt->fetch();
  $fromPlan = ($sub && isset($sub['plan_id'])) ? $sub['plan_id'] : '';
  $t = tn_now();
  $months = (int)$months;
  if ($months < 1) $months = 1;
  $customEnd = tn_normalize_period_end($periodEnd);

  if ($grantMode === '') {
    if ($changeType === 'upgrade') $grantMode = 'diff';
    elseif ($changeType === 'downgrade' || $changeType === 'downgrade_now') $grantMode = 'none';
    else $grantMode = 'one';
  }

  $labelBase = $note !== '' ? $note : ($fromPlan !== '' ? ($fromPlan . '→' . $planId) : ('开通 ' . $plan['name']));

  if ($changeType === 'downgrade') {
    if (!$sub) throw new Exception('无订阅，无法预约降级');
    if (tn_plan_rank($planId) >= tn_plan_rank($fromPlan) && $fromPlan !== '') {
      throw new Exception('预约降级请选择更低档位');
    }
    $pdo->prepare('UPDATE tn_subscriptions SET pending_plan_id=?, updated_at=? WHERE user_id=?')
      ->execute(array($planId, $t, $userId));
    return array('ok' => true, 'changeType' => 'downgrade', 'from' => $fromPlan, 'to' => $planId, 'pending' => true);
  }

  $newStart = $t;
  $newEnd = $customEnd;
  $clearPending = true;

  if ($changeType === 'upgrade') {
    if ($sub && !empty($sub['period_end']) && $customEnd === '') {
      $newEnd = $sub['period_end'];
      $newStart = !empty($sub['period_start']) ? $sub['period_start'] : $t;
    }
    if ($newEnd === '') $newEnd = tn_add_months($t, $months);
  } elseif ($changeType === 'renew') {
    $planId = $fromPlan !== '' ? $fromPlan : $planId;
    $st->execute(array($planId));
    $plan = $st->fetch();
    if (!$plan) throw new Exception('plan not found');
    if ($customEnd !== '') {
      $newEnd = $customEnd;
    } else {
      $base = $t;
      if ($sub && !empty($sub['period_end']) && strtotime($sub['period_end']) > time()) {
        $base = $sub['period_end'];
      }
      $newEnd = tn_add_months($base, $months);
    }
    if ($sub && !empty($sub['period_start']) && strtotime($sub['period_end']) > time()) {
      $newStart = $sub['period_start'];
    }
  } elseif ($changeType === 'downgrade_now') {
    if ($sub && !empty($sub['period_end']) && $customEnd === '') {
      $newEnd = $sub['period_end'];
      $newStart = !empty($sub['period_start']) ? $sub['period_start'] : $t;
    }
    if ($newEnd === '') $newEnd = tn_add_months($t, $months);
  } else {
    // open
    if ($newEnd === '') $newEnd = tn_add_months($t, $months);
  }

  if ($sub) {
    $pdo->prepare('UPDATE tn_subscriptions SET plan_id=?, status=?, period_start=?, period_end=?, pending_plan_id=?, updated_at=? WHERE user_id=?')
      ->execute(array($planId, 'active', $newStart, $newEnd, $clearPending ? '' : '', $t, $userId));
  } else {
    $pdo->prepare('INSERT INTO tn_subscriptions (user_id,plan_id,status,period_start,period_end,pending_plan_id,updated_at) VALUES (?,?,?,?,?,?,?)')
      ->execute(array($userId, $planId, 'active', $newStart, $newEnd, '', $t));
  }

  $grant = 0;
  if ($grantMode === 'diff') {
    $toGrant = tn_plan_grant($plan);
    $fromGrant = 0;
    if ($fromPlan !== '') {
      $fp = $pdo->prepare('SELECT * FROM tn_plans WHERE id=?');
      $fp->execute(array($fromPlan));
      $fromGrant = tn_plan_grant($fp->fetch());
    }
    $grant = $toGrant - $fromGrant;
    if ($grant < 0) $grant = 0;
  } elseif ($grantMode === 'months') {
    $grant = tn_plan_grant($plan) * $months;
  } elseif ($grantMode === 'none') {
    $grant = 0;
  } else {
    $grant = tn_plan_grant($plan);
  }

  if ($grant > 0) {
    $label = $labelBase . ' +' . $grant;
    tn_apply_credit($userId, $grant, 'offline_topup', 'monthly_grant', '', $label);
  }
  return array(
    'ok' => true,
    'changeType' => $changeType,
    'from' => $fromPlan,
    'to' => $planId,
    'periodEnd' => $newEnd,
    'granted' => $grant,
  );
}

/**
 * 将 pending 订单标为已付并履约（线下确认 / Stripe webhook 共用，幂等）。
 * $opts: paymentNote, externalTradeNo, months, changeType
 */
function tn_fulfill_paid_order($id, $opts) {
  if (!is_array($opts)) $opts = array();
  $id = trim((string)$id);
  if ($id === '') throw new Exception('id required');
  $pdo = tn_db();
  $st = $pdo->prepare('SELECT * FROM tn_orders WHERE id=?');
  $st->execute(array($id));
  $ord = $st->fetch();
  if (!$ord) throw new Exception('order not found');
  if ($ord['status'] === 'paid') return $ord;
  if ($ord['status'] === 'rejected') throw new Exception('已拒绝的意向不可履约');

  $note = isset($opts['paymentNote']) ? $opts['paymentNote'] : $ord['payment_note'];
  $ext = isset($opts['externalTradeNo']) ? $opts['externalTradeNo'] : $ord['external_trade_no'];
  $parsed = array('kind' => '', 'interval' => 'month', 'change' => 'open');
  if (function_exists('tn_parse_stripe_note')) {
    $parsed = tn_parse_stripe_note($ord['payment_note']);
  }
  $changeType = isset($opts['changeType']) && $opts['changeType'] !== '' ? $opts['changeType'] : $parsed['change'];
  if ($changeType === '' || $changeType === 'topup') $changeType = 'open';
  $months = isset($opts['months']) ? (int)$opts['months'] : 0;
  if ($months < 1) $months = ($parsed['interval'] === 'year') ? 12 : 1;
  $t = tn_now();
  $pdo->prepare('UPDATE tn_orders SET status=?, payment_note=?, paid_at=?, external_trade_no=? WHERE id=?')
    ->execute(array('paid', $note, $t, $ext, $id));
  $uid = (int)$ord['user_id'];
  if ($ord['plan_id'] !== '') {
    tn_change_subscription($uid, $ord['plan_id'], $changeType, '履约 '.$id.' '.$note, $months, '', '');
  } elseif ((int)$ord['credits'] > 0) {
    $reason = ($ord['source'] === 'stripe') ? 'stripe_topup' : 'offline_topup';
    tn_apply_credit($uid, (int)$ord['credits'], $reason, 'purchased', $id, $note);
  }
  $st->execute(array($id));
  return $st->fetch();
}

/** 解析手机号/用户 ID，必要时建档 */
function tn_resolve_user_id($userId, $phone) {
  $userId = (int)$userId;
  $phone = preg_replace('/\D+/', '', (string)$phone);
  if ($userId > 0) return $userId;
  if ($phone === '') return 0;
  $st = tn_db()->prepare('SELECT id FROM tn_users WHERE phone=?');
  $st->execute(array($phone));
  $id = (int)$st->fetchColumn();
  if ($id) return $id;
  $user = tn_ensure_user($phone);
  return (int)$user['id'];
}

/** 管理后台用户行（含档位 / 到期 / 预约降档） */
function tn_admin_user_row($u) {
  return array(
    'id' => (int)$u['id'],
    'phone' => $u['phone'],
    'display_name' => isset($u['display_name']) ? $u['display_name'] : '',
    'frozen' => (int)$u['frozen'],
    'balance' => isset($u['balance']) ? (int)$u['balance'] : 0,
    'plan_id' => isset($u['plan_id']) ? $u['plan_id'] : '',
    'plan_name' => isset($u['plan_name']) ? $u['plan_name'] : '',
    'sub_status' => isset($u['sub_status']) ? $u['sub_status'] : '',
    'period_start' => isset($u['period_start']) ? $u['period_start'] : '',
    'period_end' => isset($u['period_end']) ? $u['period_end'] : '',
    'pending_plan_id' => isset($u['pending_plan_id']) ? $u['pending_plan_id'] : '',
    'created_at' => isset($u['created_at']) ? $u['created_at'] : '',
  );
}

function tn_require_admin() {
  $raw = tn_bearer();
  if ($raw === '') tn_json(array('error' => 'admin auth required'), 401);
  $st = tn_db()->prepare('SELECT 1 FROM tn_admin_sessions WHERE token=? AND expires_at>?');
  $st->execute(array(tn_hash($raw), tn_now()));
  if (!$st->fetchColumn()) tn_json(array('error' => 'admin auth required'), 401);
}

function tn_apply_credit($userId, $delta, $reason, $grantType = '', $requestId = '', $note = '') {
  $pdo = tn_db();
  $pdo->beginTransaction();
  $started = true;
  try {
    $st = $pdo->prepare('SELECT balance FROM tn_credit_accounts WHERE user_id=? FOR UPDATE');
    $st->execute(array($userId));
    $bal = (int)$st->fetchColumn();
    $next = $bal + (int)$delta;
    if ($next < 0) {
      $pdo->rollBack();
      $started = false;
      $GLOBALS['tn_err_balance'] = $bal;
      throw new Exception('INSUFFICIENT_CREDITS');
    }
    $t = tn_now();
    $pdo->prepare('UPDATE tn_credit_accounts SET balance=?, updated_at=? WHERE user_id=?')->execute(array($next, $t, $userId));
    $pdo->prepare('INSERT INTO tn_credit_ledger (user_id,delta,balance_after,reason,grant_type,request_id,note,created_at) VALUES (?,?,?,?,?,?,?,?)')
      ->execute(array($userId, (int)$delta, $next, $reason, $grantType, $requestId, $note, $t));
    $pdo->commit();
    $started = false;
    return $next;
  } catch (Exception $e) {
    if ($started) {
      try { $pdo->rollBack(); } catch (Exception $e2) {}
    }
    throw $e;
  }
}

function tn_ensure_user($phone) {
  $pdo = tn_db();
  $st = $pdo->prepare('SELECT * FROM tn_users WHERE phone=?');
  $st->execute(array($phone));
  $u = $st->fetch();
  if ($u) {
    tn_ensure_default_plan((int)$u['id']);
    $st->execute(array($phone));
    return $st->fetch();
  }
  $t = tn_now();
  $pdo->prepare('INSERT INTO tn_users (phone,display_name,frozen,created_at,updated_at) VALUES (?,?,0,?,?)')->execute(array($phone, $phone, $t, $t));
  $id = (int)$pdo->lastInsertId();
  $pdo->prepare('INSERT INTO tn_credit_accounts (user_id,balance,updated_at) VALUES (?,?,?)')->execute(array($id, 0, $t));
  tn_ensure_default_plan($id, true);
  $st->execute(array($phone));
  return $st->fetch();
}

/**
 * 未购买付费档时默认体验版。
 * $forceGrant: 新用户建档时强制发体验积分；已有用户仅在无订阅时补档，有订阅则不改。
 */
function tn_ensure_default_plan($userId, $forceGrant = false) {
  $userId = (int)$userId;
  if ($userId < 1) return;
  $pdo = tn_db();
  $st = $pdo->prepare('SELECT * FROM tn_subscriptions WHERE user_id=?');
  $st->execute(array($userId));
  $sub = $st->fetch();
  $need = false;
  if (!$sub || !isset($sub['plan_id']) || $sub['plan_id'] === '') {
    $need = true;
  } else {
    $p = $pdo->prepare('SELECT id FROM tn_plans WHERE id=?');
    $p->execute(array($sub['plan_id']));
    if (!$p->fetch()) $need = true;
  }
  if (!$need) return;

  $t = tn_now();
  $end = tn_add_months($t, 1);
  if ($sub) {
    $pdo->prepare('UPDATE tn_subscriptions SET plan_id=?, status=?, period_start=?, period_end=?, updated_at=? WHERE user_id=?')
      ->execute(array('trial', 'active', $t, $end, $t, $userId));
  } else {
    $pdo->prepare('INSERT INTO tn_subscriptions (user_id,plan_id,status,period_start,period_end,updated_at) VALUES (?,?,?,?,?,?)')
      ->execute(array($userId, 'trial', 'active', $t, $end, $t));
  }

  $shouldGrant = $forceGrant;
  if (!$shouldGrant) {
    // 从未发过月度/开通类积分则补发体验额度
    $lg = $pdo->prepare("SELECT 1 FROM tn_credit_ledger WHERE user_id=? AND grant_type='monthly_grant' LIMIT 1");
    $lg->execute(array($userId));
    if (!$lg->fetchColumn()) $shouldGrant = true;
  }
  if (!$shouldGrant) return;

  $planSt = $pdo->query("SELECT * FROM tn_plans WHERE id='trial'");
  $trial = $planSt ? $planSt->fetch() : null;
  $grant = tn_plan_grant($trial);
  if ($grant > 0) {
    tn_apply_credit($userId, $grant, 'monthly_reset', 'monthly_grant', '', '默认体验版 +' . $grant);
  }
}

function tn_create_session($userId) {
  $raw = tn_token();
  $t = tn_now();
  $exp = gmdate('Y-m-d\TH:i:s', strtotime('+30 days')) . '.000Z';
  tn_db()->prepare('INSERT INTO tn_sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)')
    ->execute(array(tn_hash($raw), $userId, $t, $exp));
  return array('accessToken' => $raw, 'expiresAt' => $exp);
}

function tn_require_user() {
  $raw = tn_bearer();
  if ($raw === '') {
    $e = new Exception('UNAUTHORIZED');
    throw $e;
  }
  $st = tn_db()->prepare('SELECT u.* FROM tn_sessions s JOIN tn_users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?');
  $st->execute(array(tn_hash($raw), tn_now()));
  $u = $st->fetch();
  if (!$u) throw new Exception('UNAUTHORIZED');
  if ((int)$u['frozen'] === 1) throw new Exception('ACCOUNT_FROZEN');
  return $u;
}

function tn_refresh_monthly($userId) {
  tn_ensure_subscription_columns();
  $st = tn_db()->prepare('SELECT * FROM tn_subscriptions WHERE user_id=?');
  $st->execute(array($userId));
  $sub = $st->fetch();
  if (!$sub || $sub['status'] !== 'active') return;
  if (strtotime($sub['period_end']) > time()) return;

  $pending = isset($sub['pending_plan_id']) ? trim($sub['pending_plan_id']) : '';
  $planId = $sub['plan_id'];
  if ($pending !== '') {
    $chk = tn_db()->prepare('SELECT id FROM tn_plans WHERE id=?');
    $chk->execute(array($pending));
    if ($chk->fetch()) $planId = $pending;
  }

  $planSt = tn_db()->prepare('SELECT * FROM tn_plans WHERE id=?');
  $planSt->execute(array($planId));
  $plan = $planSt->fetch();
  if (!$plan) return;
  $start = tn_now();
  $end = tn_add_months($start, 1);
  tn_db()->prepare('UPDATE tn_subscriptions SET plan_id=?, period_start=?, period_end=?, pending_plan_id=?, updated_at=? WHERE user_id=?')
    ->execute(array($planId, $start, $end, '', $start, $userId));
  $grant = tn_plan_grant($plan);
  $note = $plan['name'] . ' 月度赠送 ' . $grant;
  if ($pending !== '' && $pending === $planId) {
    $note = '预约降级生效 ' . $sub['plan_id'] . '→' . $planId . ' +' . $grant;
  }
  if ($grant > 0) tn_apply_credit($userId, $grant, 'monthly_reset', 'monthly_grant', '', $note);
}

/** 更新用户昵称；成功返回最新 user 行，失败返回 array('error'=>...) */
function tn_update_display_name($user, $displayName) {
  $name = trim((string)$displayName);
  $name = preg_replace('/[\x00-\x1F\x7F]+/', '', $name);
  $len = function_exists('mb_strlen') ? mb_strlen($name, 'UTF-8') : strlen($name);
  if ($name === '' || $len < 1) return array('error' => '昵称不能为空');
  if ($len > 32) return array('error' => '昵称最多 32 个字符');
  $pdo = tn_db();
  $pdo->prepare('UPDATE tn_users SET display_name=?, updated_at=? WHERE id=?')
    ->execute(array($name, tn_now(), (int)$user['id']));
  $st = $pdo->prepare('SELECT * FROM tn_users WHERE id=?');
  $st->execute(array((int)$user['id']));
  $row = $st->fetch();
  return $row ? $row : array('error' => '用户不存在');
}

function tn_me($user) {
  tn_ensure_default_plan((int)$user['id']);
  tn_refresh_monthly((int)$user['id']);
  $pdo = tn_db();
  $sub = $pdo->prepare('SELECT * FROM tn_subscriptions WHERE user_id=?');
  $sub->execute(array((int)$user['id']));
  $subRow = $sub->fetch();
  $plan = null;
  if ($subRow) {
    $p = $pdo->prepare('SELECT * FROM tn_plans WHERE id=?');
    $p->execute(array($subRow['plan_id']));
    $plan = $p->fetch();
  }
  $bst = $pdo->prepare('SELECT balance FROM tn_credit_accounts WHERE user_id=?');
  $bst->execute(array((int)$user['id']));
  $balance = (int)$bst->fetchColumn();
  $periodQuota = $plan ? tn_plan_grant($plan) : 0;
  $periodUsed = 0;
  if ($subRow && !empty($subRow['period_start'])) {
    $ust = $pdo->prepare(
      "SELECT COALESCE(SUM(ABS(delta)),0) FROM tn_credit_ledger
       WHERE user_id=? AND grant_type='consume' AND created_at>=?"
    );
    $ust->execute(array((int)$user['id'], $subRow['period_start']));
    $periodUsed = (int)$ust->fetchColumn();
  }
  $periodRemaining = $periodQuota > 0 ? max(0, $periodQuota - $periodUsed) : max(0, $balance);
  $prices = tn_prices();
  $voice = isset($prices['voiceCreditsPerMinute']) ? $prices['voiceCreditsPerMinute'] : 2;
  $reply = (isset($prices['replyCredits']) ? $prices['replyCredits'] : 10) + (isset($prices['replyVisionCredits']) ? $prices['replyVisionCredits'] : 5);
  $screen = isset($prices['screenAskCredits']) ? $prices['screenAskCredits'] : 25;
  return array(
    'id' => (int)$user['id'],
    'phone' => $user['phone'],
    'displayName' => $user['display_name'],
    'frozen' => ((int)$user['frozen'] === 1),
    'balance' => $balance,
    'plan' => $plan ? tn_plan_public($plan) : null,
    'subscription' => $subRow ? array(
      'status' => $subRow['status'],
      'periodStart' => $subRow['period_start'],
      'periodEnd' => $subRow['period_end'],
      'pendingPlanId' => isset($subRow['pending_plan_id']) ? $subRow['pending_plan_id'] : '',
    ) : null,
    'usage' => array(
      'periodQuota' => $periodQuota,
      'periodUsed' => $periodUsed,
      'periodRemaining' => $periodRemaining,
      'walletBalance' => $balance,
    ),
    'prices' => $prices,
    'estimate' => array(
      'voiceMinutes' => $voice > 0 ? (int)floor($balance / $voice) : 0,
      'replyTimes' => $reply > 0 ? (int)floor($balance / $reply) : 0,
      'screenAskTimes' => $screen > 0 ? (int)floor($balance / $screen) : 0,
    ),
    'ops' => array(
      'paymentHint' => tn_setting('ops_payment_hint'),
      'supportContact' => tn_setting('ops_support_contact'),
    ),
    // 官方三槽模型（无 Key）；客户端切官方会员时同步到本地展示/请求字段
    'modelRoutes' => tn_public_model_routes(),
  );
}

/** 会员可见的官方模型路由（不含上游 Key） */
function tn_public_model_routes() {
  $pdo = tn_db();
  $out = array(
    'asr' => '',
    'vision' => '',
    'chat' => '',
  );
  $rows = $pdo->query('SELECT slot, model_id FROM tn_model_routes')->fetchAll();
  if (!$rows) return $out;
  foreach ($rows as $r) {
    $slot = isset($r['slot']) ? $r['slot'] : '';
    if ($slot === 'asr' || $slot === 'vision' || $slot === 'chat') {
      $out[$slot] = isset($r['model_id']) ? (string)$r['model_id'] : '';
    }
  }
  return $out;
}

/** 当前用户积分明细（按天数或起止过滤） */
function tn_user_ledger($userId, $days = 7, $from = '', $to = '') {
  $pdo = tn_db();
  $days = (int)$days;
  if ($days !== 1 && $days !== 7 && $days !== 30) $days = 7;
  $params = array((int)$userId);
  $where = 'user_id=?';
  if ($from !== '' && $to !== '') {
    $where .= ' AND created_at>=? AND created_at<=?';
    $params[] = $from;
    $params[] = $to;
  } else {
    $since = gmdate('Y-m-d\TH:i:s', time() - ($days * 86400)) . '.000Z';
    $where .= ' AND created_at>=?';
    $params[] = $since;
  }
  $st = $pdo->prepare(
    "SELECT id, delta, balance_after, reason, grant_type, request_id, note, created_at
     FROM tn_credit_ledger WHERE $where ORDER BY id DESC LIMIT 200"
  );
  $st->execute($params);
  $rows = $st->fetchAll();
  $out = array();
  foreach ($rows as $r) {
    $out[] = array(
      'id' => (int)$r['id'],
      'delta' => (int)$r['delta'],
      'balanceAfter' => (int)$r['balance_after'],
      'reason' => $r['reason'],
      'grantType' => $r['grant_type'],
      'requestId' => $r['request_id'] ? $r['request_id'] : '',
      'note' => $r['note'] ? $r['note'] : '',
      'createdAt' => $r['created_at'],
    );
  }
  return array(
    'days' => $days,
    'from' => $from,
    'to' => $to,
    'ledger' => $out,
  );
}

function tn_public_error($e) {
  $msg = $e->getMessage();
  $code = 500;
  $payload = array('error' => $msg, 'code' => $msg);
  if ($msg === 'INSUFFICIENT_CREDITS') {
    $code = 402;
    $bal = isset($GLOBALS['tn_err_balance']) ? $GLOBALS['tn_err_balance'] : 0;
    $payload['error'] = '积分不足（当前 ' . $bal . '）。请充值或改用自配 Key。';
    $payload['code'] = 'INSUFFICIENT_CREDITS';
  } elseif ($msg === 'UNAUTHORIZED') {
    $code = 401;
  } elseif ($msg === 'ACCOUNT_FROZEN') {
    $code = 403;
  }
  tn_json($payload, $code);
}
