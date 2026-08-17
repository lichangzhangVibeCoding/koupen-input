<?php
/**
 * TalkNow API — PHP 5.2 compatible (host is PHP 5.2.6 / IIS)
 */

function tn_config() {
  static $cfg = null;
  if ($cfg !== null) return $cfg;
  $path = dirname(__FILE__) . '/../config.php';
  if (!is_file($path)) {
    $path = dirname(__FILE__) . '/../config.example.php';
  }
  $cfg = include $path;
  return $cfg;
}

function tn_db() {
  static $pdo = null;
  if ($pdo) return $pdo;
  $c = tn_config();
  $c = $c['db'];
  // Avoid charset= in DSN (unsupported / fatal on some PHP 5.2 PDO MySQL builds)
  $dsn = 'mysql:host=' . $c['host'] . ';port=' . (isset($c['port']) ? (int)$c['port'] : 3306) . ';dbname=' . $c['name'];
  $pdo = new PDO($dsn, $c['user'], $c['pass']);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
  try { $pdo->exec("SET NAMES utf8"); } catch (Exception $e) {}
  return $pdo;
}

function tn_now() {
  return gmdate('Y-m-d\TH:i:s') . '.000Z';
}

function tn_token() {
  if (function_exists('openssl_random_pseudo_bytes')) {
    return bin2hex(openssl_random_pseudo_bytes(16));
  }
  $s = '';
  for ($i = 0; $i < 32; $i++) $s .= dechex(mt_rand(0, 15));
  return $s;
}

function tn_hash($raw) {
  return hash('sha256', $raw);
}

function tn_json($data, $code = 200) {
  if (!headers_sent()) {
    // PHP 5.2 may not have http_response_code
    if (function_exists('http_response_code')) {
      http_response_code($code);
    } else {
      header('HTTP/1.1 ' . (int)$code . ' Status');
    }
    header('Content-Type: application/json; charset=utf-8');
  }
  echo json_encode($data);
  exit;
}

function tn_raw_body() {
  static $raw = null;
  if ($raw === null) {
    $got = file_get_contents('php://input');
    $raw = ($got === false) ? '' : $got;
  }
  return $raw;
}

function tn_read_json() {
  $raw = tn_raw_body();
  if ($raw === '') return array();
  $j = json_decode($raw, true);
  return is_array($j) ? $j : array();
}

function tn_bearer() {
  $h = '';
  if (isset($_SERVER['HTTP_AUTHORIZATION'])) $h = $_SERVER['HTTP_AUTHORIZATION'];
  elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) $h = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
  if (stripos($h, 'Bearer ') === 0) return trim(substr($h, 7));
  return '';
}

function tn_cors() {
  $cfg = tn_config();
  $origin = isset($cfg['cors_origin']) ? $cfg['cors_origin'] : '*';
  header('Access-Control-Allow-Origin: ' . $origin);
  header('Access-Control-Allow-Headers: Authorization, Content-Type, X-TalkNow-Capability');
  header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
  if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('HTTP/1.1 204 No Content');
    exit;
  }
}
