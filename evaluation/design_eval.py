"""Design auditor: 5-seed evaluation with SECTION-LEVEL flaw injection into the 16 real
seed templates. Known (rubric-catalogued) categories + out-of-catalogue anomalies.
Template-disjoint split: even templates = validation (threshold selection), odd = test.
AE+IF retrained per seed exactly as train_design_model.py. Rubric = design_features.flaws
with design_engine severity penalties (ML-vs-rules ablation)."""
import os, sys, json, copy, time
import numpy as np
AI = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ai_engine"))
sys.path.insert(0, AI); os.chdir(AI)
import torch, torch.nn as nn
torch.set_num_threads(4)
from sklearn.ensemble import IsolationForest
from sklearn.metrics import roc_auc_score, f1_score, precision_score, recall_score
import design_features as dfeat
from design_engine import DesignAE, _SEV_PENALTY

OUT = sys.argv[1]
SEEDS = [0, 1, 2, 3, 4]
T = json.load(open(os.path.join(AI, "templates_seed.json")))
SEV = {"no_h1": "high", "multi_h1": "medium", "no_h2": "medium", "no_footer": "low", "cta_buried": "medium",
       "too_many_fonts": "low", "dup_headings": "low", "empty_sections": "medium",
       "structure_order": "low", "missing_alt": "medium"}

def secs(t): return copy.deepcopy(t["sections"])
def P(s): s.setdefault("props", {}); return s["props"]

# ---------- known (rubric-catalogued) flaw injections ----------
def no_h1(S):
    for s in S:
        if s["type"] == "Hero": P(s)["heading"] = ""
    return S
def multi_h1(S):
    i = next(i for i, s in enumerate(S) if s["type"] == "Hero"); S.insert(i + 1, copy.deepcopy(S[i])); return S
def no_h2(S):
    for s in S:
        if s["type"] in ("Text", "CTA", "Gallery", "ContactForm", "DynamicForm"): P(s)["heading"] = ""
    return S
def no_footer(S): return [s for s in S if s["type"] != "Footer"]
def cta_buried(S):
    keep = [s for s in S if s["type"] not in ("Hero", "CTA", "Footer")]
    mv = [s for s in S if s["type"] in ("Hero", "CTA")]; ft = [s for s in S if s["type"] == "Footer"]
    return keep + mv + ft
def too_many_fonts(S):
    F = ["Inter", "Playfair Display", "Roboto Mono", "Lobster"]
    for k, s in enumerate(S): P(s)["fontFamily"] = F[k % 4]
    return S
def dup_headings(S):
    for s in S:
        if (P(s).get("heading") or "").strip(): P(s)["heading"] = "Welcome to our world"
    return S
def empty_sections(S):
    c = [s for s in S if s["type"] in ("Text", "Gallery", "CTA")][:2]
    for s in c:
        for k in ("heading", "subheading", "description", "text", "ctaText"): P(s)[k] = ""
        if s["type"] == "Gallery": P(s)["items"] = []
    return S
def structure_order(S): return [s for s in S if s["type"] != "Navbar"]
def missing_alt(S):
    hit = False
    for s in S:
        if s["type"] == "Gallery":
            for it in (P(s).get("items") or []):
                if isinstance(it, dict) and (it.get("image") or it.get("imageQuery")): it["title"] = ""; hit = True
    return S if hit else None
KNOWN = {f.__name__: f for f in [no_h1, multi_h1, no_h2, no_footer, cta_buried, too_many_fonts,
                                 dup_headings, empty_sections, structure_order, missing_alt]}

# ---------- out-of-catalogue anomalies (no rubric rule targets them) ----------
def section_bloat(S):
    body = [s for s in S if s["type"] in ("Text", "Gallery")]; ft = S[-1]; S = S[:-1]; k = 0
    while len(S) < 11:
        c = copy.deepcopy(body[k % len(body)]); P(c)["heading"] = f"Extra section {k}"; S.append(c); k += 1
    return S + [ft]
