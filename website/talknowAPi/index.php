<?php
/**
 * TalkNow membership API front controller — PHP 5.2.6 / IIS
 * Prefer: /talknowAPi/index.php/v1/...
 */
error_reporting(E_ALL);
ini_set('display_errors', '0');

require_once dirname(__FILE__) . '/lib/domain.php';
require_once dirname(__FILE__) . '/lib/stripe.php';

tn_cors();

try {
  tn_ensure_schema();
} catch (Exception $e) {
  tn_json(array('error' => 'DB init failed: ' . $e->getMessage()), 500);
}

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
$path = '';
if (isset($_GET['r']) && $_GET['r'] !== '') {
  $path = $_GET['r'];
} elseif (!empty($_SERVER['PATH_INFO'])) {
  $path = $_SERVER['PATH_INFO'];
} else {
  $uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
  $pathOnly = parse_url($uri, PHP_URL_PATH);
  $script = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '';
  if ($script && strpos($pathOnly, $script) === 0) {
    $path = substr($pathOnly, strlen($script));
  } else {
    $base = rtrim(str_replace('\\', '/', dirname($script)), '/');
    if ($base && strpos($pathOnly, $base) === 0) {
      $path = substr($pathOnly, strlen($base));
    } else {
      $path = $pathOnly;
    }
  }
}
$path = '/' . trim($path, '/');
if ($path === '//') $path = '/';
if ($path === '/index.php') $path = '/';

if ($path === '/' || $path === '/health') {
  tn_json(array('ok' => true, 'service' => 'talknow-membership-php', 'php' => PHP_VERSION));
}

try {
  tn_route($method, $path);
} catch (Exception $e) {
  tn_public_error($e);
}
tn_json(array('error' => 'not found', 'path' => $path), 404);

