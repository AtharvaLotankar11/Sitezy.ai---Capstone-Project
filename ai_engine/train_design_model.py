"""
train_design_model.py — trains the design-flaw detector on the builder's own 16
templates (the "good design" class), augmented with small jitter.

Run:  python dump_templates.mjs   (regenerates templates_seed.json) then
      python train_design_model.py
Writes: design_ae.pt, design_if.pkl, design_norm.json
"""
import json
import os
import random

import numpy as np
import torch
import torch.nn as nn
import joblib
from sklearn.ensemble import IsolationForest

import design_features as dfeat
from design_engine import DesignAE

_DIR = os.path.dirname(os.path.abspath(__file__))
AUG_PER = 130          # ~16 * 130 = 2080 augmented samples
EPOCHS = 250
SEED = 7


def main():
    random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)

    seed = json.load(open(os.path.join(_DIR, "templates_seed.json")))
    base = []
    for tpl in seed:
        raw = dfeat.extract_raw({"sections": tpl["sections"]})
        base.append(dfeat.to_vector(raw))
    base = np.array(base, dtype=np.float32)
    print(f"[DESIGN] {len(base)} good template vectors (dim {base.shape[1]})")

    # augment: small gaussian jitter, clamped to [0,1]
    rows = [base]
    for _ in range(AUG_PER):
        noise = np.random.normal(0, 0.04, base.shape).astype(np.float32)
        rows.append(np.clip(base + noise, 0.0, 1.0))
    X = np.concatenate(rows, axis=0)
    np.random.shuffle(X)
    print(f"[DESIGN] training set: {len(X)} vectors")

    Xt = torch.tensor(X)
    ae = DesignAE()
    opt = torch.optim.Adam(ae.parameters(), lr=1e-3)
    loss_fn = nn.MSELoss()

    ae.train()
    for ep in range(EPOCHS):
        opt.zero_grad()
        recon = ae(Xt)
        loss = loss_fn(recon, Xt)
        loss.backward()
        opt.step()
        if (ep + 1) % 50 == 0 or ep == 0:
            print(f"   epoch {ep + 1:3d}/{EPOCHS}  MSE={loss.item():.5f}")

    # reconstruction-error distribution of the GOOD set → used as a z-score reference
    # so in-distribution designs score ~0 and only true outliers spike toward 1.
    ae.eval()
    with torch.no_grad():
        recon = ae(Xt)
        errs = ((Xt - recon) ** 2).sum(dim=1).numpy()
    ae_err_mean = float(np.mean(errs))
    ae_err_std = float(np.std(errs))
    ae_thr = float(np.percentile(errs, 95))

    # isolation forest on the same vectors
    iforest = IsolationForest(n_estimators=200, contamination=0.03, random_state=SEED)
    iforest.fit(X)
    d = iforest.decision_function(X)
    if_mean, if_std = float(np.mean(d)), float(np.std(d))

    torch.save(ae.state_dict(), os.path.join(_DIR, "design_ae.pt"))
    joblib.dump(iforest, os.path.join(_DIR, "design_if.pkl"))
    json.dump({"ae_thr": ae_thr, "ae_err_mean": ae_err_mean, "ae_err_std": ae_err_std,
               "if_mean": if_mean, "if_std": if_std, "feature_order": dfeat.FEATURE_ORDER_D},
              open(os.path.join(_DIR, "design_norm.json"), "w"), indent=2)
    print(f"[DESIGN] Saved. ae_err_mean={ae_err_mean:.5f} std={ae_err_std:.5f}  if_mean={if_mean:.4f} if_std={if_std:.4f}")


if __name__ == "__main__":
    main()
