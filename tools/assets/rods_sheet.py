"""Stitch the rods_contact.py renders into the contact sheet and cut the shop thumbnails.
  python tools/assets/rods_sheet.py <render dir> docs/rods-contact-sheet.png [--thumbs]
Thumbnails (--thumbs): public/images/rods/<tier>.webp, the whole rod cropped to its pixels (tier from tools/assets/manifest.json)."""
import sys, os, glob, json
from PIL import Image, ImageDraw, ImageChops
d, out = sys.argv[1], sys.argv[2]
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
tiers = {os.path.splitext(os.path.basename(a['out']))[0]: a['tier'] for a in json.load(open(os.path.join(root, 'tools', 'assets', 'manifest.json'), encoding='utf-8'))['assets'] if a['mode'] == 'rod'}
names = sorted({os.path.basename(f).rsplit('_', 1)[0] for f in glob.glob(os.path.join(d, '*_full.png'))})
rows = []
for n in names:
    raw = [Image.open(os.path.join(d, f'{n}_{k}.png')).convert('RGBA') for k in ('full', 'reel_l', 'reel_r', 'top')]
    parts = []
    for r_ in raw:
        b_ = Image.new('RGBA', r_.size, (210, 214, 220, 255)); b_.alpha_composite(r_); parts.append(b_.convert('RGB'))
    row = Image.new('RGB', (1400 + 3 * 520, 340), (210, 214, 220))
    x = 0
    for p in parts:
        row.paste(p, (x, 0)); x += p.width
    ImageDraw.Draw(row).text((10, 8), f"{n}  ->  tier {tiers.get(n, '?')}", fill=(20, 20, 20))
    rows.append(row)
    if '--thumbs' in sys.argv and n in tiers:
        im = raw[0]
        box = im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
        if box:
            pad = 10
            box = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))
            t = im.crop(box)
            t.thumbnail((480, 130))
            os.makedirs(os.path.join(root, 'public', 'images', 'rods'), exist_ok=True)
            t.save(os.path.join(root, 'public', 'images', 'rods', tiers[n] + '.webp'), quality=82)
sheet = Image.new('RGB', (rows[0].width, 340 * len(rows)), (255, 255, 255))
for i, r in enumerate(rows):
    sheet.paste(r, (0, i * 340))
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
sheet.save(out)
print('wrote', out, sheet.size)
