"""Evaluate the deployed Tier-1 engines on REAL published tenant pages, read from stdin
(piped from fetch_real_pages.mjs). Only numeric metrics and generic flaw codes are written;
no page content is stored. Mode 'static' (CPU) or 'loop' (gated SEO loop, local LLM)."""
import os, sys, json, copy, time
HERE = os.path.dirname(os.path.abspath(__file__))
SP = os.path.join(HERE, "out")                 # data produced by the earlier steps
sys.path.insert(0, HERE)
import rw_core as core                       # cwd -> ai_engine
import numpy as np, torch
import seo_features as sf, design_engine, gru_features as gf
from gru_engine import EngagementGRU

mode = sys.argv[1]
OUT = os.path.join(SP, f"real_sites_{mode}.jsonl")
DEADLINE = time.time() + float(sys.argv[2] if len(sys.argv) > 2 else 1500)
pages = json.loads(sys.stdin.read())
done = set()
if os.path.exists(OUT):
    done = {json.loads(l)["id"] for l in open(OUT, encoding="utf-8")}

gru = EngagementGRU(); gru.load_state_dict(torch.load(os.path.join(core.AI, "gru.pt"), map_location="cpu")); gru.eval()
def p_conv(types):
    s, l = gf.build_sequence(gf.synth_session_from_types(types))
    with torch.no_grad():
        return float(gru(torch.tensor(s[None]), torch.tensor([l]))[0])
def best_move(types):
    base, best, n = p_conv(types), -1.0, len(types)
    for i in range(1, n - 1):
        for j in range(1, n - 1):
            if i == j: continue
            mv = list(types); it = mv.pop(i); mv.insert(j, it); best = max(best, p_conv(mv) - base)
    return base, best

for pg in pages:
    if pg["id"] in done: continue
    if time.time() > DEADLINE: print("deadline; resume later", flush=True); sys.exit(0)
    secs = [s for s in pg["sections"] if isinstance(s, dict)]
    for k, s in enumerate(secs): s.setdefault("id", f"s{k}"); s.setdefault("props", s.get("props") or {})
    page = {"title": pg["title"], "seo": pg["seo"], "sections": secs}
    rec = {"id": pg["id"], "site": pg["site"], "home": pg["home"], "n_sections": len(secs)}
    try:
        if mode == "static":
            kw = core.derive_keyword(secs)
            s, f, r = core.score(page, secs, kw)
            d = design_engine.analyze_page({"sections": secs})
            types = [x.get("type") for x in secs]
            rec.update(seo_mlp=s, seo_rubric=r, health=d["healthScore"], anomaly=d["anomaly"],
                       flaws=[x["key"] for x in d["flaws"]],
                       has_cta=("CTA" in types), has_form=any(t in ("ContactForm", "DynamicForm") for t in types))
            if len(types) >= 3:
                p0, dp = best_move(types); rec.update(p_conv=p0, best_dp=dp)
            for t in ("DynamicForm", "ContactForm"):
                fs = [x for x in secs if x.get("type") == t]
                if fs:
                    pr = fs[0].get("props") or {}
                    fl = pr.get("dynamicFields") or pr.get("fields")
                    rec[t + "_fields"] = len(fl) if isinstance(fl, list) else 0
        else:
            rec.update(core.auto_improve(page))
            rec.pop("keyword", None)              # derived from page text: not stored
    except Exception as e:
        rec["error"] = str(e)[:160]
    open(OUT, "a", encoding="utf-8").write(json.dumps(rec) + "\n")
print("done", mode, flush=True)
