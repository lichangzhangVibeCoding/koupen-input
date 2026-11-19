<?php
/**
 * Copy to config.php and fill secrets. Do not commit config.php.
 * 后台「模型路由」的 Key / 模型名只写在本机 config.php 或数据库里，不要提交仓库。
 */
return array(
  'db' => array(
    'host' => '127.0.0.1',
    'port' => 3306,
    'name' => 'talknow',
    'user' => 'talknow',
    'pass' => 'CHANGE_ME',
    'charset' => 'utf8',
  ),
  'admin_user' => 'admin',
  'admin_pass' => 'CHANGE_ME',
  'dev_login_code' => '888888',
  'upstream' => array(
    'base_url' => 'https://api.siliconflow.cn/v1',
    'api_key' => '',
    'asr' => '',
    'vision' => '',
    'chat' => '',
  ),
  'ops_payment_hint' => '请转账至对公账户（主体就绪后更新），备注你的手机号，并联系客服开通。',
  'ops_support_contact' => '客服微信：待填写',
  'cors_origin' => '*',
  'stripe_secret_key' => '',
  'stripe_webhook_secret' => '',
  'stripe_success_url' => 'https://www.talknow.cn/subscribe/success/?session_id={CHECKOUT_SESSION_ID}',
  'stripe_cancel_url' => 'https://www.talknow.cn/subscribe/',
  'stripe_prices' => array(
    'standard_month' => '',
    'standard_year' => '',
    'advanced_month' => '',
    'advanced_year' => '',
    'flagship_month' => '',
    'flagship_year' => '',
    'topup' => '',
  ),
);
