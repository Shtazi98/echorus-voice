"""Render the Habr cover: dark card with the EchoRUS wordmark and a microphone glyph."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
HERE = Path(__file__).resolve().parent

img = Image.new("RGB", (W, H), "#0b1220")
draw = ImageDraw.Draw(img)

# Soft vertical gradient.
for y in range(H):
    t = y / H
    r = int(11 + 12 * t)
    g = int(18 + 22 * t)
    b = int(32 + 34 * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# Faint echo arcs in the background.
for radius, alpha in ((300, 26), (400, 18), (500, 12)):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.arc([W - radius - 60, H // 2 - radius, W + radius - 60, H // 2 + radius],
           start=200, end=340, fill=(56, 189, 248, alpha), width=3)
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

draw = ImageDraw.Draw(img)

font_dir = Path("C:/Windows/Fonts")
bold = font_dir / "segoeuib.ttf"
regular = font_dir / "segoeui.ttf"
title_font = ImageFont.truetype(str(bold), 108)
sub_font = ImageFont.truetype(str(regular), 40)
tag_font = ImageFont.truetype(str(bold), 26)

# Microphone glyph.
mx, my = 150, 210
draw.rounded_rectangle([mx - 34, my, mx + 34, my + 150], radius=34, fill="#f4f7fb")
draw.arc([mx - 78, my + 40, mx + 78, my + 196], start=0, end=180, fill="#f4f7fb", width=16)
draw.line([(mx, my + 196), (mx, my + 250)], fill="#f4f7fb", width=16)
draw.line([(mx - 52, my + 250), (mx + 52, my + 250)], fill="#f4f7fb", width=16)
draw.arc([mx - 118, my - 6, mx + 118, my + 230], start=140, end=220, fill="#38bdf8", width=10)
draw.arc([mx - 152, my - 30, mx + 152, my + 254], start=146, end=214, fill="#38bdf8", width=7)

draw.text((320, 200), "EchoRUS", font=title_font, fill="#f4f7fb")
draw.text((325, 330), "Голосовой ввод для DeepSeek Harness", font=sub_font, fill="#9fb2cc")
draw.text((325, 400), "Whisper · локально · без облака", font=tag_font, fill="#38bdf8")

draw.text((325, 500), "github.com/Shtazi98/echorus-voice", font=tag_font, fill="#6f8099")

out = HERE / "habr-cover.png"
img.save(out, "PNG")
print(out, img.size)
