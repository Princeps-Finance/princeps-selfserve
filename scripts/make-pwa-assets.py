"""Rebuilds the app icons and the iOS splash screens from public/icons/icon-512.png.

The icon is the Princeps mark on a cream square. Here it is put on plain white, and the splash screens
are the mark centred on white. Run: python3 scripts/make-pwa-assets.py  (needs Pillow). Commit the output.
"""
from PIL import Image
import os

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'public', 'icons', 'icon-512.png')
OUT = os.path.join(ROOT, 'public', 'icons')
SPLASH = os.path.join(OUT, 'splash')
CREAM = (245, 242, 236)

def on_white(img):
    """Same artwork with the cream background turned white. Edge pixels are blended back toward white."""
    img = img.convert('RGB')
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            d = max(abs(r - CREAM[0]), abs(g - CREAM[1]), abs(b - CREAM[2]))
            if d < 60:  # background, or an edge pixel mostly background
                t = 1 - d / 60  # 1 = pure background
                px[x, y] = (round(r + (255 - r) * t), round(g + (255 - g) * t), round(b + (255 - b) * t))
    return img

# The mark fills about 70% of the source square; crop to it so we control the size on each screen.
base = on_white(Image.open(SRC))
mark = base.crop((70, 90, 440, 420))  # the artwork, with a small margin
mark_w, mark_h = mark.size

def save_icon(name, size, mark_share):
    canvas = Image.new('RGB', (size, size), 'white')
    scale = size * mark_share / mark_w
    m = mark.resize((round(mark_w * scale), round(mark_h * scale)), Image.LANCZOS)
    canvas.paste(m, ((size - m.width) // 2, (size - m.height) // 2))
    canvas.save(os.path.join(OUT, name), optimize=True)

save_icon('icon-192.png', 192, 0.62)
save_icon('icon-512.png', 512, 0.62)
save_icon('apple-touch-icon.png', 180, 0.62)
save_icon('icon-maskable-512.png', 512, 0.5)  # maskable: keep the art inside the 80% safe circle

# iOS splash screens (portrait): width, height in device pixels, and the CSS size and ratio for the media query.
SIZES = [
    (1320, 2868, 440, 956, 3), (1206, 2622, 402, 874, 3), (1290, 2796, 430, 932, 3), (1179, 2556, 393, 852, 3),
    (1284, 2778, 428, 926, 3), (1170, 2532, 390, 844, 3), (1080, 2340, 360, 780, 3), (1242, 2688, 414, 896, 3),
    (828, 1792, 414, 896, 2), (1125, 2436, 375, 812, 3), (1242, 2208, 414, 736, 3), (750, 1334, 375, 667, 2),
    (640, 1136, 320, 568, 2), (2048, 2732, 1024, 1366, 2), (1668, 2388, 834, 1194, 2), (1640, 2360, 820, 1180, 2),
    (1668, 2224, 834, 1112, 2), (1536, 2048, 768, 1024, 2),
]
os.makedirs(SPLASH, exist_ok=True)
links = []
for w, h, cw, ch, ratio in SIZES:
    canvas = Image.new('RGB', (w, h), 'white')
    target = min(w, h) * 0.34
    scale = target / mark_w
    m = mark.resize((round(mark_w * scale), round(mark_h * scale)), Image.LANCZOS)
    canvas.paste(m, ((w - m.width) // 2, (h - m.height) // 2))
    name = f'splash-{w}x{h}.png'
    canvas.save(os.path.join(SPLASH, name), optimize=True)
    links.append(
        f'    <link rel="apple-touch-startup-image" href="icons/splash/{name}" '
        f'media="(device-width: {cw}px) and (device-height: {ch}px) and (-webkit-device-pixel-ratio: {ratio}) and (orientation: portrait)" />'
    )
print('\n'.join(links))
