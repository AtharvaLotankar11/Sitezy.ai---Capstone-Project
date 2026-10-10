"""Clean per-request latency of the DEPLOYED Tier-1 artifacts (median and p90 over warm
runs, single process). Recommender measured as deployed (sequential NLI passes) and with
the 43 premise-hypothesis pairs batched into one forward pass."""
import os, sys, json, time, random
import numpy as np
AI = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ai_engine"))
sys.path.insert(0, AI); os.chdir(AI)
import torch, joblib, pandas as pd
import seo_engine, gru_engine, design_engine, seo_features as sf, gru_features as gf, design_features as dfeat

def bench(fn, reps):
    for _ in range(min(20, reps)): fn()
    ts = []
    for _ in range(reps):
        t0 = time.perf_counter(); fn(); ts.append((time.perf_counter() - t0) * 1000)
    return {"median_ms": float(np.median(ts)), "p90_ms": float(np.percentile(ts, 90)), "n": reps}

out = {"torch_threads": torch.get_num_threads(), "cpu": os.environ.get("PROCESSOR_IDENTIFIER", "")}
T = json.load(open("templates_seed.json"))
content = {"title": "Artisan coffee", "metaDescription": "", "structuredData": None, "sections": T[0]["sections"]}
# full deployed request paths (feature extraction + model), not just the forward pass
out["seo_score_page"] = bench(lambda: seo_engine.score_page(content, "coffee"), 500)
out["design_analyze_page"] = bench(lambda: design_engine.analyze_page({"sections": T[0]["sections"]}), 500)
types = [s["type"] for s in T[0]["sections"]]
out["gru_suggest_from_sections"] = bench(lambda: gru_engine.suggest_from_sections(types), 200)

from transformers import AutoTokenizer, AutoModelForSequenceClassification
name = "cross-encoder/nli-MiniLM2-L6-H768"
tok = AutoTokenizer.from_pretrained(name); nli = AutoModelForSequenceClassification.from_pretrained(name).eval()
L = [["ecommerce","blog","portfolio","startup","education","restaurant","healthcare","real_estate","saas","event","nonprofit","news","personal_brand"],
     ["products","articles","services","courses","gallery","menu","booking","portfolio_items","events","news_updates","downloads"],
     ["sales","lead_generation","branding","education","booking","awareness","portfolio_showcase","community_building","content_delivery"],
     ["general_public","students","business_clients","recruiters","investors","patients","local_customers","online_shoppers","members","developers"]]
prompt = "Italian restaurant with wood-fired pizza and reservations"
def seq():
    for labels in L:
        for lb in labels:
            inp = tok(prompt, f"This website is about {lb}", return_tensors="pt", truncation=True)
            with torch.no_grad(): nli(**inp)
def batched():
    hyps = [f"This website is about {lb}" for labels in L for lb in labels]
    inp = tok([prompt] * len(hyps), hyps, return_tensors="pt", truncation=True, padding=True)
    with torch.no_grad(): nli(**inp)
out["zeroshot_sequential_43_pairs"] = bench(seq, 15)
out["zeroshot_batched_43_pairs"] = bench(batched, 30)
rf = joblib.load("layout_model.pkl"); enc = joblib.load("label_encoders.pkl")
row = pd.DataFrame([[enc[i].transform([v])[0] for i, v in enumerate(["restaurant", "menu", "booking", "local_customers", "beginner"])]],
                   columns=["business_type", "content_type", "goal", "target_audience", "experience_level"])
out["rf_predict_proba"] = bench(lambda: rf.predict_proba(row), 60)
out["rf_n_estimators"] = int(getattr(rf, "n_estimators", 0) or len(getattr(rf, "estimators_", [])))
json.dump(out, open(sys.argv[1], "w"), indent=1)
print(json.dumps(out, indent=1))
