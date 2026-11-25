"""Render GitHub avatar options for EchoRUS (460×460, round-safe)."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE = 460
HERE = Path(__file__).resolve().parent
FONTS = Path("C:/Windows/Fonts")


def base(dark=(10, 22, 40), light=(22, 46, 82)):
    img = Image.new("RGB", (SIZE, SIZE), dark)
    draw = ImageDraw.Draw(img)
    for y in range(SIZE):
        t = y / SIZE
        draw.line([(0, y), (SIZE, y)], fill=tuple(int(d + (l - d) * t) for d, l in zip(dark, light)))
    return img


def mic(img, cx=196, cy=214, scale=1.0, cap="#f4f7fb", wave="#38bdf8"):
    draw = ImageDraw.Draw(img)
    w = int(34 * scale)
    top = cy - int(74 * scale)
    bottom = cy + int(74 * scale)
    draw.rounded_rectangle([cx - w, top, cx + w, bottom], radius=w, fill=cap)
    bw = int(9 * scale)
    arc_r = int(70 * scale)
    draw.arc([cx - arc_r, bottom - int(96 * scale), cx + arc_r, bottom + int(44 * scale)],
             start=0, end=180, fill=cap, width=bw)
    stem_bottom = bottom + int(44 * scale) + int(40 * scale)
    draw.line([(cx, bottom + int(44 * scale)), (cx, stem_bottom)], fill=cap, width=bw)
    half = int(44 * scale)
    draw.line([(cx - half, stem_bottom), (cx + half, stem_bottom)], fill=cap, width=bw)
    for radius, width in ((int(112 * scale), 7), (int(140 * scale), 5)):
        draw.arc([cx - radius, cy - radius, cx + radius, cy + radius], start=300, end=420, fill=wave, width=width)


def option_mic():
    img = base()
    mic(img, cx=176, cy=222, scale=0.92)
    return img


def option_monogram():
    img = base()
    draw = ImageDraw.Draw(img)
    cy = SIZE // 2
    for radius, width in ((120, 9), (150, 6)):
        draw.arc([SIZE // 2 - radius + 34, cy - radius, SIZE // 2 + radius + 34, cy + radius],
                 start=308, end=412, fill="#38bdf8", width=width)
    font = ImageFont.truetype(str(FONTS / "segoeuib.ttf"), 230)
    box = draw.textbbox((0, 0), "E", font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.text((SIZE * 0.40 - w / 2 - box[0], (SIZE - h) / 2 - box[1] - 4), "E", font=font, fill="#f4f7fb")
    return img


def mask_round(img):
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, SIZE - 1, SIZE - 1], fill=255)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


for name, build in (("avatar-mic", option_mic), ("avatar-monogram", option_monogram)):
    square = build()
    square.save(HERE / f"{name}.png", "PNG")
    mask_round(square).save(HERE / f"{name}-round.png", "PNG")
    print(name, square.size)
