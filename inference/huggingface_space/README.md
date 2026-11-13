---
title: Handwrite Studio DiffusionPen
emoji: ✍️
colorFrom: blue
colorTo: green
sdk: gradio
python_version: 3.12.12
app_file: app.py
suggested_hardware: zero-a10g
preload_from_hub:
  - konnik/DiffusionPen diffusionpen_iam_model_path/models/ema_ckpt.pt,style_models/iam_style_diffusionpen.pth
  - stable-diffusion-v1-5/stable-diffusion-v1-5 vae/config.json,vae/diffusion_pytorch_model.safetensors,scheduler/scheduler_config.json
  - google/canine-c
---

# Handwrite Studio – kostenloser Modellserver

Dieser öffentliche Gradio-Space stellt den zustandslosen DiffusionPen-Generator
für Handwrite Studio bereit. Er speichert weder Texte noch Stilbilder. In den
Space-Einstellungen muss **ZeroGPU** als Hardware gewählt sein; `suggested_hardware`
weist nur darauf hin und bucht keine kostenpflichtige GPU.

Die App ruft ausschließlich den benannten Endpunkt `/generate` auf. Besucher
brauchen dafür kein Hugging-Face-Konto. Wenn das kostenlose Tageskontingent
aufgebraucht ist, schlägt die Anfrage fehl, ohne dass automatisch Kosten
entstehen.

