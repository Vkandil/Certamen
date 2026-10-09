"""Prepares the generated images for the X cut: keys out flat backgrounds, builds recolourable masks."""
import numpy as np
from PIL import Image
from scipy import ndimage

W = 'work/'; A = 'assets/'

# laurel + helmet: ink on white -> alpha mask (white = transparent)
for name, ink in [('laurel', (27, 26, 23)), ('helmet', (0, 0, 0))]:
    im = np.asarray(Image.open(W + f'{name}_src.webp').convert('L')).astype(float) / 255
    alpha = np.clip((1 - im - 0.04) / 0.9, 0, 1)
    rgba = np.zeros(im.shape + (4,), np.uint8)
    rgba[..., :3] = ink
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    ys, xs = np.where(alpha > 0.05)
    pad = 8
    rgba = rgba[max(0, ys.min() - pad):ys.max() + pad, max(0, xs.min() - pad):xs.max() + pad]
    Image.fromarray(rgba).save(A + f'{name}.png', optimize=True)
    print(name, rgba.shape)

# tablet: flood-fill the flat cream background from the borders, keep the stone
im = np.asarray(Image.open(W + 'tablet_src.webp').convert('RGB')).astype(float)
bg = np.median(np.concatenate([im[:20].reshape(-1, 3), im[-20:].reshape(-1, 3)]), 0)
dist = np.linalg.norm(im - bg, axis=2)
near = dist < 14
lab, _ = ndimage.label(near)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bgmask = np.isin(lab, list(border))
alpha = 1 - ndimage.gaussian_filter(bgmask.astype(float), 1.2)
alpha[~bgmask] = 1
rgba = np.dstack([im.astype(np.uint8), (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
ys, xs = np.where(alpha > 0.5)
rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
Image.fromarray(rgba).save(A + 'tablet.png', optimize=True)
print('tablet', rgba.shape, 'bg', bg.round())

# arena + stone: square-crop, re-encode
for name in ['arena', 'stone']:
    im = Image.open(W + f'{name}_src.webp').convert('RGB')
    w, h = im.size; s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((1080, 1080), Image.LANCZOS)
    im.save(A + f'{name}.jpg', quality=92)
    print(name, im.size)
