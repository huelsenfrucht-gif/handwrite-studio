from __future__ import annotations

import asyncio
import base64
import json
import os
from io import BytesIO

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from model_engine import DiffusionPenEngine

app = FastAPI(title="Handwrite Studio DiffusionPen", docs_url=None, redoc_url=None)
origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://127.0.0.1:5173").split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["*"], max_age=86400)
engine = DiffusionPenEngine()
generation_lock = asyncio.Lock()


@app.get("/healthz")
def health() -> dict[str, str]:
    return {"status": "ok", "device": engine.device}


@app.post("/v1/generate")
async def generate(texts: str = Form(...), references: list[UploadFile] = File(...)) -> dict[str, object]:
    try:
        requested = json.loads(texts)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, "Ungültige Wortliste.") from exc
    if not isinstance(requested, list) or not 1 <= len(requested) <= 40 or not all(isinstance(word, str) and 2 <= len(word) <= 24 and word.isalnum() for word in requested):
        raise HTTPException(400, "Bitte 1–40 Wörter mit jeweils 2–24 Buchstaben oder Zahlen senden.")
    if not 1 <= len(references) <= 5:
        raise HTTPException(400, "Bitte 1–5 Stilreferenzen senden.")
    samples: list[bytes] = []
    for upload in references:
        content = await upload.read()
        if not content or len(content) > 1_000_000:
            raise HTTPException(413, "Eine Stilreferenz ist leer oder größer als 1 MB.")
        try:
            image = Image.open(BytesIO(content)); image.verify()
        except (UnidentifiedImageError, OSError) as exc:
            raise HTTPException(400, "Eine Stilreferenz ist kein gültiges Bild.") from exc
        samples.append(content)
    seed = int.from_bytes(os.urandom(4), "big")
    async with generation_lock:
        try:
            words = await run_in_threadpool(engine.generate, requested, samples, seed, int(os.getenv("DDIM_STEPS", "20")))
        except Exception as exc:
            raise HTTPException(503, f"Handschriftmodell nicht bereit: {exc}") from exc
    result = []
    for word in words:
        output = BytesIO(); word.image.save(output, "PNG", optimize=True)
        result.append({"text": word.text, "image": "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii")})
    return {"images": result}
