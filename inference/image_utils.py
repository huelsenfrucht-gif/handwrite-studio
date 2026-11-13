from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Sequence

import numpy as np
import torch
from PIL import Image, ImageOps
from torchvision import transforms


def open_image(source: Image.Image | bytes | str | Path) -> Image.Image:
    if isinstance(source, Image.Image):
        return source.convert("RGB")
    if isinstance(source, (str, Path)):
        return Image.open(source).convert("RGB")
    return Image.open(BytesIO(source)).convert("RGB")


def crop_whitespace(image: Image.Image, threshold: int = 180) -> Image.Image:
    array = np.array(image.convert("L"))
    coords = np.argwhere(array < threshold)
    if coords.size == 0:
        return image.convert("RGB")
    top_left = coords.min(axis=0)
    bottom_right = coords.max(axis=0) + 1
    cropped = array[top_left[0] : bottom_right[0], top_left[1] : bottom_right[1]]
    # Notebook rules and paper shadows are much lighter than the real ink.
    # Remove them before the style encoder so it learns letter geometry rather
    # than grey horizontal lines from the photographed page.
    return Image.fromarray(np.where(cropped >= threshold, 255, cropped).astype(np.uint8)).convert("RGB")


def resize_reference(image: Image.Image, width: int = 256, height: int = 64) -> Image.Image:
    image = crop_whitespace(image)
    scaled_width = max(1, int(image.width * height / max(1, image.height)))
    resized = image.resize((scaled_width, height), Image.Resampling.LANCZOS)
    if resized.width > width:
        resized.thumbnail((width, height), Image.Resampling.LANCZOS)
    return ImageOps.pad(resized, (width, height), color="white")


def reference_tensor(
    sources: Sequence[Image.Image | bytes | str | Path],
    transform: transforms.Compose,
    device: str,
) -> torch.Tensor:
    if not sources:
        raise ValueError("At least one reference image is required.")
    images = [resize_reference(open_image(source)) for source in sources[:5]]
    while len(images) < 5:
        images.append(images[len(images) % len(sources)].copy())
    return torch.stack([transform(image) for image in images]).to(device)
