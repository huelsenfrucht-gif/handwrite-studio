from __future__ import annotations

import base64
import json
import math
import os
import subprocess
from io import BytesIO
from pathlib import Path

import gradio as gr
import spaces
from huggingface_hub import hf_hub_download
from PIL import Image, UnidentifiedImageError


# The official repository contains the model architecture but is not packaged
# on PyPI. The checkpoint files themselves are served from the authors' Hub
# repository and are preloaded during the Space build (see README metadata).
SOURCE = Path("/tmp/diffusionpen-source")
if not (SOURCE / "unet.py").exists():
    subprocess.run(
        ["git", "clone", "--depth", "1", "https://github.com/koninik/DiffusionPen.git", str(SOURCE)],
        check=True,
    )

checkpoint = hf_hub_download("konnik/DiffusionPen", "diffusionpen_iam_model_path/models/ema_ckpt.pt")
style_weights = hf_hub_download("konnik/DiffusionPen", "style_models/iam_style_diffusionpen.pth")
os.environ.update(
    DIFFUSIONPEN_ROOT=str(SOURCE),
    DIFFUSIONPEN_MODEL_PATH=str(Path(checkpoint).parents[1]),
    DIFFUSIONPEN_STYLE_PATH=style_weights,
    DIFFUSIONPEN_SD_PATH="stable-diffusion-v1-5/stable-diffusion-v1-5",
    # ZeroGPU emulates CUDA while the Space starts, then attaches a real GPU
    # only while a @spaces.GPU function is running.
    DIFFUSIONPEN_DEVICE="cuda",
)

from model_engine import DiffusionPenEngine  # noqa: E402


engine = DiffusionPenEngine().load()


def _read_references(references: list[str] | None) -> list[bytes]:
    if not references or not 1 <= len(references) <= 5:
        raise gr.Error("Bitte 1–5 Stilreferenzen senden.")
    samples: list[bytes] = []
    for reference in references:
        path = Path(reference)
        if not path.is_file() or path.stat().st_size > 1_000_000:
            raise gr.Error("Eine Stilreferenz ist leer oder größer als 1 MB.")
        content = path.read_bytes()
        try:
            image = Image.open(BytesIO(content))
            image.verify()
        except (UnidentifiedImageError, OSError) as exc:
            raise gr.Error("Eine Stilreferenz ist kein gültiges Bild.") from exc
        samples.append(content)
    return samples


def _parse_texts(texts: str) -> list[str]:
    try:
        requested = json.loads(texts)
    except json.JSONDecodeError as exc:
        raise gr.Error("Ungültige Wortliste.") from exc
    if not isinstance(requested, list) or not 1 <= len(requested) <= 8:
        raise gr.Error("Bitte 1–8 Wörter pro Anfrage senden.")
    if not all(isinstance(word, str) and 2 <= len(word) <= 24 and word.isalnum() for word in requested):
        raise gr.Error("Jedes Wort muss 2–24 Buchstaben oder Zahlen enthalten.")
    return requested


def _duration(texts: str, _references: list[str] | None, variants: int) -> int:
    try:
        count = min(8, max(1, len(json.loads(texts))))
    except Exception:
        count = 1
    return min(120, 30 + math.ceil(count * max(1, min(4, variants)) / 4) * 18)


@spaces.GPU(duration=_duration)
def generate(texts: str, references: list[str] | None, variants: int) -> dict[str, object]:
    requested = _parse_texts(texts)
    samples = _read_references(references)
    if not 1 <= variants <= 4:
        raise gr.Error("Bitte 1–4 Varianten anfordern.")
    seed = int.from_bytes(os.urandom(4), "big")
    expanded = [word for word in requested for _ in range(variants)]
    words = engine.generate(expanded, samples, seed, int(os.getenv("DDIM_STEPS", "24")))
    result: list[dict[str, str]] = []
    for word in words:
        output = BytesIO()
        word.image.save(output, "PNG", optimize=True)
        result.append(
            {
                "text": word.text,
                "image": "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii"),
            }
        )
    return {"images": result}


demo = gr.Interface(
    fn=generate,
    inputs=[
        gr.Textbox(value='["Hallo", "Handschrift"]', label="Wörter als JSON"),
        gr.File(file_count="multiple", file_types=["image"], type="filepath", label="1–5 Stilwörter"),
        gr.Slider(1, 4, value=2, step=1, label="Varianten je Wort"),
    ],
    outputs=gr.JSON(label="Ergebnis"),
    title="Handwrite Studio DiffusionPen",
    description="Kostenlose, zustandslose 5-Shot-Handschriftgenerierung. Die hochgeladenen Ausschnitte werden nicht gespeichert.",
    api_name="generate",
)
demo.queue(default_concurrency_limit=1, max_size=32).launch()

