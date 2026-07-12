"""Normalize each bust's base-color texture toward Marcus's tone.

Reinhard-style per-channel color transfer computed on masked pixels: only
pixels bright enough to be visible marble (top 60% by luminance) enter the
statistics, so dark weathering crevices and background junk don't skew the
match. The transform itself is then applied to every pixel.
"""

import numpy as np
from PIL import Image
import os

WORK = os.path.dirname(os.path.abspath(__file__))

FIGURES = {
    "caesar": "caesar/baseColor_1.png",
    "marcus": "marcus/baseColor_1.png",
    "cicero": "cicero/baseColor_1.png",
    "seneca": "seneca/baseColor_1.png",
    "augustus": "augustus/baseColor.jpg",
}

REFERENCE = "marcus"


def masked_stats(arr):
    """Mean/std per channel over the bright (visible-marble) pixels."""
    lum = 0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]
    cutoff = np.percentile(lum, 40)  # keep top 60%
    mask = lum >= cutoff
    px = arr[mask]
    return px.mean(axis=0), px.std(axis=0)


def load(path):
    img = Image.open(path).convert("RGB")
    return img, np.asarray(img, dtype=np.float64)


ref_img, ref_arr = load(os.path.join(WORK, FIGURES[REFERENCE]))
ref_mean, ref_std = masked_stats(ref_arr)
print(f"reference ({REFERENCE}): mean={ref_mean.round(1)} std={ref_std.round(1)}")

for name, rel in FIGURES.items():
    if name == REFERENCE:
        continue
    path = os.path.join(WORK, rel)
    img, arr = load(path)
    mean, std = masked_stats(arr)
    # Reinhard transfer: recenter, rescale channel spread, re-center on ref.
    # Clamp the std ratio so a flat texture doesn't get its contrast blown up.
    ratio = np.clip(ref_std / std, 0.6, 1.6)
    out = (arr - mean) * ratio + ref_mean
    out = np.clip(out, 0, 255).astype(np.uint8)
    Image.fromarray(out).save(path)
    nm, ns = masked_stats(out.astype(np.float64))
    print(f"{name}: mean {mean.round(1)} -> {nm.round(1)} (ratio {ratio.round(2)})")

print("done")
