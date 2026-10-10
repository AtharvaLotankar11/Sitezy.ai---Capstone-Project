"""Summarise the end-to-end ablation into table rows. All arms are judged with the rubric
(label function), so arms with different scorers are comparable. Time per site = median
generation latency (both independent runs pooled) + mean LLM time per site (rewriting, LLM
scoring, form repair); cost = API fees and/or GPU energy. Forms filled = DynamicForms with at
least three valid fields after the production form repair (form_repair_eval.mjs), except for the
'No form repair' row, which counts them before repair."""
import json, os, statistics
import numpy as np
from scipy import stats

HERE = os.path.dirname(os.path.abspath(__file__))
SP = os.path.join(HERE, "out")                 # data produced by the earlier steps
P_W, KWH = 60.0, 0.12
jl = lambda f: [json.loads(l) for l in open(os.path.join(SP, f), encoding="utf-8")]
dec = jl("decoding_results.jsonl") + jl("decoding_rep2.jsonl")
gem = [r for r in jl("gemini_results.jsonl") + jl("gemini_rep2.jsonl") if r.get("schema_ok")]
# cloud API cost per site at list price ($0.50 / $3.00 per million input / output+reasoning tokens)
CLOUD_PER_SITE = statistics.mean((r["prompt_tokens"] * 0.50 + (r["output_tokens"] + r["thinking_tokens"]) * 3.00) / 1e6 for r in gem)
gen_med = {"D": statistics.median(r["latency_s"] for r in dec if r["config"] == "D_both"),
           "C": statistics.median(r["latency_s"] for r in dec if r["config"] == "C_formatjson"),
           "G": statistics.median(r["latency_s"] for r in gem)}

def ci(v):
    v = np.array(v, float); h = stats.t.ppf(.975, len(v) - 1) * v.std(ddof=1) / np.sqrt(len(v))
    return v.mean(), h

def repair(fname, run=None):
    """(filled before, filled after, sites, mean repair seconds per site) from a form_repair_eval output"""
    R = [r for r in json.load(open(os.path.join(SP, fname))) if not r.get("invalid_generation") and (run is None or r["run"] == run)]
    return (sum(r["filled_before"] for r in R), sum(r["filled_after"] for r in R), len(R),
            sum(r["llmMs"] for r in R) / 1000 / len(R))

full = jl("rewrite_results.jsonl")
e2e = [r for r in jl("e2e_results.jsonl") if "error" not in r]
arm = lambda a: [r for r in e2e if r["arm"] == a]

def row(name, recs, before_key, after_key, llm_keys, gen, layout, forms, repair_s, cloud_gen=False):
    after = [r[after_key] for r in recs]; m, h = ci(after)
    regressed = sum(r[after_key] < r[before_key] - 1e-9 for r in recs)
    sites = {}
    for r in recs:
        b = r.get("biz", r.get("biz_idx")); sites[b] = sites.get(b, 0.0) + sum(r.get(k, 0.0) for k in llm_keys)
    llm = (statistics.mean(sites.values()) if llm_keys else 0.0) + repair_s
    t = gen_med[gen] + llm
    gpu_s = llm + (0 if cloud_gen else gen_med[gen])
    cost = 1000 * (P_W * gpu_s / 3600 / 1000 * KWH + (CLOUD_PER_SITE if cloud_gen else 0))
    return {"arm": name, "layout": layout, "forms": forms, "seo": (round(m, 1), round(h, 1)), "n": len(recs),
            "regressed": regressed, "time_s": round(t, 0), "cost_1k": round(cost, 2)}

