from __future__ import annotations

import os
import random
import sys
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Sequence

import torch
from diffusers import AutoencoderKL, DDIMScheduler
from PIL import Image
from torch import nn
from torchvision import transforms
from transformers import CanineModel, CanineTokenizer

from image_utils import reference_tensor
from german import model_spelling, restore_german_marks

ROOT = Path(os.getenv("DIFFUSIONPEN_ROOT", Path(__file__).parent / "external_models" / "diffusionpen"))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from feature_extractor import ImageEncoder  # type: ignore  # noqa: E402
from unet import UNetModel  # type: ignore  # noqa: E402


class SingleDeviceWrapper(nn.Module):
    def __init__(self, module: nn.Module):
        super().__init__()
        self.module = module

    def forward(self, *args, **kwargs):
        return self.module(*args, **kwargs)


@dataclass
class GeneratedWord:
    text: str
    image: Image.Image


class DiffusionPenEngine:
    def __init__(self) -> None:
        self.device = "mps" if torch.backends.mps.is_available() else "cuda:0" if torch.cuda.is_available() else "cpu"
        self.model_path = Path(os.getenv("DIFFUSIONPEN_MODEL_PATH", ROOT / "diffusionpen_iam_model_path"))
        self.style_path = Path(os.getenv("DIFFUSIONPEN_STYLE_PATH", ROOT / "style_models" / "iam_style_diffusionpen.pth"))
        self.sd_path = Path(os.getenv("DIFFUSIONPEN_SD_PATH", ROOT / "stable-diffusion-v1-5"))
        self.args = SimpleNamespace(device=self.device, img_size=(64, 256), channels=4, emb_dim=320, num_heads=4, num_res_blocks=1, interpolation=False, mix_rate=None, latent=True, color=True)
        self.transform = transforms.Compose([transforms.ToTensor(), transforms.Normalize((.5, .5, .5), (.5, .5, .5))])
        self.tokenizer = self.unet = self.vae = self.scheduler = self.style_extractor = None

    def load(self) -> "DiffusionPenEngine":
        if self.unet is not None:
            return self
        self.tokenizer = CanineTokenizer.from_pretrained("google/canine-c")
        text_encoder = SingleDeviceWrapper(CanineModel.from_pretrained("google/canine-c")).to(self.device).eval()
        core = UNetModel(image_size=self.args.img_size, in_channels=4, model_channels=320, out_channels=4, num_res_blocks=1, attention_resolutions=(1, 1), channel_mult=(1, 1), num_heads=4, num_classes=339, context_dim=320, vocab_size=79, text_encoder=text_encoder, args=self.args)
        self.unet = SingleDeviceWrapper(core).to(self.device).eval()
        self.unet.load_state_dict(torch.load(self.model_path / "models" / "ema_ckpt.pt", map_location=self.device))
        self.vae = SingleDeviceWrapper(AutoencoderKL.from_pretrained(self.sd_path, subfolder="vae")).to(self.device).eval()
        self.vae.requires_grad_(False)
        self.scheduler = DDIMScheduler.from_pretrained(self.sd_path, subfolder="scheduler")
        style = ImageEncoder(model_name="mobilenetv2_100", num_classes=0, pretrained=True, trainable=False)
        weights = torch.load(self.style_path, map_location=self.device)
        current = style.state_dict()
        current.update({key: value for key, value in weights.items() if key in current and current[key].shape == value.shape})
        style.load_state_dict(current)
        self.style_extractor = style.to(self.device).eval()
        self.style_extractor.requires_grad_(False)
        return self

    def generate(self, texts: Sequence[str], references: Sequence[bytes], seed: int, steps: int) -> list[GeneratedWord]:
        self.load()
        assert self.tokenizer is not None and self.unet is not None and self.vae is not None and self.scheduler is not None and self.style_extractor is not None
        random.seed(seed)
        torch.manual_seed(seed)
        style_images = reference_tensor(references, self.transform, self.device)
        output: list[GeneratedWord] = []
        with torch.inference_mode():
            style_features = self.style_extractor(style_images).to(self.device)
            for start in range(0, len(texts), 4):
                batch = list(texts[start : start + 4])
                model_batch = [model_spelling(text) for text in batch]
                features = style_features.repeat(len(batch), 1)
                tokens = self.tokenizer(model_batch, padding="max_length", truncation=True, return_tensors="pt", max_length=40).to(self.device)
                latents = torch.randn((len(batch), 4, 8, 32), device=self.device)
                self.scheduler.set_timesteps(steps)
                labels = torch.zeros(len(batch), dtype=torch.long, device=self.device)
                for time_step in self.scheduler.timesteps:
                    times = torch.full((len(batch),), time_step.item(), device=self.device, dtype=torch.long)
                    residual = self.unet(latents, times, tokens, labels, style_extractor=features)
                    latents = self.scheduler.step(residual, time_step, latents).prev_sample
                decoded = self.vae.module.decode((1 / .18215) * latents).sample
                decoded = (decoded / 2 + .5).clamp(0, 1).cpu()
                for text, image in zip(batch, decoded):
                    rendered = transforms.ToPILImage()(image).convert("RGB")
                    output.append(GeneratedWord(text, restore_german_marks(rendered, text)))
        return output
