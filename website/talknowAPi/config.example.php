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
);