fD = repair("form_repair_results.json", "decoding_results_raw")          # same 20 sites as the SEO arms
fC = repair("form_repair_C.json"); fG = repair("form_repair_gemini.json")
c_valid = sum(r["schema_ok"] for r in jl("decoding_results.jsonl") if r["config"] == "C_formatjson")
for r in full: r["biz"] = r["biz_idx"]
F = lambda f: f"{f[1]}/{f[2]}"
rows = [
    row("Full system (deployed)", full, "before_rubric", "after_meta_rubric", ["llm_time_s"], "D", "20/20", F(fD), fD[3]),
    row("Full system, independent re-run", arm("full_rerun"), "before_rubric", "after_rubric", ["llm_s"], "D", "20/20", F(fD), fD[3]),
    row("No form repair", full, "before_rubric", "after_meta_rubric", ["llm_time_s"], "D", "20/20", f"{fD[0]}/{fD[2]}", 0.0),
    row("Reasoning enabled", arm("reason_on"), "before_rubric", "after_rubric", ["llm_s"], "C", f"{c_valid}/20", F(fC), fC[3]),
    row("No acceptance gate", arm("no_gate"), "before_rubric", "after_rubric", ["llm_s"], "D", "20/20", F(fD), fD[3]),
    row("Rule scorer (no learned model)", arm("rubric_scorer"), "before_rubric", "after_rubric", ["llm_s"], "D", "20/20", F(fD), fD[3]),
    row("LLM scorer (Tier~2 instead of Tier~1)", arm("llm_scorer"), "before_rubric", "after_rubric", ["llm_s", "score_llm_s"], "D", "20/20", F(fD), fD[3]),
    row("No SEO loop", [dict(r, after_noloop=r["before_rubric"]) for r in full], "before_rubric", "after_noloop", [], "D", "20/20", F(fD), fD[3]),
    row("Cloud generation", arm("cloud_gen"), "before_rubric", "after_rubric", ["llm_s"], "G", "20/20", F(fG), fG[3], cloud_gen=True),
]

def paired(a_recs, a_key, b_recs, b_key):
    A = {(r.get("biz", r.get("biz_idx")), r.get("page", r.get("page_idx"))): r[a_key] for r in a_recs}
    B = {(r["biz"], r["page"]): r[b_key] for r in b_recs}
    k = sorted(set(A) & set(B)); d = np.array([B[x] - A[x] for x in k])
    m, h = ci(d); return {"n": len(k), "diff": round(m, 2), "ci": round(h, 2), "p": float(stats.ttest_rel([B[x] for x in k], [A[x] for x in k]).pvalue),
                          "identical": int((abs(d) < 1e-6).sum())}
for r in full: r["page"] = r["page_idx"]
extra = {"no_gate_accepted_lower": sum(r["acc_lower"] for r in arm("no_gate")),
         "no_gate_llm_calls": sum(r["acc"] + r["rej"] + r["empty"] for r in arm("no_gate")),
         "full_reached80_rubric": sum(r["after_meta_rubric"] >= 80 for r in full),
         "rerun_vs_full": paired(full, "after_meta_rubric", arm("full_rerun"), "after_rubric"),
         "llm_scorer_vs_full": paired(full, "after_meta_rubric", arm("llm_scorer"), "after_rubric"),
         "rubric_vs_full": paired(full, "after_meta_rubric", arm("rubric_scorer"), "after_rubric"),
         "llm_scorer_score_s_per_site": statistics.mean([sum(r.get("score_llm_s", 0) for r in arm("llm_scorer") if r["biz"] == b)
                                                         for b in {r["biz"] for r in arm("llm_scorer")}]) if arm("llm_scorer") else None,
         "forms": {"D": fD, "C": fC, "G": fG}, "cloud_per_1k": round(1000 * CLOUD_PER_SITE, 2)}
for a in ("full_rerun", "reason_on", "no_gate", "rubric_scorer", "llm_scorer", "cloud_gen"):
    extra[a + "_reached80_rubric"] = sum(r["after_rubric"] >= 80 for r in arm(a))
    extra[a + "_n"] = len(arm(a))
    extra[a + "_acc_rej"] = (sum(r["acc"] for r in arm(a)), sum(r["rej"] for r in arm(a)), sum(r["acc_lower"] for r in arm(a)))
print(json.dumps({"rows": rows, "extra": extra, "gen_median_s": gen_med}, indent=1))
tex = " \\\\\n".join(
    f"{r['arm']} & {r['layout']} & {r['forms']} & \\pmci{{{r['seo'][0]:.1f}}}{{{r['seo'][1]:.1f}}} & {r['regressed']}/{r['n']} & {r['time_s']:.0f} & {r['cost_1k']:.2f}"
    for r in rows)
open(os.path.join(SP, "ablation_rows.tex"), "w", encoding="utf-8").write(tex)
json.dump({"rows": rows, "extra": extra}, open(os.path.join(SP, "ablation_summary.json"), "w"), indent=1)