function tn_route($method, $path) {
  $pdo = tn_db();
  $body = tn_read_json();

  if ($method === 'POST' && $path === '/v1/auth/request-code') {
    $phone = preg_replace('/\D+/', '', isset($body['phone']) ? $body['phone'] : '');
    if (strlen($phone) < 6) tn_json(array('error' => 'invalid phone'), 400);
    $cfg = tn_config();
    $code = !empty($cfg['dev_login_code']) ? $cfg['dev_login_code'] : (string)mt_rand(100000, 999999);
    $exp = gmdate('Y-m-d\TH:i:s', strtotime('+10 minutes')) . '.000Z';
    $pdo->prepare('INSERT INTO tn_login_codes (phone,code,expires_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE code=VALUES(code), expires_at=VALUES(expires_at)')
      ->execute(array($phone, $code, $exp));
    $out = array('ok' => true, 'expiresAt' => $exp);
    if (!empty($cfg['dev_login_code'])) $out['devHint'] = '开发态：使用固定验证码登录';
    tn_json($out);
  }

  if ($method === 'POST' && $path === '/v1/auth/login') {
    $phone = preg_replace('/\D+/', '', isset($body['phone']) ? $body['phone'] : '');
    $code = trim(isset($body['code']) ? $body['code'] : '');
    if ($phone === '' || $code === '') tn_json(array('error' => 'phone and code required'), 400);
    $st = $pdo->prepare('SELECT * FROM tn_login_codes WHERE phone=?');
    $st->execute(array($phone));
    $row = $st->fetch();
    $cfgLogin = tn_config();
    $dev = isset($cfgLogin['dev_login_code']) ? $cfgLogin['dev_login_code'] : '';
    $ok = ($dev && $code === $dev) || ($row && $row['code'] === $code && strtotime($row['expires_at']) > time());
    if (!$ok) tn_json(array('error' => '验证码无效或已过期'), 401);
    $pdo->prepare('DELETE FROM tn_login_codes WHERE phone=?')->execute(array($phone));
    $user = tn_ensure_user($phone);
    if ((int)$user['frozen'] === 1) tn_json(array('error' => '账号已冻结'), 403);
    $session = tn_create_session((int)$user['id']);
    $out = $session;
    $out['me'] = tn_me($user);
    tn_json($out);
  }

  if ($method === 'GET' && $path === '/v1/me') {
    tn_json(tn_me(tn_require_user()));
  }

  // 官方三槽模型（登录后可见；不含 Key）
  if ($method === 'GET' && $path === '/v1/model-routes') {
    tn_require_user();
    tn_json(array('routes' => tn_public_model_routes()));
  }

  // WAF 友好：用 POST 更新资料（勿用 PUT）
  if ($method === 'POST' && $path === '/v1/me-save') {
    $user = tn_require_user();
    $name = isset($body['displayName']) ? $body['displayName'] : '';
    $updated = tn_update_display_name($user, $name);
    if (isset($updated['error'])) tn_json(array('error' => $updated['error']), 400);
    tn_json(tn_me($updated));
  }

  if ($method === 'GET' && $path === '/v1/ledger') {
    $user = tn_require_user();
    $days = isset($_GET['days']) ? (int)$_GET['days'] : 7;
    $from = isset($_GET['from']) ? trim($_GET['from']) : '';
    $to = isset($_GET['to']) ? trim($_GET['to']) : '';
    tn_json(tn_user_ledger((int)$user['id'], $days, $from, $to));
  }

  if ($method === 'GET' && $path === '/v1/plans') {
    // trial → standard → advanced → flagship
    $plans = $pdo->query(
      "SELECT * FROM tn_plans WHERE active=1 ORDER BY FIELD(id,'trial','standard','advanced','flagship'), sort_order, id"
    )->fetchAll();
    $mapped = array();
    foreach ($plans as $p) {
      $mapped[] = tn_plan_public($p);
    }
    tn_json(array(
      'plans' => $mapped,
      'prices' => tn_prices(),
      'topup' => array('credits' => 1000, 'priceCents' => 2000),
      'stripeEnabled' => tn_stripe_configured(),
      'ops' => array(
        'paymentHint' => tn_setting('ops_payment_hint'),
        'supportContact' => tn_setting('ops_support_contact'),
      ),
    ));
  }

  if ($method === 'POST' && $path === '/v1/redeem') {
    $user = tn_require_user();
    $code = strtoupper(trim(isset($body['code']) ? $body['code'] : ''));
    if ($code === '') tn_json(array('error' => 'code required'), 400);
    $st = $pdo->prepare('SELECT * FROM tn_redeem_codes WHERE code=?');
    $st->execute(array($code));
    $row = $st->fetch();
    if (!$row) tn_json(array('error' => '兑换码不存在'), 404);
    if ($row['expires_at'] !== '' && strtotime($row['expires_at']) < time()) tn_json(array('error' => '兑换码已过期'), 400);
    if ((int)$row['used_count'] >= (int)$row['max_uses']) tn_json(array('error' => '兑换码已用完'), 400);
    // Do not nest transactions: tn_apply_credit() already opens one
    $upd = $pdo->prepare('UPDATE tn_redeem_codes SET used_count=used_count+1 WHERE code=? AND used_count<max_uses');
    $upd->execute(array($code));
    if ($upd->rowCount() < 1) tn_json(array('error' => '兑换码已用完'), 400);
    tn_apply_credit((int)$user['id'], (int)$row['credits'], 'redeem', 'purchased', $code, (string)$row['note']);
    tn_json(array('ok' => true, 'credits' => (int)$row['credits'], 'me' => tn_me($user)));
  }

  if ($method === 'POST' && ($path === '/v1/stripe/webhook' || $path === '/v1/webhooks/stripe')) {
    tn_stripe_webhook();
  }

  if ($method === 'GET' && preg_match('#^/v1/orders/([^/]+)$#', $path, $m)) {
    $user = tn_require_user();
    $st = $pdo->prepare('SELECT * FROM tn_orders WHERE id=? AND user_id=?');
    $st->execute(array($m[1], (int)$user['id']));
    $ord = $st->fetch();
    if (!$ord) tn_json(array('error' => 'not found'), 404);
    tn_json($ord);
  }

  if ($method === 'GET' && $path === '/v1/order-get') {
    $user = tn_require_user();
    $oid = isset($_GET['id']) ? $_GET['id'] : '';
    $st = $pdo->prepare('SELECT * FROM tn_orders WHERE id=? AND user_id=?');
    $st->execute(array($oid, (int)$user['id']));
    $ord = $st->fetch();
    if (!$ord) tn_json(array('error' => 'not found'), 404);
    tn_json($ord);
  }

  if ($method === 'POST' && $path === '/v1/orders') {
    $user = tn_require_user();
    $source = isset($body['source']) ? $body['source'] : 'offline';
    if ($source === 'wechat' || $source === 'alipay') {
      tn_json(array('error' => '在线支付尚未开通', 'code' => 'PAYMENT_NOT_ENABLED'), 501);
    }
    if ($source === 'stripe') {
      tn_stripe_create_checkout($user, $body);
    }
    $id = 'intent_' . substr(tn_token(), 0, 12);
    $t = tn_now();
    $pdo->prepare('INSERT INTO tn_orders (id,user_id,source,channel,plan_id,credits,amount_cents,status,payment_note,created_at,paid_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      ->execute(array(
        $id, (int)$user['id'], 'offline', '',
        isset($body['planId']) ? $body['planId'] : '',
        isset($body['credits']) ? (int)$body['credits'] : 0,
        isset($body['amountCents']) ? (int)$body['amountCents'] : 0,
        'pending',
        '用户线下意向；' . tn_setting('ops_support_contact'),
        $t, '',
      ));
    tn_json(array(
      'id' => $id,
      'status' => 'pending',
      'source' => 'offline',
      'paymentHint' => tn_setting('ops_payment_hint'),
      'supportContact' => tn_setting('ops_support_contact'),
    ));
  }

  if ($method === 'POST' && $path === '/v1/proxy/audio/transcriptions') {
    tn_proxy_asr();
  }
  if ($method === 'POST' && $path === '/v1/proxy/chat/completions') {
    tn_proxy_chat();
  }

  if ($method === 'POST' && $path === '/v1/admin/login') {
    $cfg = tn_config();
    $u = isset($body['username']) ? $body['username'] : '';
    $p = isset($body['password']) ? $body['password'] : '';
    if ($u !== $cfg['admin_user'] || $p !== $cfg['admin_pass']) tn_json(array('error' => '用户名或密码错误'), 401);
    $raw = tn_token();
    $t = tn_now();
    $exp = gmdate('Y-m-d\TH:i:s', strtotime('+7 days')) . '.000Z';
    $pdo->prepare('INSERT INTO tn_admin_sessions (token,created_at,expires_at) VALUES (?,?,?)')
      ->execute(array(tn_hash($raw), $t, $exp));
    tn_json(array('accessToken' => $raw, 'expiresAt' => $exp));
  }

  if (strpos($path, '/v1/admin/') === 0 && $path !== '/v1/admin/login') {
    tn_admin_route($method, $path, $body);
  }
}

