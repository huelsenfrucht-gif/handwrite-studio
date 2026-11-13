# Third-party model

This service integrates [DiffusionPen](https://github.com/koninik/DiffusionPen),
Copyright (c) 2024 Konstantina Nikolaidou, under the MIT License. Model weights
are downloaded from the official `konnik/DiffusionPen` Hugging Face repository.
Stable Diffusion 1.5 VAE assets retain their upstream license and attribution.

The service is stateless: uploaded reference images are decoded in memory and
discarded when the request finishes.
