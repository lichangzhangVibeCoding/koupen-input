<?php
/**
 * Stripe Checkout (PHP 5.2) — no official SDK.
 */
require_once dirname(__FILE__) . '/domain.php';

function tn_stripe_configured() {
  $cfg = tn_config();
  $key = isset($cfg['stripe_secret_key']) ? trim($cfg['stripe_secret_key']) : '';
  return $key !== '';
}

function tn_stripe_secret() {
  $cfg = tn_config();
  $key = isset($cfg['stripe_secret_key']) ? trim($cfg['stripe_secret_key']) : '';
  if ($key === '') throw new Exception('Stripe 未配置');
  return $key;
}

function tn_stripe_success_url() {
  $cfg = tn_config();
  if (!empty($cfg['stripe_success_url'])) return $cfg['stripe_success_url'];
  return 'https://www.talknow.cn/subscribe/success/?session_id={CHECKOUT_SESSION_ID}';
}

function tn_stripe_cancel_url() {
  $cfg = tn_config();
  if (!empty($cfg['stripe_cancel_url'])) return $cfg['stripe_cancel_url'];
  return 'https://www.talknow.cn/subscribe/';
}

function tn_stripe_request($method, $path, $params) {
  $url = 'https://api.stripe.com/v1' . $path;
  $ch = curl_init();
  $headers = array(
    'Authorization: Bearer ' . tn_stripe_secret(),
    'Stripe-Version: 2024-11-20.acacia',
  );
  if ($method === 'GET' && $params) {
    $url .= (strpos($url, '?') === false ? '?' : '&') . http_build_query($params);
  }
  curl_setopt($ch, CURLOPT_URL, $url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
  if ($method === 'POST') {
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $params ? http_build_query($params) : '');
  }
  $body = curl_exec($ch);
  $errno = curl_errno($ch);
  $err = curl_error($ch);
  curl_close($ch);
  if ($errno) throw new Exception('Stripe 网络错误: ' . $err);
  $json = json_decode($body, true);
  if (!is_array($json)) throw new Exception('Stripe 响应无效');
  if (isset($json['error'])) {
    $msg = isset($json['error']['message']) ? $json['error']['message'] : 'Stripe 错误';
    throw new Exception($msg);
  }
  return $json;
}

function tn_stripe_price_id($key) {
  $cfg = tn_config();
  $map = isset($cfg['stripe_prices']) && is_array($cfg['stripe_prices']) ? $cfg['stripe_prices'] : array();
  if (isset($map[$key]) && $map[$key] !== '') return $map[$key];
  throw new Exception('未配置 Stripe 价格: ' . $key);
}

function tn_stripe_note($interval, $changeType, $kind) {
  return 'stripe kind=' . $kind . ' interval=' . $interval . ' change=' . $changeType;
}

function tn_parse_stripe_note($note) {
  $out = array('kind' => 'sub', 'interval' => 'month', 'change' => 'open');
  if (preg_match('/kind=([a-z]+)/', $note, $m)) $out['kind'] = $m[1];
  if (preg_match('/interval=([a-z]+)/', $note, $m)) $out['interval'] = $m[1];
  if (preg_match('/change=([a-z_]+)/', $note, $m)) $out['change'] = $m[1];
  return $out;
}

