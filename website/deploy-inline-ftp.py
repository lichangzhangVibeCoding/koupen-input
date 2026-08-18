#!/usr/bin/env python3
"""Build WAF-safe inlined HTML and upload to /other/typenow/.

Hosting WAF returns empty bodies for *.js / *.css (and often 403 for images).
Deploy by inlining CSS + JS into HTML. Favicon uses a data URI.

Env:
  FTP_HOST   default lizhenning.w115.cndns5.com
  FTP_USER   default lizhenning
  FTP_PASS   required
  FTP_ROOT   default /lizhenning/wwwroot/other/typenow
"""
from __future__ import annotations

import base64
import io
import os
import re
import sys
import time
from ftplib import FTP, error_perm
from pathlib import Path

WEB = Path(__file__).resolve().parent
HOST = os.environ.get("FTP_HOST", "lizhenning.w115.cndns5.com")
USER = os.environ.get("FTP_USER", "lizhenning")
PASS = os.environ.get("FTP_PASS", "")
REMOTE_ROOT = os.environ.get("FTP_ROOT", "/lizhenning/wwwroot/other/typenow")


def escape_html(s: str) -> str:
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def load_releases_catalog() -> dict:
    raw = (WEB / "js/releases-data.js").read_text(encoding="utf-8")
    m = re.search(r"window\.(?:TYPENOW|TALKNOW)_RELEASES\s*=\s*(\{[\s\S]*\})\s*;?\s*$", raw.strip())
    if not m:
        raise SystemExit("releases-data.js: catalog object not found")
    # JSON-compatible object literal
    import json

    return json.loads(m.group(1))


def render_changelog_html(catalog: dict) -> str:
    parts: list[str] = []
    for r in catalog.get("releases") or []:
        title = escape_html(r.get("title") or "")
        ver = escape_html(r.get("version") or "")
        date = escape_html(r.get("date") or "")
        items = "".join(f"<li>{escape_html(h)}</li>" for h in (r.get("highlights") or []))
        parts.append(
            '<article class="release">'
            f'<div class="meta"><span class="ver">v{ver}</span>'
            f'<span class="date">{date}</span><span>{title}</span></div>'
            f"<ul>{items}</ul></article>"
        )
    return "\n".join(parts) if parts else '<p class="plain">暂无更新记录</p>'


def inject_changelog(html: bytes, catalog: dict) -> bytes:
    text = html.decode("utf-8")
    body = render_changelog_html(catalog)
    text2, n = re.subn(
        r'(<div id="changelog">)([\s\S]*?)(</div>)',
        rf"\1\n{body}\n  \3",
        text,
        count=1,
    )
    if n != 1:
        raise SystemExit("changelog: #changelog container not found for SSR inject")
    return text2.encode("utf-8")


def build(path: Path, css_href: str, scripts: list[str], css: str, js_parts: list[str], icon_data: str) -> bytes:
    text = path.read_text(encoding="utf-8")
    css_pat = re.compile(
        r'<link\s+rel=["\']stylesheet["\']\s+href=["\']'
        + re.escape(css_href)
        + r'["\']\s*/?>',
        re.I,
    )
    text, n = css_pat.subn("<style>\n" + css + "\n</style>", text, count=1)
    if n != 1:
        raise SystemExit(f"stylesheet link not found in {path}: {css_href}")

    loose = r"\s*".join(re.escape(f'<script src="{s}"></script>') for s in scripts)
    script_pat = re.compile(loose)
    bundled = "\n".join(f"<script>\n{part}\n</script>" for part in js_parts)
    # Use callable repl so JS backslashes (e.g. \D) are not treated as regex escapes
    text2, n2 = script_pat.subn(lambda _m: bundled, text, count=1)
    if n2 != 1:
        raise SystemExit(f"script tags not found in {path}: {scripts}")
    text = text2

    # Favicon + all logo <img> (WAF 403 on standalone png)
    text = re.sub(
        r'<link\s+rel=["\']icon["\'][^>]*>',
        lambda _m: f'<link rel="icon" href="{icon_data}" type="image/png">',
        text,
        count=1,
        flags=re.I,
    )
    text = re.sub(
        r'(src=["\'])(?:\.\./|\./)?assets/icon\.png(["\'])',
        lambda m: f'{m.group(1)}{icon_data}{m.group(2)}',
        text,
        flags=re.I,
    )
    return text.encode("utf-8")


