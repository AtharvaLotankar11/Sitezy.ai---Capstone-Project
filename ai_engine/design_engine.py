"""
design_engine.py — design-flaw detector (autoencoder + isolation forest), lazy-loaded.

p_AE  = reconstruction error / training threshold      (autoencoder anomaly)
p_IF  = z-score of isolation-forest decision_function  (tree-based anomaly)
p_flaw = max(p_AE, p_IF)        ->  healthScore = (1 - p_flaw) * 100
If model files are missing, falls back to a heuristic based on flaw checks.
"""
import os
import json
import joblib
import torch
import torch.nn as nn

import design_features as df

_DIR = os.path.dirname(os.path.abspath(__file__))
_AE_PATH = os.path.join(_DIR, "design_ae.pt")
_IF_PATH = os.path.join(_DIR, "design_if.pkl")
_NORM_PATH = os.path.join(_DIR, "design_norm.json")

N_FEAT = len(df.FEATURE_ORDER_D)  # 20


class DesignAE(nn.Module):
    def __init__(self, n=N_FEAT):
        super().__init__()
        self.enc = nn.Sequential(
            nn.Linear(n, 14), nn.ReLU(), nn.Linear(14, 8), nn.ReLU(), nn.Linear(8, 4),
        )
        self.dec = nn.Sequential(
            nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 14), nn.ReLU(), nn.Linear(14, n), nn.Sigmoid(),
        )

    def forward(self, x):
        return self.dec(self.enc(x))


_ae = None
_iforest = None
_norm = None
_loaded = False


def _load():
    global _ae, _iforest, _norm, _loaded
    if _loaded:
        return
    _loaded = True
    try:
        if os.path.exists(_AE_PATH) and os.path.exists(_NORM_PATH):
            _ae = DesignAE()
            _ae.load_state_dict(torch.load(_AE_PATH, map_location="cpu"))
            _ae.eval()
            _norm = json.load(open(_NORM_PATH))
            if os.path.exists(_IF_PATH):
                _iforest = joblib.load(_IF_PATH)
            print("[DESIGN] Loaded autoencoder + isolation forest")
        else:
            print("[DESIGN] model files missing; using heuristic fallback")
    except Exception as e:  # pragma: no cover
        print(f"[DESIGN] load failed ({e}); using heuristic fallback")


# Penalty per detected flaw severity (rubric, like a design linter).
_SEV_PENALTY = {"high": 22, "medium": 11, "low": 5}


def analyze_page(content):
    _load()
    raw = df.extract_raw(content)
    vec = df.to_vector(raw)
    flaw_list = df.flaws(raw)

    # ── Score: a deterministic, explainable rubric (like a design linter). Real, varied
    # sites must NOT be punished merely for differing from the 16 seed templates — only
    # for concrete, detected flaws. ──
    rubric = 100 - sum(_SEV_PENALTY.get(f["severity"], 8) for f in flaw_list)
    health = max(0, min(100, round(rubric)))

    # ── The trained autoencoder + isolation forest provide an INFORMATIONAL anomaly
    # signal (how unusual the layout is vs. known-good designs). It does not penalize
    # the health score, so it can never produce a false-negative on a good site. ──
    anomaly = 0.0
    if _ae is not None and _norm is not None:
        with torch.no_grad():
            t = torch.tensor([vec], dtype=torch.float32)
            recon = _ae(t)
            err = float(((t - recon) ** 2).sum().item())
        ae_std = max(1e-6, _norm.get("ae_err_std", 0.05))
        ae_mean = _norm.get("ae_err_mean", 0.0)
        p_ae = max(0.0, min(1.0, (err - ae_mean) / (4 * ae_std)))
        p_if = 0.0
        if _iforest is not None:
            d = float(_iforest.decision_function([vec])[0])
            p_if = max(0.0, min(1.0, (_norm["if_mean"] - d) / (4 * max(1e-6, _norm["if_std"]))))
        anomaly = max(p_ae, p_if)

    return {
        "p_flaw": round((100 - health) / 100, 3),
        "healthScore": health,
        "flaws": flaw_list,
        "fixes": raw.get("_contrast_fixes", []),
        "anomaly": round(anomaly, 3),
        "model": "rubric+ae" if _ae is not None else "rubric",
    }
