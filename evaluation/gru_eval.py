"""GRU engine: 5-seed evaluation vs LSTM, pooled baselines, the production heuristic
fallback (ML-vs-rules), and the Bayes-optimal ceiling; plus raw counterfactual dp on
the 16 seed templates. Session generator copied from train_gru_model.py (also returns
the latent conversion probability p, so the Bayes ceiling AUC(y, p) is exact)."""
import os, sys, json, random, time
import numpy as np
AI = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ai_engine"))
sys.path.insert(0, AI); os.chdir(AI)
import torch, torch.nn as nn
torch.set_num_threads(4)
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import roc_auc_score, f1_score, accuracy_score, brier_score_loss
import gru_features as gf
from gru_engine import EngagementGRU

OUT = sys.argv[1]
SEEDS = [0, 1, 2, 3, 4]

def sample_session(r):
    seq = ["Navbar", "Hero"]; body = ["Text", "Gallery", "CTA", "ContactForm", "Text", "Gallery"]; r.shuffle(body)
    seq += body[: r.randint(2, 6)]; seq += ["Footer"]
    bounce = r.random() < 0.35
    vis = seq[: r.randint(2, len(seq))] if bounce else seq
    ci = next((i for i, t in enumerate(vis) if t == "CTA"), None); ce = ci is not None and ci <= 3
    cc = (ci is not None) and (r.random() < (0.55 if ce else 0.3)); hf = "ContactForm" in vis
    fs = hf and r.random() < 0.5; fd = fs and r.random() < 0.6; ev = []; n = len(vis)
    for i, t in enumerate(vis):
        ev.append({"section_type": t, "t_spent": max(1, r.gauss(12 if t in ("Hero", "Text", "Gallery") else 6, 4)),
                   "scroll_depth": (i + 1) / n, "cta_click": 1 if (t == "CTA" and cc) else 0,
                   "form_start": 1 if (t in ("ContactForm", "DynamicForm") and fs) else 0,
                   "form_done": 1 if (t in ("ContactForm", "DynamicForm") and fd) else 0})
    p = 0.06
    if cc: p += 0.30
    if ce: p += 0.10
    if fs: p += 0.12
    if fd: p += 0.30
    if not bounce: p += 0.08
    p += min(0.10, 0.015 * n); p = max(0.01, min(0.97, p))
    return ev, (1.0 if r.random() < p else 0.0), p

def heuristic(ev):   # verbatim from gru_engine._predict_events fallback
    has_cta_early = any(e["section_type"] == "CTA" for e in ev[:3])
    has_form = any(e.get("form_start") for e in ev)
    p = 0.25 + (0.2 if has_cta_early else 0) + (0.15 if has_form else 0) + min(0.2, 0.03 * len(ev))
    return max(0.0, min(1.0, p))

def build(n, seed):
    r = random.Random(seed); X, L, Y, P, POOL, H = [], [], [], [], [], []
    for _ in range(n):
        ev, y, p = sample_session(r); s, l = gf.build_sequence(ev)
        X.append(s); L.append(l); Y.append(y); P.append(p); POOL.append(s[:l].mean(0)); H.append(heuristic(ev))
    return (np.array(X, np.float32), np.array(L), np.array(Y, np.float32), np.array(P),
            np.array(POOL), np.array(H))

class EngagementLSTM(nn.Module):
    def __init__(self, dim=gf.DIM):
        super().__init__()
        self.l1 = nn.LSTM(dim, 64, batch_first=True); self.l2 = nn.LSTM(64, 32, batch_first=True)
        self.head = nn.Sequential(nn.Linear(32, 32), nn.ReLU(), nn.Linear(32, 1), nn.Sigmoid())
    def forward(self, x, lengths):
        o1, _ = self.l1(x); o2, _ = self.l2(o1)
        idx = (lengths - 1).clamp(min=0)
        return self.head(o2[torch.arange(o2.size(0)), idx]).squeeze(-1)

def train_seq(model, X, L, Y, seed, epochs=14):   # identical to train_gru_model.py
    torch.manual_seed(seed)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3); lf = nn.BCELoss()
    Xt, Lt, Yt = torch.tensor(X), torch.tensor(L), torch.tensor(Y); n = len(Xt)
    model.train()
    for _ in range(epochs):
        perm = torch.randperm(n)
        for i in range(0, n, 128):
            idx = perm[i:i + 128]; opt.zero_grad(); lf(model(Xt[idx], Lt[idx]), Yt[idx]).backward(); opt.step()
    model.eval(); return model

