"""Publish the deployment bundle to a public Hugging Face Gradio Space.

Usage after `hf auth login`:
    python deploy.py ACCOUNT/handwrite-studio-diffusionpen

The script only creates/updates a public Space. It deliberately does not select
paid hardware. Choose the free ZeroGPU option in the Space settings afterwards.
"""

from __future__ import annotations

import shutil
import sys
import tempfile
from pathlib import Path

from huggingface_hub import HfApi


HERE = Path(__file__).resolve().parent
INFERENCE = HERE.parent


def main() -> None:
    if len(sys.argv) != 2 or "/" not in sys.argv[1]:
        raise SystemExit("Aufruf: python deploy.py ACCOUNT/handwrite-studio-diffusionpen")
    repo_id = sys.argv[1]
    api = HfApi()
    api.create_repo(repo_id, repo_type="space", space_sdk="gradio", private=False, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="handwrite-space-") as temporary:
        bundle = Path(temporary)
        for name in ("README.md", "requirements.txt", "app.py"):
            shutil.copy2(HERE / name, bundle / name)
        for name in ("model_engine.py", "image_utils.py", "german.py"):
            shutil.copy2(INFERENCE / name, bundle / name)
        api.upload_folder(
            repo_id=repo_id,
            repo_type="space",
            folder_path=bundle,
            commit_message="Deploy free ZeroGPU handwriting service",
        )
    print(f"Veröffentlicht: https://huggingface.co/spaces/{repo_id}")
    print("Jetzt in Settings als Hardware ausschließlich ZeroGPU wählen (keine kostenpflichtige GPU).")


if __name__ == "__main__":
    main()

