<?php
/**
 * Copy to config.php and fill secrets. Do not commit config.php.
 */
return array(
  'db' => array(
    'host' => 'mysql.sql141.cdncenter.net',
    'port' => 3306,
    'name' => 'sq_wele',
    'user' => 'sq_wele',
    'pass' => 'CHANGE_ME',
    'charset' => 'utf8',
  ),
  'admin_user' => 'admin',
  'admin_pass' => 'CHANGE_ME',
  'dev_login_code' => '888888',
  'upstream' => array(
    'base_url' => 'https://api.siliconflow.cn/v1',
    'api_key' => '',
    'asr' => 'FunAudioLLM/SenseVoiceSmall',
    'vision' => 'Qwen/Qwen3-VL-32B-Instruct',
    'chat' => 'deepseek-ai/DeepSeek-V4-Flash',
  ),
  'ops_payment_hint' => '请转账至对公账户（主体就绪后更新），备注你的手机号，并联系客服开通。',
  'ops_support_contact' => '客服微信：待填写',
  'cors_origin' => '*',
  'stripe_secret_key' => '',
  'stripe_webhook_secret' => '',
  'stripe_success_url' => 'https://www.talknow.cn/subscribe/success/?session_id={CHECKOUT_SESSION_ID}',
  'stripe_cancel_url' => 'https://www.talknow.cn/subscribe/',
  'stripe_prices' => array(
    'standard_month' => 'price_1U4kJeBCwVqfj009DwHmyI7v',
    'standard_year' => 'price_1U4kJiBCwVqfj009QRRO6P3Q',
    'advanced_month' => 'price_1U4kJoBCwVqfj009eKrRDcof',
    'advanced_year' => 'price_1U4kJrBCwVqfj009myMsUz0j',
    'flagship_month' => 'price_1U4kJwBCwVqfj009X8JrDm31',
    'flagship_year' => 'price_1U4kK0BCwVqfj0095JrPcDJG',
    'topup' => 'price_1U4kK5BCwVqfj009DQ7Aj0Ef',
  ),
);