def score(y, p):
    pr = (p >= 0.5).astype(int)
    return {"AUC": float(roc_auc_score(y, p)), "F1": float(f1_score(y, pr)),
            "Acc": float(accuracy_score(y, pr)), "Brier": float(brier_score_loss(y, p))}

def nparams(m): return int(sum(p.numel() for p in m.parameters()))

TEMPLATES = json.load(open(os.path.join(AI, "templates_seed.json")))

def p_of(model, types):
    s, l = gf.build_sequence(gf.synth_session_from_types(types))
    with torch.no_grad():
        return float(model(torch.tensor(s[None]), torch.tensor([l]))[0])

def counterfactuals(model):
    cta_d, best_d = [], []
    for t in TEMPLATES:
        types = [s["type"] for s in t["sections"]]; n = len(types); base = p_of(model, types)
        hi = next((i for i, x in enumerate(types) if x == "Hero"), None)
        ci = next((i for i, x in enumerate(types) if x == "CTA"), None)
        if hi is not None and ci is not None and ci > hi + 1:
            mv = list(types); it = mv.pop(ci); mv.insert(hi + 1, it); cta_d.append(p_of(model, mv) - base)
        best = -1.0
        for i in range(1, n - 1):            # never move Navbar (0) or Footer (n-1)
            for j in range(1, n - 1):
                if i == j: continue
                mv = list(types); it = mv.pop(i); mv.insert(j, it)
                best = max(best, p_of(model, mv) - base)
        best_d.append(best)
    return {"cta_move_dp_mean": float(np.mean(cta_d)) if cta_d else None, "cta_move_n": len(cta_d),
            "cta_move_frac_pos": float(np.mean(np.array(cta_d) > 0)) if cta_d else None,
            "best_move_dp_mean": float(np.mean(best_d)), "best_move_frac_pos": float(np.mean(np.array(best_d) > 0))}

res = json.load(open(OUT)) if os.path.exists(OUT) else {}
for s in SEEDS:
    if str(s) in res: continue
    Xtr, Ltr, Ytr, Ptr, POOLtr, _ = build(10000, 3000 + s)
    Xte, Lte, Yte, Pte, POOLte, Hte = build(4000, 4000 + s)
    out = {"pos_rate": float(Yte.mean()), "Bayes_ceiling": score(Yte, Pte), "Heuristic_rules": score(Yte, Hte)}
    g = train_seq(EngagementGRU(), Xtr, Ltr, Ytr, s)
    with torch.no_grad(): pg = g(torch.tensor(Xte), torch.tensor(Lte)).numpy()
    out["GRU"] = score(Yte, pg); out["GRU"]["params"] = nparams(g)
    x1, l1 = torch.tensor(Xte[:1]), torch.tensor(Lte[:1])
    for _ in range(20):
        with torch.no_grad(): g(x1, l1)
    ts = []
    for _ in range(300):
        t0 = time.perf_counter()
        with torch.no_grad(): g(x1, l1)
        ts.append((time.perf_counter() - t0) * 1000)
    out["GRU"]["lat_ms"] = float(np.median(ts))
    lstm = train_seq(EngagementLSTM(), Xtr, Ltr, Ytr, s)
    with torch.no_grad(): pl = lstm(torch.tensor(Xte), torch.tensor(Lte)).numpy()
    out["LSTM"] = score(Yte, pl); out["LSTM"]["params"] = nparams(lstm)
    lr = LogisticRegression(max_iter=2000).fit(POOLtr, Ytr)
    out["Logistic_pooled"] = score(Yte, lr.predict_proba(POOLte)[:, 1]); out["Logistic_pooled"]["params"] = POOLtr.shape[1] + 1
    ml = MLPClassifier(hidden_layer_sizes=(32,), max_iter=400, random_state=s).fit(POOLtr, Ytr)
    out["MLP_pooled"] = score(Yte, ml.predict_proba(POOLte)[:, 1])
    out["MLP_pooled"]["params"] = int(sum(c.size for c in ml.coefs_) + sum(c.size for c in ml.intercepts_))
    out["counterfactual_GRU"] = counterfactuals(g)
    res[str(s)] = out
    json.dump(res, open(OUT, "w"), indent=1)
    print("seed", s, {k: round(v["AUC"], 4) for k, v in out.items() if isinstance(v, dict) and "AUC" in v}, flush=True)
print("done")