def color_chaos(S):
    C = ["#e11d48", "#16a34a", "#2563eb", "#ca8a04", "#9333ea", "#0891b2"]
    for k, s in enumerate(S): P(s)["bgColor"] = C[k % 6]
    return S
def wall_of_text(S):
    for s in S:
        if s["type"] in ("Text", "Hero"): P(s)["description"] = ("Lorem ipsum dolor sit amet. " * 60).strip()
    return S
def gallery_overload(S):
    g = next(s for s in S if s["type"] == "Gallery"); out = []
    for s in S:
        out.append(copy.deepcopy(g) if s["type"] == "Text" else s)
    ft = out.pop(); out += [copy.deepcopy(g), copy.deepcopy(g), ft]
    for k, s in enumerate(x for x in out if x["type"] == "Gallery"): P(s)["heading"] = f"Showcase {k}"
    return out
def sparse_page(S): return [s for s in S if s["type"] in ("Navbar", "Hero", "CTA", "Footer")]
OOC = {f.__name__: f for f in [section_bloat, color_chaos, wall_of_text, gallery_overload, sparse_page]}

def rubric(raw):
    fl = dfeat.flaws(raw); return sum(_SEV_PENALTY.get(f["severity"], 8) for f in fl), [f["key"] for f in fl]

def train(seed):
    rng = np.random.default_rng(seed); torch.manual_seed(seed)
    base = np.array([dfeat.to_vector(dfeat.extract_raw({"sections": t["sections"]})) for t in T], np.float32)
    rows = [base] + [np.clip(base + rng.normal(0, 0.04, base.shape).astype(np.float32), 0, 1) for _ in range(130)]
    X = np.concatenate(rows); rng.shuffle(X); Xt = torch.tensor(X)
    ae = DesignAE(); opt = torch.optim.Adam(ae.parameters(), lr=1e-3); lf = nn.MSELoss()
    ae.train()
    for _ in range(250):
        opt.zero_grad(); lf(ae(Xt), Xt).backward(); opt.step()
    ae.eval()
    with torch.no_grad(): err = ((Xt - ae(Xt)) ** 2).sum(1).numpy()
    iforest = IsolationForest(n_estimators=200, contamination=0.03, random_state=seed).fit(X)
    d = iforest.decision_function(X)
    return ae, iforest, dict(ae_m=float(err.mean()), ae_s=float(err.std()), if_m=float(d.mean()), if_s=float(d.std()))

def ml_scores(ae, iforest, nrm, V):
    with torch.no_grad():
        Vt = torch.tensor(V, dtype=torch.float32); err = ((Vt - ae(Vt)) ** 2).sum(1).numpy()
    z_ae = (err - nrm["ae_m"]) / (4 * max(1e-6, nrm["ae_s"]))
    z_if = (nrm["if_m"] - iforest.decision_function(V)) / (4 * max(1e-6, nrm["if_s"]))
    return z_ae, z_if, np.maximum(z_ae, z_if)

