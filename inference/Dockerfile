FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends git libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN git clone --depth 1 https://github.com/koninik/DiffusionPen.git /app/external_models/diffusionpen
RUN hf download konnik/DiffusionPen diffusionpen_iam_model_path/models/ema_ckpt.pt style_models/iam_style_diffusionpen.pth --local-dir /app/external_models/diffusionpen && \
    hf download stable-diffusion-v1-5/stable-diffusion-v1-5 vae/config.json vae/diffusion_pytorch_model.safetensors scheduler/scheduler_config.json --local-dir /app/external_models/diffusionpen/stable-diffusion-v1-5
COPY . .
ENV DIFFUSIONPEN_ROOT=/app/external_models/diffusionpen PORT=8501
EXPOSE 8501
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
