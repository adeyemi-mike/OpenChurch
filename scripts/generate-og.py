#!/usr/bin/env python3
"""Regenerate public/og-default.png with the official OpenChurch brand mark.

Design: deep brand green (#1B5142) canvas, warm off-white (#FEFDFB) reversed
mark + wordmark (per public/brand/openchurch-reversed.svg usage guidance),
soft cream tagline and an MIT badge. Matches the site hero's radial-glow style.
"""
import io

import cairosvg
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
GREEN = (27, 81, 66)        # #1B5142
OFFWHITE = (254, 253, 251)  # #FEFDFB
CREAM = (246, 239, 225)     # #F6EFE1

BOLD = "/usr/share/fonts/truetype/chinese/NotoSansSC-Bold.ttf"
REG = "/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf"

# --- 1. Render the brand mark (off-white strokes) via cairosvg -----------
MARK_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112">
  <g fill="none" stroke="#FEFDFB" stroke-width="13" stroke-linecap="square" stroke-linejoin="round">
    <path d="M91 22H45C31 22 22 31 22 45V69C22 83 31 92 45 92H60"/>
    <path d="M91 22V55L70 76"/>
  </g>
</svg>"""
mark_png = cairosvg.svg2png(bytestring=MARK_SVG.encode(), output_width=190, output_height=190)
mark = Image.open(io.BytesIO(mark_png)).convert("RGBA")

# --- 2. Canvas + soft radial glows (mirrors the hero mockup styling) ------
img = Image.new("RGB", (W, H), GREEN)

glow = Image.new("L", (W, H), 0)
gd = ImageDraw.Draw(glow)
gd.ellipse([-260, -300, 520, 380], fill=52)    # top-left white glow
glow = glow.filter(ImageFilter.GaussianBlur(130))
white_layer = Image.new("RGB", (W, H), OFFWHITE)
img = Image.composite(white_layer, img, glow.point(lambda v: v))

glow2 = Image.new("L", (W, H), 0)
gd2 = ImageDraw.Draw(glow2)
gd2.ellipse([820, 420, 1420, 940], fill=46)    # bottom-right amber glow
glow2 = glow2.filter(ImageFilter.GaussianBlur(140))
amber = Image.new("RGB", (W, H), (242, 179, 102))  # #F2B366 site amber
img = Image.composite(amber, img, glow2.point(lambda v: v))

img = img.convert("RGBA")
draw = ImageDraw.Draw(img)

# --- 3. Mark (anchor-based layout for precise vertical rhythm) ------------
img.alpha_composite(mark, ((W - mark.width) // 2, 86))

# --- 4. Wordmark -----------------------------------------------------------
f_word = ImageFont.truetype(BOLD, 104)
draw.text((W / 2, 330), "OpenChurch", font=f_word, fill=OFFWHITE, anchor="mm")

# --- 5. Tagline ------------------------------------------------------------
f_tag = ImageFont.truetype(REG, 42)
draw.text((W / 2, 452), "Every Church Deserves a Digital Home", font=f_tag, fill=CREAM, anchor="mm")

# --- 6. MIT badge ----------------------------------------------------------
f_badge = ImageFont.truetype(BOLD, 26)
badge = "Free & open source \N{MIDDLE DOT} MIT licensed"
bbox = draw.textbbox((0, 0), badge, font=f_badge)
bw = bbox[2] - bbox[0]
bh = bbox[3] - bbox[1]
pad_x, pad_y = 30, 15
by0 = 540
by1 = by0 + bh + 2 * pad_y
draw.rounded_rectangle(
    [(W - bw) / 2 - pad_x, by0, (W + bw) / 2 + pad_x, by1],
    radius=int((by1 - by0) / 2),
    outline=(254, 253, 251, 90),
    width=2,
)
draw.text((W / 2, (by0 + by1) / 2), badge, font=f_badge, fill=OFFWHITE, anchor="mm")

img.convert("RGB").save("/home/z/my-project/public/og-default.png", "PNG", optimize=True)
print("saved public/og-default.png", img.size)