def upload_bytes(ftp: FTP, remote_rel: str, data: bytes) -> None:
    remote_dir = str(Path(remote_rel).parent).replace("\\", "/")
    name = Path(remote_rel).name
    ftp.cwd(REMOTE_ROOT)
    if remote_dir not in (".", ""):
        for part in remote_dir.split("/"):
            try:
                ftp.cwd(part)
            except error_perm:
                ftp.mkd(part)
                ftp.cwd(part)
    print(f"STOR {remote_rel} ({len(data)} bytes)", flush=True)
    t0 = time.time()
    ftp.storbinary(f"STOR {name}", io.BytesIO(data), blocksize=256 * 1024)
    print(f"  OK {time.time() - t0:.1f}s", flush=True)


def main() -> int:
    if not PASS:
        print("Set FTP_PASS", file=sys.stderr)
        return 2

    css = (WEB / "css/ink-signal.css").read_text(encoding="utf-8")
    i18n = (WEB / "js/i18n.js").read_text(encoding="utf-8")
    releases_data = (WEB / "js/releases-data.js").read_text(encoding="utf-8")
    releases = (WEB / "js/releases.js").read_text(encoding="utf-8")
    plan_catalog = (WEB / "js/plan-catalog.js").read_text(encoding="utf-8")
    subscribe_js = (WEB / "js/subscribe.js").read_text(encoding="utf-8")
    # Prefer compressed web mark (~8KB) so HTML stays small; WAF blocks standalone png.
    icon_path = WEB / "assets/icon-web.png"
    if not icon_path.is_file():
        icon_path = WEB / "assets/icon.png"
    icon_data = "data:image/png;base64," + base64.b64encode(icon_path.read_bytes()).decode("ascii")

    home = build(
        WEB / "index.html",
        "./css/ink-signal.css",
        ["./js/i18n.js", "./js/releases-data.js", "./js/releases.js"],
        css,
        [i18n, releases_data, releases],
        icon_data,
    )
    chg = build(
        WEB / "changelog/index.html",
        "../css/ink-signal.css",
        ["../js/i18n.js", "../js/releases-data.js", "../js/releases.js"],
        css,
        [i18n, releases_data, releases],
        icon_data,
    )
    catalog = load_releases_catalog()
    chg = inject_changelog(chg, catalog)
    if chg.decode("utf-8", errors="replace").count('class="release"') < 1:
        raise SystemExit("changelog SSR inject produced no release articles")
    sub = build(
        WEB / "subscribe/index.html",
        "../css/ink-signal.css",
        ["../js/i18n.js", "../js/plan-catalog.js", "../js/subscribe.js"],
        css,
        [i18n, plan_catalog, subscribe_js],
        icon_data,
    )
    help_page = build(
        WEB / "help/index.html",
        "../css/ink-signal.css",
        ["../js/i18n.js"],
        css,
        [i18n],
        icon_data,
    )
    pricing_redirect = (WEB / "pricing/index.html").read_bytes()

    for label, blob in (("home", home), ("changelog", chg), ("subscribe", sub), ("help", help_page)):
        s = blob.decode("utf-8", errors="replace")
        if "<style>" not in s or "<script>" not in s:
            raise SystemExit(f"{label}: inline failed")
        print(f"built {label}: {len(blob)} bytes", flush=True)

    ftp = FTP()
    ftp.connect(HOST, 21, timeout=60)
    ftp.login(USER, PASS)
    ftp.set_pasv(True)
    upload_bytes(ftp, "index.html", home)
    upload_bytes(ftp, "changelog/index.html", chg)
    upload_bytes(ftp, "subscribe/index.html", sub)
    upload_bytes(ftp, "help/index.html", help_page)
    upload_bytes(ftp, "pricing/index.html", pricing_redirect)
    ftp.quit()
    print("DONE →", REMOTE_ROOT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