function tn_admin_route($method, $path, $body) {
  tn_require_admin();
  $pdo = tn_db();

  if ($method === 'GET' && $path === '/v1/admin/users') {
    $q = isset($_GET['q']) ? trim($_GET['q']) : '';
    $sql = 'SELECT u.*, c.balance, s.plan_id, s.status AS sub_status, s.period_start, s.period_end, s.pending_plan_id, p.name AS plan_name
      FROM tn_users u
      LEFT JOIN tn_credit_accounts c ON c.user_id=u.id
      LEFT JOIN tn_subscriptions s ON s.user_id=u.id
      LEFT JOIN tn_plans p ON p.id=s.plan_id';
    if ($q !== '') {
      $st = $pdo->prepare($sql . ' WHERE u.phone LIKE ? OR u.display_name LIKE ? ORDER BY u.id DESC LIMIT 100');
      $st->execute(array('%'.$q.'%', '%'.$q.'%'));
    } else {
      $st = $pdo->query($sql . ' ORDER BY u.id DESC LIMIT 100');
    }
    $rows = $st->fetchAll();
    $out = array();
    foreach ($rows as $u) $out[] = tn_admin_user_row($u);
    tn_json(array('users' => $out));
  }
  if ($method === 'GET' && preg_match('#^/v1/admin/users/(\d+)$#', $path, $m)) {
    $st = $pdo->prepare(
      'SELECT u.*, c.balance, s.plan_id, s.status AS sub_status, s.period_start, s.period_end, s.pending_plan_id, p.name AS plan_name
       FROM tn_users u
       LEFT JOIN tn_credit_accounts c ON c.user_id=u.id
       LEFT JOIN tn_subscriptions s ON s.user_id=u.id
       LEFT JOIN tn_plans p ON p.id=s.plan_id
       WHERE u.id=?'
    );
    $st->execute(array((int)$m[1]));
    $u = $st->fetch();
    if (!$u) tn_json(array('error' => 'user not found'), 404);
    tn_json(array('user' => tn_admin_user_row($u)));
  }
  if ($method === 'POST' && preg_match('#^/v1/admin/users/(\d+)/freeze$#', $path, $m)) {
    $pdo->prepare('UPDATE tn_users SET frozen=?, updated_at=? WHERE id=?')
      ->execute(array(!empty($body['frozen']) ? 1 : 0, tn_now(), (int)$m[1]));
    tn_json(array('ok' => true));
  }
  if ($method === 'GET' && $path === '/v1/admin/ledger') {
    $uid = isset($_GET['userId']) ? (int)$_GET['userId'] : 0;
    $phone = isset($_GET['phone']) ? preg_replace('/\D+/', '', $_GET['phone']) : '';
    if (!$uid && $phone !== '') {
      $st = $pdo->prepare('SELECT id FROM tn_users WHERE phone=?');
      $st->execute(array($phone));
      $uid = (int)$st->fetchColumn();
      if (!$uid) tn_json(array('ledger' => array()));
    }
    if ($uid) {
      $st = $pdo->prepare('SELECT l.*, u.phone AS phone FROM tn_credit_ledger l LEFT JOIN tn_users u ON u.id=l.user_id WHERE l.user_id=? ORDER BY l.id DESC LIMIT 200');
      $st->execute(array($uid));
    } else {
      $st = $pdo->query('SELECT l.*, u.phone AS phone FROM tn_credit_ledger l LEFT JOIN tn_users u ON u.id=l.user_id ORDER BY l.id DESC LIMIT 200');
    }
    tn_json(array('ledger' => $st->fetchAll()));
  }
  if ($method === 'GET' && $path === '/v1/admin/plans') {
    tn_json(array(
      'plans' => $pdo->query(
        "SELECT * FROM tn_plans ORDER BY FIELD(id,'trial','standard','advanced','flagship'), sort_order, id"
      )->fetchAll()
    ));
  }
  // WAF/IIS: PUT often returns fake 200 HTML — use POST *-save
  if (($method === 'PUT' && preg_match('#^/v1/admin/plans/([^/]+)$#', $path, $m))
    || ($method === 'POST' && $path === '/v1/admin/plans-save')) {
    $planId = ($method === 'POST') ? (isset($body['id']) ? $body['id'] : '') : $m[1];
    if ($planId === '') tn_json(array('error' => 'plan id required'), 400);
    $st = $pdo->prepare('SELECT * FROM tn_plans WHERE id=?');
    $st->execute(array($planId));
    $ex = $st->fetch();
    if (!$ex) tn_json(array('error' => 'plan not found'), 404);
    $sort = isset($body['sort_order']) ? (int)$body['sort_order'] : (int)$ex['sort_order'];
    if ($planId === 'trial') $sort = 0;
    if ($planId === 'standard') $sort = 10;
    if ($planId === 'advanced') $sort = 20;
    if ($planId === 'flagship') $sort = 30;
    $gift = isset($body['gift_credits'])
      ? (int)$body['gift_credits']
      : (isset($ex['gift_credits']) ? (int)$ex['gift_credits'] : 0);
    $pdo->prepare('UPDATE tn_plans SET name=?, monthly_credits=?, gift_credits=?, price_month_cents=?, price_year_cents=?, sort_order=?, active=? WHERE id=?')
      ->execute(array(
        isset($body['name']) ? $body['name'] : $ex['name'],
        isset($body['monthly_credits']) ? (int)$body['monthly_credits'] : $ex['monthly_credits'],
        $gift,
        isset($body['price_month_cents']) ? (int)$body['price_month_cents'] : $ex['price_month_cents'],
        isset($body['price_year_cents']) ? (int)$body['price_year_cents'] : $ex['price_year_cents'],
        $sort,
        isset($body['active']) ? (int)$body['active'] : $ex['active'],
        $planId
      ));
    tn_json(array('ok' => true, 'id' => $planId));
  }
  if ($method === 'GET' && $path === '/v1/admin/overview') {
    $users = (int)$pdo->query('SELECT COUNT(*) FROM tn_users')->fetchColumn();
    $pending = (int)$pdo->query("SELECT COUNT(*) FROM tn_orders WHERE status='pending'")->fetchColumn();
    $paidToday = (int)$pdo->query("SELECT COUNT(*) FROM tn_orders WHERE status='paid' AND paid_at LIKE '" . gmdate('Y-m-d') . "%'")->fetchColumn();
    $codes = (int)$pdo->query('SELECT COUNT(*) FROM tn_redeem_codes')->fetchColumn();
    $routes = $pdo->query('SELECT slot, api_key FROM tn_model_routes')->fetchAll();
    $routeOk = 0;
    foreach ($routes as $r) { if ($r['api_key'] !== '') $routeOk++; }
    $rm = array('pending' => 0, 'in_progress' => 0, 'done' => 0, 'deferred' => 0);
    foreach ($pdo->query('SELECT status, COUNT(*) AS c FROM tn_roadmap_items GROUP BY status')->fetchAll() as $row) {
      if (isset($rm[$row['status']])) $rm[$row['status']] = (int)$row['c'];
    }
    tn_json(array(
      'users' => $users,
      'pendingOrders' => $pending,
      'paidOrdersRecent' => $paidToday,
      'redeemCodes' => $codes,
      'routesConfigured' => $routeOk,
      'routesTotal' => count($routes),
      'roadmap' => $rm,
    ));
  }
  // 开通 / 变更按月会员（不与流量包混用）
  if ($method === 'POST' && $path === '/v1/admin/subscription-save') {
    $userId = tn_resolve_user_id(
      isset($body['userId']) ? $body['userId'] : 0,
      isset($body['phone']) ? $body['phone'] : ''
    );
    if (!$userId) tn_json(array('error' => '请填写手机号或用户 ID'), 400);
    $planId = isset($body['planId']) ? trim($body['planId']) : '';
    if ($planId === '') tn_json(array('error' => '请选择会员档位'), 400);
    $changeType = isset($body['changeType']) ? trim($body['changeType']) : 'open';
    if ($changeType === '') $changeType = 'open';
    $months = isset($body['months']) ? (int)$body['months'] : 1;
    if ($months < 1) $months = 1;
    $periodEnd = isset($body['periodEnd']) ? $body['periodEnd'] : '';
    $grantMode = isset($body['grantMode']) ? $body['grantMode'] : '';
    $note = isset($body['paymentNote']) ? $body['paymentNote'] : '';
    $amount = isset($body['amountCents']) ? (int)$body['amountCents'] : 0;
    $channel = $changeType;
    if ($changeType === 'open') $channel = 'subscription';
    $id = 'sub_' . substr(tn_token(), 0, 16);
    $t = tn_now();
    try {
      $result = tn_change_subscription($userId, $planId, $changeType, '会员变更 '.$id.' '.$note, $months, $periodEnd, $grantMode);
    } catch (Exception $e) {
      tn_json(array('error' => $e->getMessage()), 400);
    }
    $pdo->prepare('INSERT INTO tn_orders (id,user_id,source,channel,plan_id,credits,amount_cents,status,payment_note,created_at,paid_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      ->execute(array(
        $id, $userId, 'offline', $channel, $planId,
        isset($result['granted']) ? (int)$result['granted'] : 0,
        $amount, 'paid', $note, $t, $t
      ));
    $st = $pdo->prepare(
      'SELECT u.*, c.balance, s.plan_id, s.status AS sub_status, s.period_start, s.period_end, s.pending_plan_id, p.name AS plan_name
       FROM tn_users u
       LEFT JOIN tn_credit_accounts c ON c.user_id=u.id
       LEFT JOIN tn_subscriptions s ON s.user_id=u.id
       LEFT JOIN tn_plans p ON p.id=s.plan_id
       WHERE u.id=?'
    );
    $st->execute(array($userId));
    tn_json(array('ok' => true, 'orderId' => $id, 'change' => $result, 'user' => tn_admin_user_row($st->fetch())));
  }

  // 流量包 / 积分充值（不改档位）
  if ($method === 'POST' && $path === '/v1/admin/credit-topup') {
    $userId = tn_resolve_user_id(
      isset($body['userId']) ? $body['userId'] : 0,
      isset($body['phone']) ? $body['phone'] : ''
    );
    if (!$userId) tn_json(array('error' => '请填写手机号或用户 ID'), 400);
    $credits = isset($body['credits']) ? (int)$body['credits'] : 0;
    if ($credits <= 0) tn_json(array('error' => '请填写充值积分'), 400);
    $note = isset($body['paymentNote']) ? $body['paymentNote'] : '';
    $amount = isset($body['amountCents']) ? (int)$body['amountCents'] : 0;
    $id = 'pack_' . substr(tn_token(), 0, 16);
    $t = tn_now();
    $pdo->prepare('INSERT INTO tn_orders (id,user_id,source,channel,plan_id,credits,amount_cents,status,payment_note,created_at,paid_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      ->execute(array($id, $userId, 'offline', 'topup', '', $credits, $amount, 'paid', $note, $t, $t));
    tn_apply_credit($userId, $credits, 'offline_topup', 'purchased', $id, $note !== '' ? $note : ('流量包 +'.$credits));
    $st = $pdo->prepare(
      'SELECT u.*, c.balance, s.plan_id, s.status AS sub_status, s.period_start, s.period_end, s.pending_plan_id, p.name AS plan_name
       FROM tn_users u
       LEFT JOIN tn_credit_accounts c ON c.user_id=u.id
       LEFT JOIN tn_subscriptions s ON s.user_id=u.id
       LEFT JOIN tn_plans p ON p.id=s.plan_id
       WHERE u.id=?'
    );
    $st->execute(array($userId));
    tn_json(array('ok' => true, 'orderId' => $id, 'user' => tn_admin_user_row($st->fetch())));
  }

  if ($method === 'POST' && $path === '/v1/admin/offline-order') {
    $userId = tn_resolve_user_id(
      isset($body['userId']) ? $body['userId'] : 0,
      isset($body['phone']) ? $body['phone'] : ''
    );
    if (!$userId) tn_json(array('error' => '请填写手机号或用户 ID'), 400);
    $id = 'off_' . substr(tn_token(), 0, 16);
    $t = tn_now();
    $planId = isset($body['planId']) ? $body['planId'] : '';
    $credits = isset($body['credits']) ? (int)$body['credits'] : 0;
    $note = isset($body['paymentNote']) ? $body['paymentNote'] : '';
    $months = isset($body['months']) ? (int)$body['months'] : 1;
    $periodEnd = isset($body['periodEnd']) ? $body['periodEnd'] : '';
    $pdo->prepare('INSERT INTO tn_orders (id,user_id,source,channel,plan_id,credits,amount_cents,status,payment_note,created_at,paid_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      ->execute(array($id, $userId, 'offline', 'offline', $planId, $credits, isset($body['amountCents']) ? (int)$body['amountCents'] : 0, 'paid', $note, $t, $t));
    if ($planId !== '') tn_assign_plan($userId, $planId, '订单 '.$id.' '.$note, $months, $periodEnd, 1);
    elseif ($credits > 0) tn_apply_credit($userId, $credits, 'offline_topup', 'purchased', $id, $note);
    $st = $pdo->prepare('SELECT * FROM tn_orders WHERE id=?');
    $st->execute(array($id));
    tn_json(array('ok' => true, 'order' => $st->fetch()));
  }
  if ($method === 'GET' && $path === '/v1/admin/orders') {
    tn_json(array(
      'orders' => $pdo->query(
        'SELECT o.*, u.phone AS phone FROM tn_orders o LEFT JOIN tn_users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 100'
      )->fetchAll()
    ));
  }

  // WAF 友好：body 带 id，避免 /orders/{id}/… 被拦
  if ($method === 'POST' && $path === '/v1/admin/orders-fulfill') {
    tn_admin_order_fulfill(isset($body['id']) ? $body['id'] : '', $body);
  }
  if ($method === 'POST' && preg_match('#^/v1/admin/orders/([^/]+)/fulfill$#', $path, $m)) {
    tn_admin_order_fulfill($m[1], $body);
  }
  if ($method === 'POST' && $path === '/v1/admin/orders-reject') {
    $id = isset($body['id']) ? trim($body['id']) : '';
    if ($id === '') tn_json(array('error' => 'id required'), 400);
    $st = $pdo->prepare('SELECT * FROM tn_orders WHERE id=?');
    $st->execute(array($id));
    $ord = $st->fetch();
    if (!$ord) tn_json(array('error' => 'order not found'), 404);
    if ($ord['status'] === 'paid') tn_json(array('error' => '已履约订单不可拒绝'), 400);
    $note = isset($body['note']) ? trim($body['note']) : '';
    $merged = $ord['payment_note'];
    if ($note !== '') $merged = ($merged !== '' ? $merged . '；' : '') . '拒绝：' . $note;
    elseif (strpos($merged, '拒绝') === false) $merged = ($merged !== '' ? $merged . '；' : '') . '已拒绝';
    $pdo->prepare('UPDATE tn_orders SET status=?, payment_note=? WHERE id=?')
      ->execute(array('rejected', $merged, $id));
    $st->execute(array($id));
    tn_json(array('ok' => true, 'order' => $st->fetch()));
  }
  if ($method === 'POST' && $path === '/v1/admin/orders-delete') {
    $id = isset($body['id']) ? trim($body['id']) : '';
    if ($id === '') tn_json(array('error' => 'id required'), 400);
    $st = $pdo->prepare('SELECT id FROM tn_orders WHERE id=?');
    $st->execute(array($id));
    if (!$st->fetch()) tn_json(array('error' => 'order not found'), 404);
    $pdo->prepare('DELETE FROM tn_orders WHERE id=?')->execute(array($id));
    tn_json(array('ok' => true, 'deleted' => $id));
  }
  if ($method === 'GET' && $path === '/v1/admin/model-routes') {
    $rows = $pdo->query('SELECT slot, base_url, model_id, updated_at, api_key FROM tn_model_routes')->fetchAll();
    $out = array();
    foreach ($rows as $r) {
      $k = $r['api_key'];
      $r['hasKey'] = ($k !== '');
      $r['api_key'] = ($k !== '') ? ('***' . substr($k, -4)) : '';
      $out[] = $r;
    }
    tn_json(array('routes' => $out));
  }
  if ($method === 'PUT' && preg_match('#^/v1/admin/model-routes/([^/]+)$#', $path, $m)) {
    $st = $pdo->prepare('SELECT * FROM tn_model_routes WHERE slot=?');
    $st->execute(array($m[1]));
    $ex = $st->fetch();
    if (!$ex) tn_json(array('error' => 'unknown slot'), 404);
    $key = isset($body['api_key']) ? $body['api_key'] : '';
    if ($key === '' || strpos($key, '***') === 0) $key = $ex['api_key'];
    $pdo->prepare('UPDATE tn_model_routes SET base_url=?, api_key=?, model_id=?, updated_at=? WHERE slot=?')
      ->execute(array(isset($body['base_url']) ? $body['base_url'] : $ex['base_url'], $key, isset($body['model_id']) ? $body['model_id'] : $ex['model_id'], tn_now(), $m[1]));
    tn_json(array('ok' => true));
  }
  // WAF-safe: slot in body, avoid /model-routes/{slot} URL blacklist
  if ($method === 'POST' && $path === '/v1/admin/model-routes-save') {
    $slot = isset($body['slot']) ? $body['slot'] : '';
    if ($slot === '') tn_json(array('error' => 'slot required'), 400);
    $st = $pdo->prepare('SELECT * FROM tn_model_routes WHERE slot=?');
    $st->execute(array($slot));
    $ex = $st->fetch();
    if (!$ex) tn_json(array('error' => 'unknown slot'), 404);
    $key = isset($body['api_key']) ? $body['api_key'] : '';
    if ($key === '' || strpos($key, '***') === 0) $key = $ex['api_key'];
    $pdo->prepare('UPDATE tn_model_routes SET base_url=?, api_key=?, model_id=?, updated_at=? WHERE slot=?')
      ->execute(array(isset($body['base_url']) ? $body['base_url'] : $ex['base_url'], $key, isset($body['model_id']) ? $body['model_id'] : $ex['model_id'], tn_now(), $slot));
    tn_json(array('ok' => true, 'slot' => $slot));
  }
  if ($method === 'GET' && $path === '/v1/admin/prices') tn_json(array('prices' => tn_prices()));
  if (($method === 'PUT' && $path === '/v1/admin/prices')
    || ($method === 'POST' && $path === '/v1/admin/prices-save')) {
    $up = $pdo->prepare('INSERT INTO tn_credit_prices (`key`, value, updated_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value=VALUES(value), updated_at=VALUES(updated_at)');
    $t = tn_now();
    foreach ($body as $k => $v) {
      if ($k === 'id') continue;
      if (is_numeric($v)) $up->execute(array($k, (int)$v, $t));
    }
    tn_json(array('ok' => true, 'prices' => tn_prices()));
  }
  if ($method === 'GET' && $path === '/v1/admin/ops') {
    tn_json(array('paymentHint' => tn_setting('ops_payment_hint'), 'supportContact' => tn_setting('ops_support_contact')));
  }
  if (($method === 'PUT' && $path === '/v1/admin/ops')
    || ($method === 'POST' && $path === '/v1/admin/ops-save')) {
    if (isset($body['paymentHint'])) tn_set_setting('ops_payment_hint', $body['paymentHint']);
    if (isset($body['supportContact'])) tn_set_setting('ops_support_contact', $body['supportContact']);
    tn_json(array(
      'ok' => true,
      'paymentHint' => tn_setting('ops_payment_hint'),
      'supportContact' => tn_setting('ops_support_contact')
    ));
  }
  if ($method === 'GET' && $path === '/v1/admin/redeem-codes') {
    $codes = $pdo->query('SELECT * FROM tn_redeem_codes ORDER BY created_at DESC LIMIT 100')->fetchAll();
    $phSt = $pdo->prepare(
      "SELECT DISTINCT u.phone FROM tn_credit_ledger l INNER JOIN tn_users u ON u.id=l.user_id WHERE l.reason='redeem' AND l.request_id=? ORDER BY u.phone"
    );
    $out = array();
    foreach ($codes as $c) {
      $phSt->execute(array($c['code']));
      $phones = array();
      foreach ($phSt->fetchAll() as $row) {
        if (!empty($row['phone'])) $phones[] = $row['phone'];
      }
      $c['used_phones'] = $phones;
      $c['used_phones_text'] = count($phones) ? implode('、', $phones) : '—';
      $out[] = $c;
    }
    tn_json(array('codes' => $out));
  }
  if ($method === 'POST' && $path === '/v1/admin/redeem-codes') {
    $code = strtoupper(trim(isset($body['code']) ? $body['code'] : ''));
    if ($code === '') $code = strtoupper(substr(tn_token(), 0, 8));
    $credits = isset($body['credits']) ? (int)$body['credits'] : 0;
    if (!$credits) tn_json(array('error' => 'credits required'), 400);
    $pdo->prepare('INSERT INTO tn_redeem_codes (code,credits,max_uses,used_count,expires_at,note,created_at) VALUES (?,?,?,0,?,?,?)')
      ->execute(array($code, $credits, isset($body['max_uses']) ? (int)$body['max_uses'] : 1, isset($body['expires_at']) ? $body['expires_at'] : '', isset($body['note']) ? $body['note'] : '', tn_now()));
    tn_json(array('ok' => true, 'code' => $code));
  }
  if ($method === 'GET' && $path === '/v1/admin/kb') {
    $cat = isset($_GET['category']) ? trim($_GET['category']) : '';
    $q = isset($_GET['q']) ? trim($_GET['q']) : '';
    if ($cat !== '' && $q !== '') {
      $st = $pdo->prepare('SELECT * FROM tn_kb_articles WHERE category=? AND (title LIKE ? OR body LIKE ?) ORDER BY category, sort_order, id');
      $like = '%'.$q.'%';
      $st->execute(array($cat, $like, $like));
    } elseif ($cat !== '') {
      $st = $pdo->prepare('SELECT * FROM tn_kb_articles WHERE category=? ORDER BY sort_order, id');
      $st->execute(array($cat));
    } elseif ($q !== '') {
      $st = $pdo->prepare('SELECT * FROM tn_kb_articles WHERE title LIKE ? OR body LIKE ? OR category LIKE ? ORDER BY category, sort_order, id');
      $like = '%'.$q.'%';
      $st->execute(array($like, $like, $like));
    } else {
      $st = $pdo->query('SELECT * FROM tn_kb_articles ORDER BY category, sort_order, id');
    }
    tn_json(array(
      'articles' => $st->fetchAll(),
      'categories' => array('凭证账号', '核心架构', '踩坑记录', '功能教程', '运维部署', '其它')
    ));
  }
  if ($method === 'POST' && $path === '/v1/admin/kb') {
    $title = trim(isset($body['title']) ? $body['title'] : '');
    if ($title === '') tn_json(array('error' => 'title required'), 400);
    $slug = trim(isset($body['slug']) ? $body['slug'] : '');
    if ($slug === '') $slug = 'kb-' . substr(tn_token(), 0, 8);
    $t = tn_now();
    $pdo->prepare('INSERT INTO tn_kb_articles (slug,title,category,body,sort_order,updated_at,created_at) VALUES (?,?,?,?,?,?,?)')
      ->execute(array($slug, $title, isset($body['category']) ? $body['category'] : 'general', isset($body['body']) ? $body['body'] : '', isset($body['sort_order']) ? (int)$body['sort_order'] : 100, $t, $t));
    tn_json(array('ok' => true, 'id' => (int)$pdo->lastInsertId()));
  }
  if (($method === 'PUT' && preg_match('#^/v1/admin/kb/(\d+)$#', $path, $m))
    || ($method === 'POST' && $path === '/v1/admin/kb-save')) {
    $kid = ($method === 'POST') ? (isset($body['id']) ? (int)$body['id'] : 0) : (int)$m[1];
    if (!$kid) tn_json(array('error' => 'id required'), 400);
    $st = $pdo->prepare('SELECT * FROM tn_kb_articles WHERE id=?');
    $st->execute(array($kid));
    $ex = $st->fetch();
    if (!$ex) tn_json(array('error' => 'not found'), 404);
    $pdo->prepare('UPDATE tn_kb_articles SET slug=?, title=?, category=?, body=?, sort_order=?, updated_at=? WHERE id=?')
      ->execute(array(
        isset($body['slug']) ? $body['slug'] : $ex['slug'],
        isset($body['title']) ? $body['title'] : $ex['title'],
        isset($body['category']) ? $body['category'] : $ex['category'],
        isset($body['body']) ? $body['body'] : $ex['body'],
        isset($body['sort_order']) ? (int)$body['sort_order'] : $ex['sort_order'],
        tn_now(), $kid
      ));
    tn_json(array('ok' => true, 'id' => $kid));
  }
  if (($method === 'DELETE' && preg_match('#^/v1/admin/kb/(\d+)$#', $path, $m))
    || ($method === 'POST' && $path === '/v1/admin/kb-delete')) {
    $kid = ($method === 'POST') ? (isset($body['id']) ? (int)$body['id'] : 0) : (int)$m[1];
    if (!$kid) tn_json(array('error' => 'id required'), 400);
    $pdo->prepare('DELETE FROM tn_kb_articles WHERE id=?')->execute(array($kid));
    tn_json(array('ok' => true, 'id' => $kid));
  }
  if ($method === 'GET' && $path === '/v1/admin/roadmap') {
    $items = $pdo->query('SELECT * FROM tn_roadmap_items ORDER BY sort_order, id')->fetchAll();
    $summary = array('done' => 0, 'pending' => 0, 'in_progress' => 0, 'deferred' => 0, 'cancelled' => 0);
    foreach ($items as $it) {
      if (isset($summary[$it['status']])) $summary[$it['status']]++;
    }
    tn_json(array('items' => $items, 'summary' => $summary));
  }
  if ($method === 'POST' && $path === '/v1/admin/roadmap') {
    $title = trim(isset($body['title']) ? $body['title'] : '');
    if ($title === '') tn_json(array('error' => 'title required'), 400);
    $t = tn_now();
    $pdo->prepare('INSERT INTO tn_roadmap_items (phase,title,detail,status,sort_order,updated_at,created_at) VALUES (?,?,?,?,?,?,?)')
      ->execute(array(isset($body['phase']) ? $body['phase'] : '', $title, isset($body['detail']) ? $body['detail'] : '', isset($body['status']) ? $body['status'] : 'pending', isset($body['sort_order']) ? (int)$body['sort_order'] : 100, $t, $t));
    tn_json(array('ok' => true, 'id' => (int)$pdo->lastInsertId()));
  }
  if (($method === 'PUT' && preg_match('#^/v1/admin/roadmap/(\d+)$#', $path, $m))
    || ($method === 'POST' && $path === '/v1/admin/roadmap-save')) {
    $rid = ($method === 'POST') ? (isset($body['id']) ? (int)$body['id'] : 0) : (int)$m[1];
    if (!$rid) tn_json(array('error' => 'id required'), 400);
    $st = $pdo->prepare('SELECT * FROM tn_roadmap_items WHERE id=?');
    $st->execute(array($rid));
    $ex = $st->fetch();
    if (!$ex) tn_json(array('error' => 'not found'), 404);
    $pdo->prepare('UPDATE tn_roadmap_items SET phase=?, title=?, detail=?, status=?, sort_order=?, updated_at=? WHERE id=?')
      ->execute(array(
        isset($body['phase']) ? $body['phase'] : $ex['phase'],
        isset($body['title']) ? $body['title'] : $ex['title'],
        isset($body['detail']) ? $body['detail'] : $ex['detail'],
        isset($body['status']) ? $body['status'] : $ex['status'],
        isset($body['sort_order']) ? (int)$body['sort_order'] : $ex['sort_order'],
        tn_now(), $rid
      ));
    tn_json(array('ok' => true, 'id' => $rid));
  }
  if (($method === 'DELETE' && preg_match('#^/v1/admin/roadmap/(\d+)$#', $path, $m))
    || ($method === 'POST' && $path === '/v1/admin/roadmap-delete')) {
    $rid = ($method === 'POST') ? (isset($body['id']) ? (int)$body['id'] : 0) : (int)$m[1];
    if (!$rid) tn_json(array('error' => 'id required'), 400);
    $pdo->prepare('DELETE FROM tn_roadmap_items WHERE id=?')->execute(array($rid));
    tn_json(array('ok' => true, 'id' => $rid));
  }
  tn_json(array('error' => 'not found', 'path' => $path), 404);
}

function tn_proxy_asr() {
  $user = tn_require_user();
  $pdo = tn_db();
  $st = $pdo->prepare('SELECT * FROM tn_model_routes WHERE slot=?');
  $st->execute(array('asr'));
  $route = $st->fetch();
  if (!$route || $route['api_key'] === '') tn_json(array('error' => '官方语音模型未配置上游 Key'), 503);
  if (empty($_FILES['file'])) tn_json(array('error' => 'file required'), 400);
  $size = (int)$_FILES['file']['size'];
  $secs = max(1, (int)ceil($size / 2000));
  $minutes = max(1, (int)ceil($secs / 60));
  $prices = tn_prices();
  $cost = $minutes * (isset($prices['voiceCreditsPerMinute']) ? (int)$prices['voiceCreditsPerMinute'] : 2);
  $balSt = $pdo->prepare('SELECT balance FROM tn_credit_accounts WHERE user_id=?');
  $balSt->execute(array((int)$user['id']));
  $bal = (int)$balSt->fetchColumn();
  if ($bal < $cost) {
    $GLOBALS['tn_err_balance'] = $bal;
    throw new Exception('INSUFFICIENT_CREDITS');
  }
  $requestId = substr(tn_token(), 0, 16);
  $tmp = $_FILES['file']['tmp_name'];
  $fname = isset($_FILES['file']['name']) ? $_FILES['file']['name'] : 'audio.wav';
  $ftype = isset($_FILES['file']['type']) ? $_FILES['file']['type'] : 'application/octet-stream';
  if (class_exists('CURLFile')) {
    $fileField = new CURLFile($tmp, $ftype, $fname);
  } else {
    $fileField = '@' . $tmp;
  }
  $post = array(
    'file' => $fileField,
    'model' => $route['model_id'],
    'response_format' => isset($_POST['response_format']) ? $_POST['response_format'] : 'json',
    'language' => isset($_POST['language']) ? $_POST['language'] : 'zh',
  );
  $ch = curl_init(rtrim($route['base_url'], '/') . '/audio/transcriptions');
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
  curl_setopt($ch, CURLOPT_HTTPHEADER, array('Authorization: Bearer ' . $route['api_key']));
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_TIMEOUT, 120);
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 20);
  curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
  curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
  $text = curl_exec($ch);
  $cerr = curl_error($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($code < 200 || $code >= 300) {
    if (function_exists('http_response_code')) {
      http_response_code($code ? $code : 502);
    } else {
      header('HTTP/1.1 ' . ($code ? $code : 502) . ' Error');
    }
    header('Content-Type: application/json; charset=utf-8');
    if ($text) {
      echo $text;
    } else {
      echo json_encode(array('error' => 'upstream', 'detail' => $cerr ? $cerr : 'empty response'));
    }
    exit;
  }
  tn_apply_credit((int)$user['id'], -$cost, 'voice', 'consume', $requestId, (string)$route['model_id']);
  header('X-TalkNow-Credits-Charged: ' . $cost);
  header('X-TalkNow-Request-Id: ' . $requestId);
  header('Content-Type: application/json');
  echo $text;
  exit;
}

