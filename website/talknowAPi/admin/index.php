<?php
/** Inline admin (WAF-safe): embeds CSS/JS into app.html. PHP 5.2 compatible. */
$dir = dirname(__FILE__);
$css = @file_get_contents($dir . '/admin.css');
if ($css === false) $css = '';
$js = @file_get_contents($dir . '/admin.js');
if ($js === false) $js = '';
$html = @file_get_contents($dir . '/app.html');
if ($html === false) {
  // fallback: already-inlined static file
  $html = @file_get_contents($dir . '/index.html');
}
if ($html === false) $html = '<h1>missing admin template</h1>';
$html = preg_replace('/<link rel="stylesheet" href="\.\/admin\.css"\s*\/?>/', '<style>' . $css . '</style>', $html, 1);
$html = preg_replace('/<script src="\.\/admin\.js"><\/script>/', '<script>' . $js . '</script>', $html, 1);
header('Content-Type: text/html; charset=utf-8');
echo $html;
