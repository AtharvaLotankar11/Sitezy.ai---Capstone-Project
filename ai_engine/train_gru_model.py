"""
train_gru_model.py — trains the engagement GRU on SYNTHETIC bootstrap sessions.

No real traffic is required for v1. We sample plausible visitor sessions (orderings
drawn from the templates, dwell/scroll distributions, CTA clicks, form funnels) and set
a latent conversion probability that rises with: CTA seen early, form started->done,
healthy dwell, and reasonable scroll depth. The GRU learns this surface and is later
retrained on real sessions collected by the published-site tracker.

Run:  python train_gru_model.py
Writes: gru.pt, gru_norm.json
"""
import json
import os
import random

import numpy as np
import torch
import torch.nn as nn

import gru_features as gf
from gru_engine import EngagementGRU

_DIR = os.path.dirname(os.path.abspath(__file__))
N_SESSIONS = 10000
EPOCHS = 14
BATCH = 128
SEED = 11

CONTENT_TYPES = ["Hero", "Text", "Gallery", "CTA", "ContactForm", "Navbar", "Footer"]


def sample_session():
    # draw an ordering loosely resembling real pages
    seq = ["Navbar", "Hero"]
    body_pool = ["Text", "Gallery", "CTA", "ContactForm", "Text", "Gallery"]
    random.shuffle(body_pool)
    seq += body_pool[: random.randint(2, 6)]
    seq += ["Footer"]

    bounce = random.random() < 0.35           # bouncers drop early
    visible = seq[: random.randint(2, len(seq))] if bounce else seq

    cta_idx = next((i for i, t in enumerate(visible) if t == "CTA"), None)
    cta_early = cta_idx is not None and cta_idx <= 3
    cta_click = (cta_idx is not None) and (random.random() < (0.55 if cta_early else 0.3))
    has_form = "ContactForm" in visible
    form_start = has_form and random.random() < 0.5
    form_done = form_start and random.random() < 0.6

    events = []
    n = len(visible)
    for i, t in enumerate(visible):
        events.append({
            "section_type": t,
            "t_spent": max(1, random.gauss(12 if t in ("Hero", "Text", "Gallery") else 6, 4)),
            "scroll_depth": (i + 1) / n,
            "cta_click": 1 if (t == "CTA" and cta_click) else 0,
            "form_start": 1 if (t in ("ContactForm", "DynamicForm") and form_start) else 0,
            "form_done": 1 if (t in ("ContactForm", "DynamicForm") and form_done) else 0,
        })

    # latent conversion probability
    p = 0.06
    if cta_click: p += 0.30
    if cta_early: p += 0.10
    if form_start: p += 0.12
    if form_done: p += 0.30
    if not bounce: p += 0.08
    p += min(0.10, 0.015 * n)
    p = max(0.01, min(0.97, p))
    y = 1.0 if random.random() < p else 0.0
    return events, y


def main():
    random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)

    print(f"[GRU] Generating {N_SESSIONS} synthetic sessions...")
    X, L, Y = [], [], []
    for _ in range(N_SESSIONS):
        events, y = sample_session()
        seq, length = gf.build_sequence(events)
        X.append(seq); L.append(length); Y.append(y)
    Xt = torch.tensor(np.array(X), dtype=torch.float32)
    Lt = torch.tensor(np.array(L), dtype=torch.long)
    Yt = torch.tensor(np.array(Y), dtype=torch.float32)

    model = EngagementGRU()
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = nn.BCELoss()
    n = len(Xt)

    print(f"[GRU] Training for {EPOCHS} epochs...")
    model.train()
    for ep in range(EPOCHS):
        perm = torch.randperm(n)
        total = 0.0
        for i in range(0, n, BATCH):
            idx = perm[i:i + BATCH]
            opt.zero_grad()
            pred = model(Xt[idx], Lt[idx])
            loss = loss_fn(pred, Yt[idx])
            loss.backward()
            opt.step()
            total += loss.item() * len(idx)
        if (ep + 1) % 3 == 0 or ep == 0:
            print(f"   epoch {ep + 1:2d}/{EPOCHS}  BCE={total / n:.4f}")

    torch.save(model.state_dict(), os.path.join(_DIR, "gru.pt"))
    json.dump({"t_max": gf.T_MAX, "dim": gf.DIM, "trained": True},
              open(os.path.join(_DIR, "gru_norm.json"), "w"), indent=2)
    print(f"[GRU] Saved gru.pt  (mean label={Yt.mean().item():.3f})")


if __name__ == "__main__":
    main()
