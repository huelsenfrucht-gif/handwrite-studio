# DiffusionPen inference service

The browser app performs OCR locally and sends at most five confirmed word
crops plus a list of new words to this stateless service. It returns one PNG
per word. The browser keeps that PNG for faithful PDF/SVG/editor rendering and
also derives an editable centerline approximation for the Goodnotes export.

Required environment variables:

- `ALLOWED_ORIGINS`: comma-separated public app origins.
- `DDIM_STEPS`: defaults to `20`; `12` is faster, `32` is sharper.
- `PORT`: defaults to `8501` in the container.

No user account or database is used. A CUDA GPU is recommended for production.
Set `VITE_SYNTHESIS_API` to this service's HTTPS origin when building the web
app.

## Local run

The service expects an official DiffusionPen checkout and its model assets. Set
`DIFFUSIONPEN_ROOT` to that checkout, then run:

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
ALLOWED_ORIGINS=http://127.0.0.1:5173 uvicorn app:app --host 127.0.0.1 --port 8501
```

The provided Dockerfile downloads the upstream code and the minimal official
weights during the image build. In production, terminate TLS in front of this
container and set `ALLOWED_ORIGINS` to the exact public app origin. Do not enable
request-body logging: the selected style crops are intentionally processed only
in memory.

## Serverless GPU deployment with Modal

Modal can build the included Dockerfile, attach an L4 GPU only while requests are
running and expose the FastAPI app through HTTPS. From this directory:

```sh
python -m pip install modal
modal setup
modal deploy modal_app.py
```

The command prints the permanent web-function URL. Build the frontend with that
origin as `VITE_SYNTHESIS_API`. `modal_app.py` restricts browser access to the
production Handwrite Studio origin and runs one generation request per container
at a time because the model is deliberately serialized. Modal currently requires
a valid payment method for GPU functions; review its current usage limits and
spending cap before deployment.

## Endpoints

- `GET /healthz` reports readiness and the selected device.
- `POST /v1/generate` accepts `texts` as a JSON array and one to five
  `references` multipart image files. It accepts at most 40 words per request.

The official DiffusionPen checkpoint was trained on IAM and therefore does not
learn German umlaut dots or `ß` from its training images. The service feeds a
base spelling to the model and restores missing umlaut dots on the generated
raster. Since IAM contains no `ß`, it uses the standard readable `ss`
transcription rather than allowing the model to hallucinate an unrelated
letter. This keeps the model's connected word geometry and the intended text
readable.
