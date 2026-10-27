"""Summarise the paired decoding ablation: Wilson CIs, exact McNemar tests, medians,
and the local-vs-cloud cost/speed figures used in the paper."""
import json, sys, math, statistics
from scipy.stats import binomtest

SP = sys.argv[1]
R = [json.loads(l) for l in open(f"{SP}/decoding_results.jsonl")]
G = [json.loads(l) for l in open(f"{SP}/gemini_results.jsonl")]
CFG = ["A_freeform", "B_thinkfalse", "C_formatjson", "D_both"]

def wilson(k, n, z=1.959964):
    if n == 0: return (float("nan"), float("nan"))
    p = k / n; d = 1 + z * z / n; c = (p + z * z / (2 * n)) / d; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (100 * (c - h), 100 * (c + h))

by = {c: {r["biz_idx"]: r for r in R if r["config"] == c} for c in CFG}
common = sorted(set.intersection(*(set(by[c]) for c in CFG)))
out = {"n_paired": len(common)}
for c in CFG:
    rows = [by[c][i] for i in common]
    k = sum(r["schema_ok"] for r in rows); n = len(rows)
    lo, hi = wilson(k, n)
    out[c] = {"valid": k, "n": n, "wilson": (round(lo, 1), round(hi, 1)),
              "trunc": sum(r.get("done_reason") == "length" for r in rows),
              "lat_med": round(statistics.median(r["latency_s"] for r in rows), 1),
              "out_tok_med": int(statistics.median(r.get("output_tokens") or 0 for r in rows)),
              "in_tok_med": int(statistics.median(r.get("prompt_tokens") or 0 for r in rows)),
              "parse_ok": sum(r["parse_ok"] for r in rows)}

def mcnemar(a, b):
    x = sum(by[a][i]["schema_ok"] and not by[b][i]["schema_ok"] for i in common)
    y = sum(by[b][i]["schema_ok"] and not by[a][i]["schema_ok"] for i in common)
    p = binomtest(min(x, y), x + y, 0.5).pvalue if x + y else 1.0
    return {"a_only": x, "b_only": y, "p": p}
out["mcnemar"] = {f"{a}_vs_{b}": mcnemar(a, b) for a, b in
                  [("D_both", "A_freeform"), ("D_both", "C_formatjson"), ("B_thinkfalse", "A_freeform"),
                   ("D_both", "B_thinkfalse"), ("C_formatjson", "A_freeform")]}

# local vs cloud on the same prompts (deployed config)
d = out["D_both"]; g_lat = statistics.median(r["latency_s"] for r in G)
out["cloud_lat_med"] = round(g_lat, 1)
out["speed_ratio"] = round(d["lat_med"] / g_lat, 1)
P_W, PRICE_KWH = 60.0, 0.12
e_site = P_W * d["lat_med"] / 3600 / 1000 * PRICE_KWH          # $ per site (GPU energy only)
g_cost = statistics.mean((r["prompt_tokens"] * 0.50 + (r["output_tokens"] + r["thinking_tokens"]) * 3.00) / 1e6 for r in G)
out["local_energy_per_1k"] = round(1000 * e_site, 2)
out["cloud_api_per_1k"] = round(1000 * g_cost, 2)
out["local_share_of_cloud_pct"] = round(100 * e_site / g_cost, 1)
out["local_wh_per_site"] = round(P_W * d["lat_med"] / 3600, 2)
print(json.dumps(out, indent=1))
json.dump(out, open(f"{SP}/decoding_summary.json", "w"), indent=1)