function tn_stripe_create_checkout($user, $body) {
  if (!tn_stripe_configured()) {
    tn_json(array('error' => 'Stripe 未配置', 'code' => 'STRIPE_NOT_CONFIGURED'), 501);
  }
  $planId = isset($body['planId']) ? trim($body['planId']) : '';
  $interval = isset($body['interval']) ? trim($body['interval']) : 'month';
  if ($interval !== 'year') $interval = 'month';
  $changeType = isset($body['changeType']) ? trim($body['changeType']) : 'open';
  if ($changeType === '') $changeType = 'open';
  $credits = isset($body['credits']) ? (int)$body['credits'] : 0;
  $amountCents = isset($body['amountCents']) ? (int)$body['amountCents'] : 0;

  $kind = 'sub';
  $priceKey = '';
  $mode = 'subscription';
  $months = ($interval === 'year') ? 12 : 1;

  if ($planId !== '' && $planId !== 'trial') {
    $st = tn_db()->prepare('SELECT * FROM tn_plans WHERE id=?');
    $st->execute(array($planId));
    $plan = $st->fetch();
    if (!$plan) tn_json(array('error' => '套餐不存在'), 400);
    $priceKey = $planId . '_' . $interval;
    $amountCents = ($interval === 'year') ? (int)$plan['price_year_cents'] : (int)$plan['price_month_cents'];
    if ($amountCents <= 0) tn_json(array('error' => '该档位无需付费'), 400);
  } else {
    $kind = 'topup';
    $mode = 'payment';
    $planId = '';
    $priceKey = 'topup';
    if ($credits <= 0) $credits = 1000;
    if ($amountCents <= 0) $amountCents = 2000;
    $months = 0;
    $changeType = 'topup';
  }

  $priceId = tn_stripe_price_id($priceKey);
  $orderId = 'st_' . substr(tn_token(), 0, 14);
  $t = tn_now();
  $note = tn_stripe_note($interval, $changeType, $kind);
  tn_db()->prepare(
    'INSERT INTO tn_orders (id,user_id,source,channel,external_trade_no,plan_id,credits,amount_cents,status,payment_note,created_at,paid_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  )->execute(array(
    $orderId, (int)$user['id'], 'stripe', 'stripe', '',
    $planId, $credits, $amountCents, 'pending', $note, $t, '',
  ));

  $meta = array(
    'order_id' => $orderId,
    'user_id' => (string)(int)$user['id'],
    'plan_id' => $planId,
    'interval' => $interval,
    'change_type' => $changeType,
    'kind' => $kind,
    'credits' => (string)$credits,
    'months' => (string)$months,
  );
  $params = array(
    'mode' => $mode,
    'client_reference_id' => $orderId,
    'success_url' => tn_stripe_success_url(),
    'cancel_url' => tn_stripe_cancel_url(),
    'line_items' => array(
      array('price' => $priceId, 'quantity' => 1),
    ),
    'metadata' => $meta,
  );
  if ($mode === 'subscription') {
    $params['subscription_data'] = array('metadata' => $meta);
  } else {
    $params['payment_intent_data'] = array('metadata' => $meta);
  }

  $session = tn_stripe_request('POST', '/checkout/sessions', $params);
  $sid = isset($session['id']) ? $session['id'] : '';
  $url = isset($session['url']) ? $session['url'] : '';
  if ($sid === '' || $url === '') throw new Exception('未能创建 Stripe 结算页');
  tn_db()->prepare('UPDATE tn_orders SET external_trade_no=? WHERE id=?')->execute(array($sid, $orderId));

  tn_json(array(
    'id' => $orderId,
    'status' => 'pending',
    'source' => 'stripe',
    'checkoutUrl' => $url,
    'sessionId' => $sid,
  ));
}

function tn_stripe_timing_safe($a, $b) {
  $a = (string)$a;
  $b = (string)$b;
  if (strlen($a) !== strlen($b)) return false;
  $r = 0;
  for ($i = 0; $i < strlen($a); $i++) $r |= ord($a[$i]) ^ ord($b[$i]);
  return $r === 0;
}

function tn_stripe_verify($payload, $header) {
  $cfg = tn_config();
  $secret = isset($cfg['stripe_webhook_secret']) ? trim($cfg['stripe_webhook_secret']) : '';
  if ($secret === '') throw new Exception('未配置 stripe_webhook_secret');
  $t = '';
  $v1 = '';
  $parts = explode(',', $header);
  foreach ($parts as $p) {
    $kv = explode('=', trim($p), 2);
    if (count($kv) !== 2) continue;
    if ($kv[0] === 't') $t = $kv[1];
    if ($kv[0] === 'v1') $v1 = $kv[1];
  }
  if ($t === '' || $v1 === '') throw new Exception('Stripe 签名缺失');
  if (abs(time() - (int)$t) > 300) throw new Exception('Stripe 签名过期');
  $signed = $t . '.' . $payload;
  $expect = hash_hmac('sha256', $signed, $secret);
  if (!tn_stripe_timing_safe($expect, $v1)) throw new Exception('Stripe 签名无效');
}

