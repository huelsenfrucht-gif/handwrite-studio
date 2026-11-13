"""Serverless GPU deployment for the Handwrite Studio inference API.

Run `modal deploy modal_app.py` from this directory after `modal setup`.
"""

from __future__ import annotations

import modal


APP_ORIGIN = "https://handwrite-studio-hubertus.bothov-hlsen.chatgpt.site"

image = modal.Image.from_dockerfile(
    "Dockerfile",
    context_dir=".",
).env(
    {
        "ALLOWED_ORIGINS": APP_ORIGIN,
        "DDIM_STEPS": "20",
    }
)

modal_app = modal.App("handwrite-studio-diffusionpen")


@modal_app.function(
    image=image,
    gpu="L4",
    timeout=180,
    scaledown_window=60,
)
@modal.concurrent(max_inputs=1)
@modal.asgi_app()
def api():
    from app import app

    return app
