"""
train_seo_model.py — trains the PyTorch SEO MLP on a SYNTHETIC dataset.

No external corpus is required. We sample realistic raw feature values, push them
through the SAME normalization used at inference (seo_features.normalize), and label
each sample with the documented expert weighting + small Gaussian noise. The MLP then
learns to approximate that scoring surface — a genuine trained neural regressor that
stays consistent with the live feature extractor.

Run:  python train_seo_model.py
Writes: seo_mlp.pt, seo_norm.json
"""
import json
import os
import random

import numpy as np
import torch
import torch.nn as nn

import seo_features as sf
from seo_engine import SeoMLP

_DIR = os.path.dirname(os.path.abspath(__file__))
N_SAMPLES = 20000
EPOCHS = 160
BATCH = 256
SEED = 42


def sample_raw():
    return {
        "title_length": random.randint(0, 90),
        "meta_desc_length": random.randint(0, 220),
        "keyword_density": round(random.uniform(0, 6), 3),
        "heading_hierarchy_valid": 1 if random.random() < 0.6 else 0,
        "flesch_kincaid": round(random.uniform(0, 20), 2),
        "image_alt_coverage": round(random.uniform(0, 1), 3),
        "internal_link_count": random.randint(0, 10),
        "external_link_count": random.randint(0, 8),
        "word_count": random.randint(20, 800),
        "h1_count": random.choice([0, 1, 1, 1, 2]),
        "h2_count": random.randint(0, 6),
        "avg_sentence_length": round(random.uniform(4, 35), 2),
        "keyword_in_title": 1 if random.random() < 0.5 else 0,
        "keyword_in_headings": 1 if random.random() < 0.5 else 0,
        "structured_data_present": 1 if random.random() < 0.3 else 0,
    }


def build_dataset(n):
    X, y = [], []
    for _ in range(n):
        raw = sample_raw()
        norm = sf.normalize(raw)
        X.append(sf.to_vector(norm))
        score = sf.expert_score(norm) + random.gauss(0, 3)
        y.append(max(0.0, min(100.0, score)))
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)


def main():
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)

    print(f"[SEO] Generating {N_SAMPLES} synthetic samples...")
    X, y = build_dataset(N_SAMPLES)
    Xt = torch.tensor(X)
    yt = torch.tensor(y)

    model = SeoMLP()
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = nn.MSELoss()
    n = len(Xt)

    print(f"[SEO] Training MLP for {EPOCHS} epochs...")
    model.train()
    for ep in range(EPOCHS):
        perm = torch.randperm(n)
        total = 0.0
        for i in range(0, n, BATCH):
            idx = perm[i:i + BATCH]
            opt.zero_grad()
            pred = model(Xt[idx])
            loss = loss_fn(pred, yt[idx])
            loss.backward()
            opt.step()
            total += loss.item() * len(idx)
        if (ep + 1) % 40 == 0 or ep == 0:
            rmse = (total / n) ** 0.5
            print(f"   epoch {ep + 1:3d}/{EPOCHS}  RMSE={rmse:.3f}")

    torch.save(model.state_dict(), os.path.join(_DIR, "seo_mlp.pt"))
    with open(os.path.join(_DIR, "seo_norm.json"), "w") as f:
        json.dump({"feature_order": sf.FEATURE_ORDER, "weights": sf.WEIGHTS, "trained": True}, f, indent=2)

    # quick sanity check
    model.eval()
    with torch.no_grad():
        good = sf.normalize(sample_raw())
        for k in good:
            good[k] = 1.0
        bad = {k: 0.0 for k in sf.FEATURE_ORDER}
        gs = model(torch.tensor([sf.to_vector(good)], dtype=torch.float32)).item()
        bs = model(torch.tensor([[bad[k] for k in sf.FEATURE_ORDER]], dtype=torch.float32)).item()
    print(f"[SEO] Saved seo_mlp.pt  |  ideal page~{gs:.1f}  empty page~{bs:.1f}")


if __name__ == "__main__":
    main()