function tn_proxy_chat() {
  $user = tn_require_user();
  $capability = isset($_SERVER['HTTP_X_TALKNOW_CAPABILITY']) ? $_SERVER['HTTP_X_TALKNOW_CAPABILITY'] : 'reply';
  $prices = tn_prices();
  $costMap = array(
    'reply' => isset($prices['replyCredits']) ? (int)$prices['replyCredits'] : 10,
    'reply_vision' => isset($prices['replyVisionCredits']) ? (int)$prices['replyVisionCredits'] : 5,
    'screen_ask' => isset($prices['screenAskCredits']) ? (int)$prices['screenAskCredits'] : 25,
    'screen_quiz' => isset($prices['screenQuizCredits']) ? (int)$prices['screenQuizCredits'] : 15,
    'chat' => isset($prices['replyCredits']) ? (int)$prices['replyCredits'] : 10,
  );
  $cost = isset($costMap[$capability]) ? $costMap[$capability] : $costMap['reply'];
  $pdo = tn_db();
  $balSt = $pdo->prepare('SELECT balance FROM tn_credit_accounts WHERE user_id=?');
  $balSt->execute(array((int)$user['id']));
  $bal = (int)$balSt->fetchColumn();
  if ($bal < $cost) {
    $GLOBALS['tn_err_balance'] = $bal;
    throw new Exception('INSUFFICIENT_CREDITS');
  }
  $raw = file_get_contents('php://input');
  $hasVision = (strpos($raw, 'image_url') !== false) || (strpos($raw, 'image') !== false);
  $slot = $hasVision ? 'vision' : 'chat';
  $st = $pdo->prepare('SELECT * FROM tn_model_routes WHERE slot=?');
  $st->execute(array($slot));
  $route = $st->fetch();
  if (!$route || $route['api_key'] === '') tn_json(array('error' => '官方模型未配置上游 Key'), 503);
  $payload = json_decode($raw, true);
  if (!is_array($payload)) $payload = array();
  // 官方代理一律用后台路由模型，忽略客户端自配 model（否则硅基报 Model does not exist → 会员服务失败）
  $payload['model'] = $route['model_id'];
  $requestId = substr(tn_token(), 0, 16);
  $ch = curl_init(rtrim($route['base_url'], '/') . '/chat/completions');
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
  curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'Authorization: Bearer ' . $route['api_key'],
    'Content-Type: application/json',
  ));
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_TIMEOUT, 180);
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 20);
  curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
  curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
  $text = curl_exec($ch);
  $cerr = curl_error($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($code < 200 || $code >= 300) {
    if (function_exists('http_response_code')) {
      http_response_code($code ? $code : 502);
    } else {
      header('HTTP/1.1 ' . ($code ? $code : 502) . ' Error');
    }
    header('Content-Type: application/json; charset=utf-8');
    if ($text) {
      echo $text;
    } else {
      echo json_encode(array('error' => 'upstream', 'detail' => $cerr ? $cerr : 'empty response'));
    }
    exit;
  }
  $reason = ($capability === 'screen_ask' || $capability === 'screen_quiz') ? $capability : 'reply';
  $modelNote = isset($payload['model']) ? (string)$payload['model'] : (string)$route['model_id'];
  tn_apply_credit((int)$user['id'], -$cost, $reason, 'consume', $requestId, $modelNote);
  header('X-TalkNow-Credits-Charged: ' . $cost);
  header('X-TalkNow-Request-Id: ' . $requestId);
  header('Content-Type: application/json');
  echo $text;
  exit;
}

/** 确认履约用户线下意向（开通会员或流量包） */
function tn_admin_order_fulfill($id, $body) {
  $id = trim((string)$id);
  if ($id === '') tn_json(array('error' => 'id required'), 400);
  try {
    $opts = array();
    if (isset($body['paymentNote']) && $body['paymentNote'] !== '') $opts['paymentNote'] = $body['paymentNote'];
    if (isset($body['months'])) $opts['months'] = (int)$body['months'];
    if (isset($body['changeType']) && $body['changeType'] !== '') $opts['changeType'] = $body['changeType'];
    $ord = tn_fulfill_paid_order($id, $opts);
  } catch (Exception $e) {
    $msg = $e->getMessage();
    $code = ($msg === 'order not found') ? 404 : 400;
    tn_json(array('error' => $msg), $code);
  }
  tn_json(array('ok' => true, 'order' => $ord));
}
