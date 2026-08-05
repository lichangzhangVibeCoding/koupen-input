#!/usr/bin/env python3
"""Upload website/talknowAPi to FTP REMOTE_ROOT/talknowAPi."""
from __future__ import annotations

import io
import os
import sys
import time
from ftplib import FTP, error_perm
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = os.environ.get("FTP_HOST", "lizhenning.w115.cndns5.com")
USER = os.environ.get("FTP_USER", "lizhenning")
PASS = os.environ.get("FTP_PASS", "")
REMOTE_ROOT = os.environ.get("FTP_ROOT", "/lizhenning/wwwroot/other/typenow")
REMOTE_DIR = "talknowAPi"

SKIP = {".DS_Store", "config.example.php"}  # upload config.php


def ensure_cwd(ftp: FTP, parts: list[str]) -> None:
    ftp.cwd(REMOTE_ROOT)
    for p in parts:
        try:
            ftp.cwd(p)
        except error_perm:
            ftp.mkd(p)
            ftp.cwd(p)


def upload_file(ftp: FTP, local: Path, remote_rel: str) -> None:
    parts = remote_rel.split("/")
    name = parts[-1]
    ensure_cwd(ftp, parts[:-1])
    data = local.read_bytes()
    print(f"STOR {remote_rel} ({len(data)} bytes)", flush=True)
    t0 = time.time()
    ftp.storbinary(f"STOR {name}", io.BytesIO(data), blocksize=256 * 1024)
    print(f"  OK {time.time() - t0:.1f}s", flush=True)


def main() -> None:
    if not PASS:
        raise SystemExit("Set FTP_PASS env var")
    files = []
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        if p.name in SKIP or p.name.startswith("."):
            # still upload .htaccess
            if p.name != ".htaccess":
                continue
        rel = str(p.relative_to(ROOT)).replace("\\", "/")
        files.append((p, f"{REMOTE_DIR}/{rel}"))

    ftp = FTP()
    ftp.connect(HOST, 21, timeout=60)
    ftp.login(USER, PASS)
    ftp.set_pasv(True)
    print(f"Logged in {HOST} as {USER}", flush=True)
    for local, remote in sorted(files, key=lambda x: x[1]):
        upload_file(ftp, local, remote)
    ftp.quit()
    print("Done. Try:")
    print("  https://www.lizhenning.com/other/typenow/talknowAPi/index.php/health")
    print("  https://www.lizhenning.com/other/typenow/talknowAPi/admin/index.php")


if __name__ == "__main__":
    main()
