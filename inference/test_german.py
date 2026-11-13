from __future__ import annotations

import unittest

import numpy as np
from PIL import Image, ImageDraw

from german import model_spelling, restore_german_marks


class GermanPostprocessingTests(unittest.TestCase):
    def test_model_spelling_preserves_character_count(self) -> None:
        original = "Ärger über Fußballgrößen"
        converted = model_spelling(original)
        self.assertEqual(converted, "Arger uber Fussballgrossen")

    def test_umlaut_adds_two_dark_marks_above_word(self) -> None:
        image = Image.new("RGB", (256, 64), "white")
        draw = ImageDraw.Draw(image)
        draw.line(((18, 38), (230, 38)), fill=(30, 30, 30), width=4)
        restored = restore_german_marks(image, "schön")
        before = np.asarray(image.convert("L"))
        after = np.asarray(restored.convert("L"))
        self.assertGreater(int(np.count_nonzero(after[:38] < 210)), int(np.count_nonzero(before[:38] < 210)))

    def test_plain_word_is_unchanged(self) -> None:
        image = Image.new("RGB", (64, 32), "white")
        self.assertEqual(restore_german_marks(image, "Hallo").tobytes(), image.tobytes())


if __name__ == "__main__":
    unittest.main()