function tn_stripe_webhook() {
  $payload = tn_raw_body();
  $sig = '';
  if (isset($_SERVER['HTTP_STRIPE_SIGNATURE'])) $sig = $_SERVER['HTTP_STRIPE_SIGNATURE'];
  tn_stripe_verify($payload, $sig);
  $event = json_decode($payload, true);
  if (!is_array($event)) tn_json(array('error' => 'invalid event'), 400);
  $type = isset($event['type']) ? $event['type'] : '';
  $obj = isset($event['data']['object']) ? $event['data']['object'] : array();

  if ($type === 'checkout.session.completed' || $type === 'checkout.session.async_payment_succeeded') {
    $paid = isset($obj['payment_status']) ? $obj['payment_status'] : '';
    if ($type === 'checkout.session.completed' && $paid !== 'paid' && $paid !== 'no_payment_required') {
      tn_json(array('ok' => true, 'ignored' => 'unpaid'));
    }
    $orderId = '';
    if (isset($obj['metadata']['order_id'])) $orderId = $obj['metadata']['order_id'];
    if ($orderId === '' && isset($obj['client_reference_id'])) $orderId = $obj['client_reference_id'];
    if ($orderId === '') tn_json(array('ok' => true, 'ignored' => 'no order'));
    $sid = isset($obj['id']) ? $obj['id'] : '';
    tn_fulfill_paid_order($orderId, array(
      'paymentNote' => 'stripe webhook ' . $type,
      'externalTradeNo' => $sid,
    ));
    tn_json(array('ok' => true, 'fulfilled' => $orderId));
  }

  if ($type === 'invoice.paid') {
    $reason = isset($obj['billing_reason']) ? $obj['billing_reason'] : '';
    if ($reason !== 'subscription_cycle') tn_json(array('ok' => true, 'ignored' => $reason));
    $meta = isset($obj['subscription_details']['metadata']) ? $obj['subscription_details']['metadata'] : array();
    if (!$meta && isset($obj['lines']['data'][0]['metadata'])) $meta = $obj['lines']['data'][0]['metadata'];
    $userId = isset($meta['user_id']) ? (int)$meta['user_id'] : 0;
    $planId = isset($meta['plan_id']) ? $meta['plan_id'] : '';
    $interval = isset($meta['interval']) ? $meta['interval'] : 'month';
    $invId = isset($obj['id']) ? $obj['id'] : ('inv_' . substr(tn_token(), 0, 12));
    if ($userId < 1 || $planId === '') tn_json(array('ok' => true, 'ignored' => 'no meta'));
    $st = tn_db()->prepare('SELECT id FROM tn_orders WHERE id=? OR external_trade_no=?');
    $st->execute(array($invId, $invId));
    if ($st->fetch()) tn_json(array('ok' => true, 'idempotent' => true));
    $months = ($interval === 'year') ? 12 : 1;
    $t = tn_now();
    $note = tn_stripe_note($interval, 'renew', 'sub');
    tn_db()->prepare(
      'INSERT INTO tn_orders (id,user_id,source,channel,external_trade_no,plan_id,credits,amount_cents,status,payment_note,created_at,paid_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
    )->execute(array(
      $invId, $userId, 'stripe', 'stripe', $invId, $planId, 0,
      isset($obj['amount_paid']) ? (int)$obj['amount_paid'] : 0,
      'pending', $note, $t, '',
    ));
    tn_fulfill_paid_order($invId, array(
      'paymentNote' => 'stripe renewal',
      'externalTradeNo' => $invId,
      'changeType' => 'renew',
      'months' => $months,
    ));
    tn_json(array('ok' => true, 'renewed' => $invId));
  }

  tn_json(array('ok' => true, 'ignored' => $type));
}
