"""SEO engine: 5-seed evaluation with stronger baselines and per-sample latency.
Data generation is copied from train_seo_model.py (sample_raw + expert_score + N(0,3)).
Train/test seeds are disjoint. Results appended per seed to seo_results.json."""
import os, sys, json, random, time
import numpy as np
AI = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ai_engine"))
sys.path.insert(0, AI); os.chdir(AI)
import torch, torch.nn as nn
torch.set_num_threads(4)
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import seo_features as sf
from seo_engine import SeoMLP

OUT = sys.argv[1]
SEEDS = [0, 1, 2, 3, 4]

def sample_raw(r):
    return {"title_length": r.randint(0, 90), "meta_desc_length": r.randint(0, 220),
        "keyword_density": round(r.uniform(0, 6), 3), "heading_hierarchy_valid": 1 if r.random() < 0.6 else 0,
        "flesch_kincaid": round(r.uniform(0, 20), 2), "image_alt_coverage": round(r.uniform(0, 1), 3),
        "internal_link_count": r.randint(0, 10), "external_link_count": r.randint(0, 8),
        "word_count": r.randint(20, 800), "h1_count": r.choice([0, 1, 1, 1, 2]), "h2_count": r.randint(0, 6),
        "avg_sentence_length": round(r.uniform(4, 35), 2), "keyword_in_title": 1 if r.random() < 0.5 else 0,
        "keyword_in_headings": 1 if r.random() < 0.5 else 0, "structured_data_present": 1 if r.random() < 0.3 else 0}

def data(n, seed):
    r = random.Random(seed); X, yc, yn = [], [], []
    for _ in range(n):
        nm = sf.normalize(sample_raw(r)); X.append(sf.to_vector(nm))
        c = max(0.0, min(100.0, sf.expert_score(nm))); yc.append(c)
        yn.append(max(0.0, min(100.0, c + r.gauss(0, 3))))
    return np.array(X, np.float32), np.array(yc, np.float32), np.array(yn, np.float32)

def train_mlp(X, y, seed, dropout, epochs, lr):
    torch.manual_seed(seed)
    m = SeoMLP()
    for mod in m.modules():
        if isinstance(mod, nn.Dropout): mod.p = dropout
    opt = torch.optim.Adam(m.parameters(), lr=lr); lf = nn.MSELoss()
    Xt, yt = torch.tensor(X), torch.tensor(y); n = len(Xt)
    m.train()
    for _ in range(epochs):
        perm = torch.randperm(n)
        for i in range(0, n, 256):
            idx = perm[i:i + 256]; opt.zero_grad(); lf(m(Xt[idx]), yt[idx]).backward(); opt.step()
    m.eval(); return m

def metrics(yc, yn, p):
    return {"R2_clean": float(r2_score(yc, p)), "MAE_clean": float(mean_absolute_error(yc, p)),
            "RMSE_clean": float(mean_squared_error(yc, p) ** 0.5), "R2_noisy": float(r2_score(yn, p))}

def lat_ms(fn, x1, reps=300):
    for _ in range(20): fn(x1)
    ts = []
    for _ in range(reps):
        t = time.perf_counter(); fn(x1); ts.append((time.perf_counter() - t) * 1000)
    return float(np.median(ts))

res = json.load(open(OUT)) if os.path.exists(OUT) else {}
for s in SEEDS:
    if str(s) in res: continue
    Xtr, yctr, yntr = data(20000, 1000 + s)
    Xte, ycte, ynte = data(5000, 2000 + s)
    out = {"noise_ceiling_R2_noisy": float(r2_score(ynte, ycte))}   # rubric itself vs noisy labels
    mlp = train_mlp(Xtr, yntr, s, dropout=0.05, epochs=900, lr=1.5e-3)
    with torch.no_grad(): p = mlp(torch.tensor(Xte)).numpy()
    out["MLP_tuned"] = metrics(ycte, ynte, p)
    x1 = torch.tensor(Xte[:1])
    def f_mlp(x):
        with torch.no_grad(): mlp(x)
    out["MLP_tuned"]["lat_ms"] = lat_ms(f_mlp, x1)
    mlp2 = train_mlp(Xtr, yntr, s, dropout=0.2, epochs=160, lr=1e-3)
    with torch.no_grad(): p = mlp2(torch.tensor(Xte)).numpy()
    out["MLP_shipped"] = metrics(ycte, ynte, p)
    lr_ = LinearRegression().fit(Xtr, yntr); out["Linear"] = metrics(ycte, ynte, lr_.predict(Xte))
    out["Linear"]["lat_ms"] = lat_ms(lr_.predict, Xte[:1])
    rf = RandomForestRegressor(n_estimators=200, n_jobs=4, random_state=s).fit(Xtr, yntr)
    out["RandomForest"] = metrics(ycte, ynte, rf.predict(Xte)); rf.set_params(n_jobs=1)
    out["RandomForest"]["lat_ms"] = lat_ms(rf.predict, Xte[:1], reps=100)
    hgb = HistGradientBoostingRegressor(max_iter=500, random_state=s).fit(Xtr, yntr)
    out["HistGBoost"] = metrics(ycte, ynte, hgb.predict(Xte))
    out["HistGBoost"]["lat_ms"] = lat_ms(hgb.predict, Xte[:1], reps=100)
    res[str(s)] = out
    json.dump(res, open(OUT, "w"), indent=1)
    print("seed", s, json.dumps({k: (v["R2_clean"] if isinstance(v, dict) else v) for k, v in out.items()}), flush=True)
print("done")
