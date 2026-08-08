#!/usr/bin/env python3
"""Generates the Bubble Pop app icon.

Original artwork drawn from scratch: a twilight gradient plate with a few
glossy candy bubbles, matching the in-game bubble style (spherical bevel,
top gloss, sparkle highlight).

Usage:
    python3 tools/generate_icon.py

Writes icons/icon-1024.png, icon-512.png, icon-192.png, icon-180.png.
"""

from __future__ import annotations

import colorsys
import os

from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
ICON_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")

BACKGROUND_TOP = (92, 120, 219)
BACKGROUND_BOTTOM = (56, 66, 153)

# On-brand Candy palette (first colors), 0..255.
PURPLE = (153, 102, 237)
GREEN = (82, 201, 102)
ORANGE = (250, 153, 51)
BLUE = (66, 158, 247)
PINK = (247, 102, 166)
YELLOW = (252, 212, 64)


def scale_rgb(rgb, factor):
    r, g, b = (c / 255.0 for c in rgb)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    v = max(0.0, min(1.0, v * factor))
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return (int(r * 255), int(g * 255), int(b * 255))


def blend_white(rgb, amount):
    return tuple(int(c + (255 - c) * amount) for c in rgb)


def draw_gradient(image):
    draw = ImageDraw.Draw(image)
    for y in range(SIZE):
        ratio = y / (SIZE - 1)
        color = tuple(
            int(BACKGROUND_TOP[i] + (BACKGROUND_BOTTOM[i] - BACKGROUND_TOP[i]) * ratio)
            for i in range(3)
        )
        draw.line([(0, y), (SIZE, y)], fill=color)


def draw_bubble(overlay, cx, cy, r, color):
    """A glossy candy sphere: dark rim, lit face, top gloss, sparkle dot."""
    draw = ImageDraw.Draw(overlay)

    # Soft contact shadow.
    sh = Image.new("RGBA", overlay.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.ellipse([cx - r, cy - r + r * 0.16, cx + r, cy + r + r * 0.16], fill=(10, 12, 30, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(r * 0.06))
    overlay.alpha_composite(sh)

    # Dark rim body.
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=scale_rgb(color, 0.62) + (255,))

    # Lit spherical face (approximate radial shading with stacked ellipses).
    face = r * 0.9
    steps = 26
    for i in range(steps):
        t = i / (steps - 1)
        rr = face * (1 - t)
        # blend from lightened center to darker edge
        top = blend_white(color, 0.42)
        mid = color
        edge = scale_rgb(color, 0.78)
        if t < 0.5:
            k = t / 0.5
            col = tuple(int(top[j] + (mid[j] - top[j]) * k) for j in range(3))
        else:
            k = (t - 0.5) / 0.5
            col = tuple(int(mid[j] + (edge[j] - mid[j]) * k) for j in range(3))
        ox = cx - r * 0.32 * t
        oy = cy - r * 0.36 * t
        draw.ellipse([ox - rr, oy - rr, ox + rr, oy + rr], fill=col + (255,))

    # Top gloss crescent.
    gloss = Image.new("RGBA", overlay.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(gloss)
    gcol = blend_white(color, 0.7)
    gd.ellipse(
        [cx - face * 0.7, cy - r * 0.28 - face * 0.5, cx + face * 0.7, cy - r * 0.28 + face * 0.5],
        fill=gcol + (120,),
    )
    gloss = gloss.filter(ImageFilter.GaussianBlur(r * 0.05))
    overlay.alpha_composite(gloss)

    # Sparkle highlight dot.
    hx = cx - r * 0.34
    hy = cy - r * 0.4
    draw.ellipse(
        [hx - r * 0.2, hy - r * 0.14, hx + r * 0.2, hy + r * 0.14],
        fill=blend_white(color, 0.9) + (235,),
    )


def main():
    image = Image.new("RGB", (SIZE, SIZE), BACKGROUND_TOP)
    draw_gradient(image)
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    # Soft rounded plate behind the bubbles.
    plate = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    m = SIZE * 0.14
    pd.rounded_rectangle([m, m, SIZE - m, SIZE - m], radius=SIZE * 0.16, fill=(38, 45, 96, 235))
    plate = plate.filter(ImageFilter.GaussianBlur(SIZE * 0.006))
    overlay.alpha_composite(plate)

    # A cheerful little cluster of bubbles, centered inside the plate.
    R = SIZE * 0.125
    d = R * 2.04
    rowf = 0.866
    cx0 = SIZE / 2 - d           # left bubble of the top row of 3
    cy0 = SIZE / 2 - d * rowf * 0.5
    layout = [
        (cx0, cy0, PURPLE),
        (cx0 + d, cy0, GREEN),
        (cx0 + d * 2, cy0, ORANGE),
        (cx0 + R, cy0 + d * rowf, PINK),
        (cx0 + R + d, cy0 + d * rowf, BLUE),
    ]
    for (x, y, col) in layout:
        draw_bubble(overlay, x, y, R, col)

    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")

    os.makedirs(ICON_DIR, exist_ok=True)
    master = os.path.join(ICON_DIR, "icon-1024.png")
    image.save(master, "PNG")
    print(f"Wrote {master} (1024x1024)")
    for size in (512, 192, 180):
        resized = image.resize((size, size), Image.LANCZOS)
        out = os.path.join(ICON_DIR, f"icon-{size}.png")
        resized.save(out, "PNG")
        print(f"Wrote {out} ({size}x{size})")


if __name__ == "__main__":
    main()
