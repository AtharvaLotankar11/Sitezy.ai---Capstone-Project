"""Summarise the gated SEO rewrite loop: per-stage scores (deployed MLP and rubric) with
95% CIs, pages changed per stage, gate decisions, and stage attribution."""
import json, sys, statistics
import numpy as np
from scipy import stats

R = [json.loads(l) for l in open(sys.argv[1], encoding="utf-8")]
R = [r for r in R if "error" not in r]
n = len(R)

def ci(v):
    v = np.array(v, float)
    h = stats.t.ppf(0.975, len(v) - 1) * v.std(ddof=1) / np.sqrt(len(v)) if len(v) > 1 else float("nan")
    return round(float(v.mean()), 1), round(float(h), 1)

stages = [("before", "before_rubric"), ("after_llm", "after_llm_rubric"),
          ("after_kw", "after_kw_rubric"), ("after_meta", "after_meta_rubric")]
out = {"pages": n, "below_threshold_80": sum(r["before"] < 80 for r in R)}
for s, rb in stages:
    out[s] = {"mlp": ci([r[s] for r in R]), "rubric": ci([r[rb] for r in R])}
out["changed_llm"] = sum(r["after_llm"] > r["before"] for r in R)
out["changed_kw"] = sum(bool(r.get("kw_net_applied")) for r in R)
out["changed_meta"] = sum(bool(r.get("meta_applied")) for r in R)
acc = sum(r["llm_accepted"] for r in R); rej = sum(r["llm_rejected"] for r in R)
rd = [d for r in R for d in r["rejected_deltas"]]
out["gate"] = {"accepted": acc, "rejected": rej, "empty_proposals": sum(r.get("llm_empty", 0) for r in R),
               "rejected_negative": sum(d < 0 for d in rd), "rejected_zero": sum(d == 0 for d in rd),
               "rejected_mean_delta": round(statistics.mean(rd), 2) if rd else None,
               "rejected_min_delta": round(min(rd), 2) if rd else None}
# stage attribution (mean gain in deployed-MLP score)
g = lambda a, b: ci([r[b] - r[a] for r in R])
out["gain"] = {"llm": g("before", "after_llm"), "kw": g("after_llm", "after_kw"),
               "meta": g("after_kw", "after_meta"), "total": g("before", "after_meta")}
out["gain_rubric"] = {"llm": ci([r["after_llm_rubric"] - r["before_rubric"] for r in R]),
                      "total": ci([r["after_meta_rubric"] - r["before_rubric"] for r in R])}
# disagreement: accepted LLM edits that the rubric scores lower
out["llm_accepted_but_rubric_down"] = sum(r["after_llm"] > r["before"] and r["after_llm_rubric"] < r["before_rubric"] for r in R)
out["any_stage_regression_mlp"] = sum(r["after_meta"] < r["before"] for r in R)
out["reached_threshold"] = {"before": sum(r["before"] >= 80 for r in R), "after": sum(r["after_meta"] >= 80 for r in R)}
calls = acc + rej + out["gate"]["empty_proposals"]
out["llm_time_per_call_s"] = round(sum(r["llm_time_s"] for r in R) / max(1, calls), 1)
out["llm_calls"] = calls
print(json.dumps(out, indent=1))
json.dump(out, open(sys.argv[2], "w"), indent=1)
