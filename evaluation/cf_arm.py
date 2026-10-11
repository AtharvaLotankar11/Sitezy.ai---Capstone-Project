"""Counterfactual-optimisation arm. On every page of the 20 benchmark sites (deployed
configuration), apply the deployed engine's top one-click reorder suggestion
(gru_engine.suggest_from_sections) and compare against leaving the page as generated.
Reports the GRU's predicted conversion change (a prediction, not a measurement) and two
signals the GRU does not control: the design rubric (incl. the buried-CTA check) and the
SEO rubric. The anomaly detector is informational only and cannot change a page, so it
needs no arm. Numbers only."""
import os, sys, json, re, copy, glob
HERE = os.path.dirname(os.path.abspath(__file__))
SP = os.path.join(HERE, "out")                 # data produced by the earlier steps
sys.path.insert(0, HERE)
import rw_core as core                         # cwd -> ai_engine; imports seo_engine
import gru_engine, design_engine

def load_pages(fp):
    t = open(fp, encoding="utf-8").read()
    js = re.search(r"\{[\s\S]*\}", t).group(0)
    out = []
    for pg in json.loads(js).get("pages", []):
        secs = [s for s in (pg.get("sections") or []) if isinstance(s, dict)]
        for k, s in enumerate(secs): s.setdefault("id", f"s{k}"); s.setdefault("props", {})
        if secs: out.append({"title": pg.get("title", ""), "seo": {}, "sections": secs})
    return out

rows = []
for fp in sorted(glob.glob(os.path.join(SP, "decoding_results_raw", "*_D_both.txt")), key=lambda p: int(os.path.basename(p).split("_")[0])):
    biz = int(os.path.basename(fp).split("_")[0])
    for pi, page in enumerate(load_pages(fp)):
        S = page["sections"]; types = [s.get("type") for s in S]
        sug = gru_engine.suggest_from_sections(types)
        move = next((x for x in sug["suggestions"] if x.get("action") == "move"), None)
        d0 = design_engine.analyze_page({"sections": S}); kw = core.derive_keyword(S)
        r0 = core.score(page, S, kw)[2]
        rec = {"biz": biz, "page": pi, "n": len(S), "p0": sug["predictedConversion"], "health0": d0["healthScore"],
               "buried0": any(f["key"] == "buried_cta" for f in d0["flaws"]), "seo0": r0, "applied": bool(move)}
        if move:
            S1 = copy.deepcopy(S); it = S1.pop(move["from"]); S1.insert(move["to"], it)
            d1 = design_engine.analyze_page({"sections": S1}); r1 = core.score(page, S1, kw)[2]
            p1 = gru_engine.suggest_from_sections([s.get("type") for s in S1])["predictedConversion"]
            rec.update(kind=move["sectionType"], p1=p1, health1=d1["healthScore"],
                       buried1=any(f["key"] == "buried_cta" for f in d1["flaws"]), seo1=r1)
        rows.append(rec)
json.dump(rows, open(os.path.join(SP, "cf_arm_results.json"), "w"), indent=1)
A = [r for r in rows if r["applied"]]
import statistics as st
print(json.dumps({
    "pages": len(rows), "with_move": len(A), "kinds": {k: sum(r["kind"] == k for r in A) for k in {r["kind"] for r in A}},
    "pred_dp_mean": round(st.mean(r["p1"] - r["p0"] for r in A), 4) if A else None,
    "pred_dp_min": round(min(r["p1"] - r["p0"] for r in A), 4) if A else None,
    "health_before": round(st.mean(r["health0"] for r in A), 1) if A else None, "health_after": round(st.mean(r["health1"] for r in A), 1) if A else None,
    "health_improved": sum(r["health1"] > r["health0"] for r in A), "health_worse": sum(r["health1"] < r["health0"] for r in A),
    "buried_before": sum(r["buried0"] for r in A), "buried_after": sum(r["buried1"] for r in A),
    "buried_all_pages": sum(r["buried0"] for r in rows),
    "seo_change_mean": round(st.mean(r["seo1"] - r["seo0"] for r in A), 3) if A else None}, indent=1))
