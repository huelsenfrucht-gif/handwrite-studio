from __future__ import annotations

from collections.abc import Sequence

import numpy as np
from PIL import Image, ImageDraw


_MODEL_REPLACEMENTS = str.maketrans({
    "ä": "a",
    "ö": "o",
    "ü": "u",
    "Ä": "A",
    "Ö": "O",
    "Ü": "U",
    # IAM does not contain the German sharp s. The standard ss transcription
    # is reliably readable, unlike the unrelated glyph the checkpoint invents
    # for the unseen Unicode codepoint.
    "ß": "ss",
    "ẞ": "SS",
})


def model_spelling(text: str) -> str:
    """Return a readable IAM-supported spelling for German Unicode text."""
    return text.translate(_MODEL_REPLACEMENTS)


def _weight(character: str) -> float:
    if character in "ilIjtfr":
        return 0.55
    if character in "mwMW":
        return 1.35
    if character.isupper():
        return 1.15
    return 1.0


def _ink_bounds(gray: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(gray < 210)
    if not len(xs):
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def _character_window(text: str, index: int, left: int, right: int) -> tuple[int, int, int]:
    weights: Sequence[float] = [_weight(character) for character in text]
    total = max(sum(weights), 1.0)
    width = max(1, right - left + 1)
    start = left + round(width * sum(weights[:index]) / total)
    end = left + round(width * sum(weights[: index + 1]) / total)
    return start, max(start + 1, end), (start + end) // 2


def restore_german_marks(image: Image.Image, text: str) -> Image.Image:
    """Restore umlaut dots and a handwritten sharp-s cue after IAM inference.

    DiffusionPen uses a Unicode text encoder, but its IAM training images do not
    teach German diacritics. Generating the base letter and adding only the
    missing pen marks is much more stable than asking the model to hallucinate
    an unseen glyph.
    """
    if not any(character in "äöüÄÖÜ" for character in text):
        return image
    result = image.convert("RGB")
    gray = np.asarray(result.convert("L"))
    bounds = _ink_bounds(gray)
    if bounds is None:
        return result
    left, top, right, bottom = bounds
    dark = np.asarray(result)[gray < 150]
    ink = tuple(int(value) for value in (np.median(dark, axis=0) if len(dark) else np.array([35, 35, 35])))
    draw = ImageDraw.Draw(result)
    radius = max(1, round(result.height / 64))

    rendered_text = model_spelling(text)
    rendered_index = 0
    for character in text:
        if character in "ßẞ":
            rendered_index += 2
            continue
        if character not in "äöüÄÖÜ":
            rendered_index += 1
            continue
        start, end, center = _character_window(rendered_text, rendered_index, left, right)
        local = gray[max(0, top - 2) : bottom + 1, max(0, start) : min(gray.shape[1], end + 1)]
        local_ys = np.where(local < 210)[0]
        local_top = top + int(local_ys.min()) if len(local_ys) else top
        character_width = max(4, end - start)
        y = max(1, local_top - max(3, radius * 3))
        spread = max(2, min(5, character_width // 5))
        for x in (center - spread, center + spread):
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=ink)
        rendered_index += 1
    return result