res = json.load(open(OUT)) if os.path.exists(OUT) else {}
for seed in SEEDS:
    if str(seed) in res: continue
    ae, iforest, nrm = train(seed)
    rng = np.random.default_rng(5000 + seed)
    recs = []   # (template_idx, group, category, severity, vector, rubric_pen, rubric_keys)
    for ti, t in enumerate(T):
        raw0 = dfeat.extract_raw({"sections": t["sections"]}); v0 = np.array(dfeat.to_vector(raw0), np.float32)
        for _ in range(20):
            recs.append((ti, "clean", "clean", "none", np.clip(v0 + rng.normal(0, 0.04, v0.shape), 0, 1), *rubric(raw0)))
        for grp, cats in (("known", KNOWN), ("ooc", OOC)):
            for name, fn in cats.items():
                S = fn(secs(t))
                if S is None: continue
                raw = dfeat.extract_raw({"sections": S}); v = np.array(dfeat.to_vector(raw), np.float32)
                for _ in range(2):
                    recs.append((ti, grp, name, SEV.get(name, "ooc"), np.clip(v + rng.normal(0, 0.04, v.shape), 0, 1), *rubric(raw)))
    V = np.array([r[4] for r in recs], np.float32)
    z_ae, z_if, z_ml = ml_scores(ae, iforest, nrm, V)
    ti = np.array([r[0] for r in recs]); grp = np.array([r[1] for r in recs]); cat = np.array([r[2] for r in recs])
    sev = np.array([r[3] for r in recs]); rpen = np.array([r[5] for r in recs], float)
    y = (grp != "clean").astype(int); val = (ti % 2 == 0); test = ~val
    out = {"counts_test": {g: int(((grp == g) & test).sum()) for g in ("clean", "known", "ooc")}}
    for scope in ("known", "ooc", "all"):
        m = test & ((grp == "clean") | (grp == scope) if scope != "all" else np.ones_like(test))
        mv = val & ((grp == "clean") | (grp == scope) if scope != "all" else np.ones_like(val))
        d = {}
        for nm, sc in (("AE", z_ae), ("IF", z_if), ("AE+IF", z_ml), ("Rubric", rpen)):
            d[nm] = {"AUC": float(roc_auc_score(y[m], sc[m]))}
            # threshold chosen on VALIDATION templates, applied to TEST templates
            cand = np.unique(sc[mv]); best = (-1, None)
            for th in cand:
                f = f1_score(y[mv], (sc[mv] >= th).astype(int), zero_division=0)
                if f > best[0]: best = (f, th)
            pr = (sc[m] >= best[1]).astype(int)
            d[nm].update(F1=float(f1_score(y[m], pr, zero_division=0)),
                         P=float(precision_score(y[m], pr, zero_division=0)),
                         R=float(recall_score(y[m], pr, zero_division=0)), thr=float(best[1]))
        out[scope] = d
    # per-category recall on test at the validation-chosen 'all' thresholds
    thr_ml, thr_rb = out["all"]["AE+IF"]["thr"], 0.0
    # deployed decision rules: rubric flags a page iff it finds >=1 flaw (pen > 0);
    # ML flags iff z >= validation threshold; union = either.
    rules = {"Rubric_rule": rpen > 0, "AE+IF_rule": z_ml >= thr_ml, "Union_rule": (rpen > 0) | (z_ml >= thr_ml)}
    for scope in ("known", "ooc", "all"):
        m = test & ((grp == "clean") | (grp == scope) if scope != "all" else np.ones_like(test))
        out[scope + "_rules"] = {nm: {"P": float(precision_score(y[m], pr[m].astype(int), zero_division=0)),
                                      "R": float(recall_score(y[m], pr[m].astype(int), zero_division=0)),
                                      "F1": float(f1_score(y[m], pr[m].astype(int), zero_division=0))}
                                 for nm, pr in rules.items()}
    per = {}
    for c in sorted(set(cat[grp != "clean"])):
        mm = test & (cat == c)
        if mm.sum() == 0: continue
        per[c] = {"group": str(grp[mm][0]), "severity": str(sev[mm][0]), "n": int(mm.sum()),
                  "recall_AE+IF": float((z_ml[mm] >= thr_ml).mean()), "recall_Rubric": float((rpen[mm] > thr_rb).mean())}
    out["per_category"] = per
    out["clean_FPR_test"] = {"AE+IF": float((z_ml[test & (grp == "clean")] >= thr_ml).mean()),
                             "Rubric": float((rpen[test & (grp == "clean")] > 0).mean())}
    # per-sample latency of the deployed scoring path
    v1 = V[:1]; [ml_scores(ae, iforest, nrm, v1) for _ in range(20)]; ts = []
    for _ in range(300):
        t0 = time.perf_counter(); ml_scores(ae, iforest, nrm, v1); ts.append((time.perf_counter() - t0) * 1000)
    out["lat_ms"] = float(np.median(ts))
    res[str(seed)] = out
    json.dump(res, open(OUT, "w"), indent=1)
    print("seed", seed, {s: {k: round(v["AUC"], 3) for k, v in out[s].items()} for s in ("known", "ooc")}, flush=True)
print("done")
