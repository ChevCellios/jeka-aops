"""Build the lightweight animated JEKA AOPS banner used by the README."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "assets" / "jeka-aops-readme-base.png"
OUTPUT = ROOT / "docs" / "assets" / "jeka-aops-readme.gif"
SIZE = (1000, 500)
FRAMES = 24


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    windows_fonts = Path("C:/Windows/Fonts")
    candidates = (
        [windows_fonts / "segoeuib.ttf", windows_fonts / "arialbd.ttf"]
        if bold
        else [windows_fonts / "segoeui.ttf", windows_fonts / "arial.ttf"]
    )
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def glow_line(layer: Image.Image, points, color, width: int = 2) -> None:
    glow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.line(points, fill=(*color, 90), width=width * 5, joint="curve")
    glow = glow.filter(ImageFilter.GaussianBlur(width * 2))
    layer.alpha_composite(glow)
    ImageDraw.Draw(layer).line(points, fill=(*color, 235), width=width, joint="curve")


def build_frame(base: Image.Image, index: int) -> Image.Image:
    phase = index / FRAMES
    pulse = (math.sin(phase * math.tau) + 1) / 2
    frame = ImageEnhance.Brightness(base).enhance(0.97 + pulse * 0.05).convert("RGBA")

    # Preserve readable negative space for deterministic typography.
    shade = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    shade_draw = ImageDraw.Draw(shade)
    for x in range(430, SIZE[0]):
        alpha = int(25 + 115 * ((x - 430) / (SIZE[0] - 430)))
        shade_draw.line((x, 0, x, SIZE[1]), fill=(1, 7, 20, alpha))
    frame.alpha_composite(shade)

    effects = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(effects)

    # Sensor pulse around the emblem.
    center = (267, 219)
    for ring in range(3):
        progress = (phase + ring / 3) % 1
        radius = 92 + progress * 155
        alpha = int(150 * (1 - progress))
        bbox = (
            center[0] - radius,
            center[1] - radius,
            center[0] + radius,
            center[1] + radius,
        )
        draw.arc(bbox, 198, 342, fill=(0, 190, 255, alpha), width=3)
        draw.arc(bbox, 18, 162, fill=(0, 190, 255, alpha // 2), width=2)

    # Scanning line sweeps across the road and sensor field.
    scan_x = int(85 + ((phase * 1.25) % 1) * 395)
    scan_glow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    scan_draw = ImageDraw.Draw(scan_glow)
    scan_draw.line((scan_x, 70, scan_x, 432), fill=(0, 210, 255, 105), width=15)
    scan_glow = scan_glow.filter(ImageFilter.GaussianBlur(9))
    effects.alpha_composite(scan_glow)
    draw = ImageDraw.Draw(effects)
    draw.line((scan_x, 82, scan_x, 420), fill=(97, 230, 255, 185), width=2)

    # Animated audio/data waveform on the right.
    wave_points = []
    for x in range(560, 952, 5):
        envelope = math.sin((x - 560) / 392 * math.pi) ** 0.7
        y = 337 + math.sin((x / 52) + phase * math.tau * 1.4) * (12 + 24 * pulse) * envelope
        wave_points.append((x, int(y)))
    glow_line(effects, wave_points, (0, 191, 255), 2)

    # Small live indicator and tracking brackets.
    status_alpha = int(125 + pulse * 130)
    draw.ellipse((909, 92, 919, 102), fill=(255, 170, 22, status_alpha))
    bx, by, bw, bh = 798, 205, 62, 45
    corner = 13
    for points in (
        [(bx, by + corner), (bx, by), (bx + corner, by)],
        [(bx + bw - corner, by), (bx + bw, by), (bx + bw, by + corner)],
        [(bx, by + bh - corner), (bx, by + bh), (bx + corner, by + bh)],
        [(bx + bw - corner, by + bh), (bx + bw, by + bh), (bx + bw, by + bh - corner)],
    ):
        draw.line(points, fill=(0, 190, 255, 130 + int(80 * pulse)), width=2)

    frame.alpha_composite(effects)

    # Exact text is rendered locally to avoid generative spelling errors.
    text_layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    td = ImageDraw.Draw(text_layer)
    title_font = font(64, bold=True)
    subtitle_font = font(18, bold=True)
    detail_font = font(16)
    td.text((548, 105), "JEKA", font=title_font, fill=(245, 251, 255, 255), stroke_width=1)
    title_width = td.textbbox((0, 0), "JEKA", font=title_font)[2]
    td.text((560 + title_width, 105), "AOPS", font=title_font, fill=(0, 190, 255, 255), stroke_width=1)
    td.text(
        (552, 188),
        "AUDIO-OPTIČKI SUSTAV PROMETNE SIGURNOSTI",
        font=subtitle_font,
        fill=(153, 215, 244, 245),
    )
    td.rounded_rectangle((552, 251, 921, 294), radius=10, outline=(0, 176, 235, 145), width=2)
    td.text(
        (573, 262),
        "SNIMI  •  ANALIZIRAJ  •  RAZVIJAJ OTVORENO",
        font=detail_font,
        fill=(229, 243, 252, 245),
    )
    frame.alpha_composite(text_layer)
    return frame.convert("RGB")


def main() -> None:
    base = Image.open(SOURCE).convert("RGB").resize(SIZE, Image.Resampling.LANCZOS)
    rendered = [build_frame(base, index) for index in range(FRAMES)]

    # One shared palette keeps the GIF compact and prevents color flicker.
    palette_source = rendered[0].quantize(colors=112, method=Image.Quantize.MEDIANCUT)
    frames = [
        image.quantize(palette=palette_source, dither=Image.Dither.NONE)
        for image in rendered
    ]
    frames[0].save(
        OUTPUT,
        save_all=True,
        append_images=frames[1:],
        duration=85,
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(f"Saved {OUTPUT} ({OUTPUT.stat().st_size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
