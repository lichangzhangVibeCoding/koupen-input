#!/usr/bin/env python3
"""Generate Ink Signal VI icons: App PNG, tray template, icns, ico, optional DMG bg."""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "resources"
BUILD = ROOT / "build"

INK = (18, 20, 26, 255)  # #12141A
SIGNAL = (0, 180, 200, 255)  # #00B4C8
WHITE = (255, 255, 255, 255)
BG0 = (244, 246, 248, 255)


def round_rect(draw: ImageDraw.ImageDraw, xy, r, fill):
    draw.rounded_rectangle(xy, radius=r, fill=fill)


def draw_ji_mark(draw: ImageDraw.ImageDraw, cx: float, cy: float, size: float, fill):
    """Abstract 即-mark: vertical stem + short crossbar + small tick (template-friendly)."""
    stem_w = size * 0.14
    # vertical
    draw.rounded_rectangle(
        [cx - stem_w / 2, cy - size * 0.38, cx + stem_w / 2, cy + size * 0.38],
        radius=stem_w / 2,
        fill=fill,
    )
    # crossbar
    bar_h = size * 0.12
    draw.rounded_rectangle(
        [cx - size * 0.28, cy - size * 0.08, cx + size * 0.32, cy - size * 0.08 + bar_h],
        radius=bar_h / 2,
        fill=fill,
    )
    # signal dot (电青 accent on app icon only — caller may pass SIGNAL)
    # small lower tick to the right
    tick = size * 0.1
    draw.ellipse(
        [cx + size * 0.18, cy + size * 0.14, cx + size * 0.18 + tick, cy + size * 0.14 + tick],
        fill=fill,
    )


def make_app_icon(size: int = 1024) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = int(size * 0.08)
    r = int(size * 0.22)
    round_rect(d, [pad, pad, size - pad, size - pad], r, INK)
    # cyan accent strip at bottom of tile
    strip_h = int(size * 0.06)
    d.rounded_rectangle(
        [pad + size * 0.18, size - pad - strip_h - size * 0.12, size - pad - size * 0.18, size - pad - size * 0.12 + strip_h],
        radius=strip_h // 2,
        fill=SIGNAL,
    )
    draw_ji_mark(d, size / 2, size / 2 - size * 0.04, size * 0.42, WHITE)
    # 电青点缀：标右下小点盖过白色 tip
    cx, cy, s = size / 2, size / 2 - size * 0.04, size * 0.42
    tick = s * 0.12
    d.ellipse(
        [cx + s * 0.18, cy + s * 0.14, cx + s * 0.18 + tick, cy + s * 0.14 + tick],
        fill=SIGNAL,
    )
    return img


def make_tray_template(size: int = 32) -> Image.Image:
    """Black glyph on transparent — macOS template."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    draw_ji_mark(d, size / 2, size / 2, size * 0.72, (0, 0, 0, 255))
    return img


def make_dmg_bg(w: int = 660, h: int = 400) -> Image.Image:
    img = Image.new("RGBA", (w, h), BG0)
    d = ImageDraw.Draw(img)
    # soft signal wash
    for i in range(80):
        alpha = int(18 * (1 - i / 80))
        d.ellipse([w - 220 - i, -40 - i, w + 40 + i, 180 + i], outline=(0, 180, 200, alpha))
    icon = make_app_icon(128).resize((96, 96), Image.Resampling.LANCZOS)
    img.paste(icon, (48, 40), icon)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 28)
        font_sm = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 16)
    except OSError:
        font = ImageFont.load_default()
        font_sm = font
    d.text((160, 52), "即刻对话", font=font, fill=INK[:3])
    d.text((160, 92), "本机对话助手，少打字、快回人", font=font_sm, fill=(122, 129, 148))
    d.text((48, h - 48), "拖到 Applications 即可安装", font=font_sm, fill=(122, 129, 148))
    return img.convert("RGB")


def write_icns(src_png: Path, dest_icns: Path) -> None:
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    with tempfile.TemporaryDirectory() as td:
        iconset = Path(td) / "AppIcon.iconset"
        iconset.mkdir()
        base = Image.open(src_png).convert("RGBA")
        mapping = [
            (16, "icon_16x16.png"),
            (32, "icon_16x16@2x.png"),
            (32, "icon_32x32.png"),
            (64, "icon_32x32@2x.png"),
            (128, "icon_128x128.png"),
            (256, "icon_128x128@2x.png"),
            (256, "icon_256x256.png"),
            (512, "icon_256x256@2x.png"),
            (512, "icon_512x512.png"),
            (1024, "icon_512x512@2x.png"),
        ]
        for px, name in mapping:
            im = base.resize((px, px), Image.Resampling.LANCZOS)
            im.save(iconset / name)
        subprocess.check_call(["iconutil", "-c", "icns", str(iconset), "-o", str(dest_icns)])


def write_ico(src_png: Path, dest_ico: Path) -> None:
    base = Image.open(src_png).convert("RGBA")
    img256 = base.resize((256, 256), Image.Resampling.LANCZOS)
    img256.save(
        dest_ico,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


def main() -> None:
    RES.mkdir(parents=True, exist_ok=True)
    BUILD.mkdir(parents=True, exist_ok=True)

    icon = make_app_icon(1024)
    icon_path = RES / "icon.png"
    icon.save(icon_path)
    print("wrote", icon_path)

    # also copy for electron-builder default look
    shutil.copy(icon_path, BUILD / "icon.png")

    tray = make_tray_template(32)
    tray.save(RES / "trayTemplate.png")
    tray16 = make_tray_template(16)
    # mac prefers @2x naming sometimes; keep 32 as main template
    tray16.save(RES / "trayTemplate-16.png")
    print("wrote tray templates")

    dmg = make_dmg_bg()
    dmg_path = RES / "dmg-background.png"
    dmg.save(dmg_path)
    print("wrote", dmg_path)

    icns = BUILD / "icon.icns"
    write_icns(icon_path, icns)
    print("wrote", icns)

    ico = BUILD / "icon.ico"
    write_ico(icon_path, ico)
    print("wrote", ico)


if __name__ == "__main__":
    main()
