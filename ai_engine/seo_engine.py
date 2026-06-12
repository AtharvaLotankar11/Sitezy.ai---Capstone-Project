"""
seo_engine.py — PyTorch MLP SEO scorer (lazy-loaded).

Loads the trained MLP (seo_mlp.pt) on first use. If the model file is missing, falls
back to the deterministic expert weighting so the endpoint still works before training.
"""
import os
import json
import torch
import torch.nn as nn

import seo_features as sf

_DIR = os.path.dirname(os.path.abspath(__file__))
_MODEL_PATH = os.path.join(_DIR, "seo_mlp.pt")

N_FEATURES = len(sf.FEATURE_ORDER)


class SeoMLP(nn.Module):
    """15 normalized features → SEO score in [0,100]."""
    def __init__(self, n_in=N_FEATURES):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_in, 64), nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(64, 32), nn.ReLU(),
            nn.Linear(32, 1), nn.Sigmoid(),
        )

    def forward(self, x):
        return self.net(x).squeeze(-1) * 100.0


_model = None
_load_attempted = False


def _load():
    global _model, _load_attempted
    if _load_attempted:
        return _model
    _load_attempted = True
    if os.path.exists(_MODEL_PATH):
        try:
            m = SeoMLP()
            m.load_state_dict(torch.load(_MODEL_PATH, map_location="cpu"))
            m.eval()
            _model = m
            print("[SEO] Loaded trained MLP from seo_mlp.pt")
        except Exception as e:  # pragma: no cover
            print(f"[SEO] Failed to load seo_mlp.pt ({e}); using expert fallback")
            _model = None
    else:
        print("[SEO] seo_mlp.pt not found; using expert-weighting fallback")
    return _model


def score_page(content, keyword=""):
    raw = sf.extract_raw(content, keyword)
    norm = sf.normalize(raw)
    vec = sf.to_vector(norm)

    model = _load()
    if model is not None:
        with torch.no_grad():
            score = float(model(torch.tensor([vec], dtype=torch.float32))[0].item())
    else:
        score = float(sf.expert_score(norm))
    score = max(0.0, min(100.0, score))

    factors = sf.diagnostics(raw, norm)
    weakest = next((f["key"] for f in factors if f["status"] != "good"), None)
    return {
        "score": round(score, 1),
        "factors": factors,
        "weakest": weakest,
        "raw": {k: raw[k] for k in sf.FEATURE_ORDER},
        "model": "mlp" if model is not None else "expert-fallback",
    }
