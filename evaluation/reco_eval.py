"""Recommender: zero-shot business-type accuracy on an author-constructed labelled prompt
set (52 prompts = 13 types x 4), comparing the DEPLOYED score index (probs[0][2] =
'neutral' per the model's id2label) with the entailment index (probs[0][1]); downstream
effect on the Random-Forest block selection; and per-request latencies."""
import os, sys, json, time
import numpy as np
AI = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ai_engine"))
sys.path.insert(0, AI); os.chdir(AI)
import torch
torch.set_num_threads(2)
import joblib, pandas as pd
from transformers import AutoTokenizer, AutoModelForSequenceClassification

OUT = sys.argv[1]
name = "cross-encoder/nli-MiniLM2-L6-H768"
tok = AutoTokenizer.from_pretrained(name); nli = AutoModelForSequenceClassification.from_pretrained(name).eval()
id2label = nli.config.id2label

business_types = ["ecommerce","blog","portfolio","startup","education","restaurant","healthcare",
                  "real_estate","saas","event","nonprofit","news","personal_brand"]
content_types = ["products","articles","services","courses","gallery","menu","booking","portfolio_items",
                 "events","news_updates","downloads"]
goals = ["sales","lead_generation","branding","education","booking","awareness","portfolio_showcase",
         "community_building","content_delivery"]
target_audience = ["general_public","students","business_clients","recruiters","investors","patients",
                   "local_customers","online_shoppers","members","developers"]
components = ["hero_banner","service_cards","team_section","gallery","testimonials","faq","pricing_table",
              "contact_form","newsletter","blog_preview","stats_counter","call_to_action"]

PROMPTS = {
 "ecommerce": ["online store selling handmade jewelry", "e-commerce shop for sneakers and streetwear",
               "web store for organic skincare products with checkout", "online marketplace for vintage furniture"],
 "blog": ["personal travel blog sharing stories and tips", "food blog with recipes and cooking articles",
          "tech blog writing tutorials about programming", "lifestyle blog about minimalism and productivity"],
 "portfolio": ["portfolio for a freelance graphic designer", "photographer portfolio showcasing wedding shoots",
               "architect portfolio of completed building projects", "UX designer portfolio with case studies"],
 "startup": ["early-stage startup building an AI note-taking app", "fintech startup launching a new payments product",
             "startup pitching our electric scooter to early adopters", "seed-funded startup with a waitlist for our app"],
 "education": ["online academy offering math courses for kids", "coding bootcamp teaching web development",
               "language school with Spanish and French classes", "tutoring center preparing students for exams"],
 "restaurant": ["Italian restaurant with wood-fired pizza and reservations", "sushi restaurant downtown with a dinner menu",
                "family diner serving breakfast and burgers", "vegan restaurant with a seasonal tasting menu"],
 "healthcare": ["dental clinic offering cleanings and implants", "pediatric clinic for children's health checkups",
                "physiotherapy center for sports injuries", "dermatology practice treating skin conditions"],
 "real_estate": ["real estate agency listing homes for sale", "property management company renting apartments",
                 "luxury villas for sale by the beach", "realtor helping first-time home buyers"],
 "saas": ["SaaS platform for team project management", "cloud software for invoicing and accounting",
          "subscription CRM tool for small sales teams", "HR software as a service for payroll"],
 "event": ["music festival with lineup and ticket sales", "tech conference with speakers and schedule",
           "wedding expo event in the city this summer", "charity gala dinner with event registration"],
 "nonprofit": ["nonprofit organization fighting childhood hunger", "animal rescue charity accepting donations",
               "environmental NGO planting trees", "volunteer-run community foundation supporting refugees"],
 "news": ["local news site covering city politics", "daily news portal with breaking headlines",
          "sports news website with match reports", "business news publication covering markets"],
 "personal_brand": ["personal brand site for a motivational speaker", "life coach building a personal brand",
                    "influencer personal website with media kit", "author personal brand site promoting my books"],
}

def probs(prompt, labels):
    out = []
    for lb in labels:
        inp = tok(prompt, f"This website is about {lb}", return_tensors="pt", truncation=True)
        with torch.no_grad(): out.append(torch.softmax(nli(**inp).logits, dim=1)[0].numpy())
    return np.array(out)   # [n_labels, 3]

def classify(prompt, labels, idx): return labels[int(np.argmax(probs(prompt, labels)[:, idx]))]

res = {"id2label": id2label, "n_prompts": sum(len(v) for v in PROMPTS.values())}
y, p_dep, p_ent = [], [], []
for lab, ps in PROMPTS.items():
    for pr in ps:
        P = probs(pr, business_types)
        y.append(lab); p_dep.append(business_types[int(np.argmax(P[:, 2]))]); p_ent.append(business_types[int(np.argmax(P[:, 1]))])
y = np.array(y)
res["biz_acc_deployed_idx2_neutral"] = float(np.mean(np.array(p_dep) == y))
res["biz_acc_entailment_idx1"] = float(np.mean(np.array(p_ent) == y))
res["chance"] = 1 / len(business_types)
# paired comparison on the same prompts: exact McNemar test + Wilson 95% intervals
import math
from scipy.stats import binomtest
def wilson(k, n, z=1.959964):
    p = k / n; d = 1 + z * z / n; c = (p + z * z / (2 * n)) / d; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(c - h, 3), round(c + h, 3)]
dep_ok, ent_ok = np.array(p_dep) == y, np.array(p_ent) == y
b, c = int((~dep_ok & ent_ok).sum()), int((dep_ok & ~ent_ok).sum())
res["mcnemar"] = {"entailment_only_correct": b, "neutral_only_correct": c,
                  "exact_p": float(binomtest(min(b, c), b + c, 0.5).pvalue) if b + c else 1.0,
                  "wilson95_neutral": wilson(int(dep_ok.sum()), len(y)),
                  "wilson95_entailment": wilson(int(ent_ok.sum()), len(y))}
per = {}
for lab in PROMPTS:
    m = y == lab
    per[lab] = {"deployed": float(np.mean(np.array(p_dep)[m] == lab)), "entailment": float(np.mean(np.array(p_ent)[m] == lab))}
res["per_type"] = per

# latency of the zero-shot extraction (business only, and the full 4-feature extract_features)
pr0 = PROMPTS["restaurant"][0]
for _ in range(3): probs(pr0, business_types)
ts = []
for _ in range(15):
    t0 = time.perf_counter(); probs(pr0, business_types); ts.append(time.perf_counter() - t0)
res["lat_ms_business_only"] = float(np.median(ts) * 1000)
ts = []
for _ in range(8):
    t0 = time.perf_counter()
    for L in (business_types, content_types, goals, target_audience): probs(pr0, L)
    ts.append(time.perf_counter() - t0)
res["lat_ms_extract_features_full"] = float(np.median(ts) * 1000)
json.dump(res, open(OUT, "w"), indent=1); print("zero-shot done", flush=True)

# downstream Random Forest: does the index bug change the selected blocks?
try:
    t0 = time.perf_counter(); rf = joblib.load("layout_model.pkl"); enc = joblib.load("label_encoders.pkl")
    res["rf_load_s"] = time.perf_counter() - t0
    cols = ["business_type", "content_type", "goal", "target_audience", "experience_level"]
    def feats(prompt, idx):
        return [classify(prompt, business_types, idx), classify(prompt, content_types, idx),
                classify(prompt, goals, idx), classify(prompt, target_audience, idx), "beginner"]
    def select(f):
        row = pd.DataFrame([[enc[i].transform([f[i]])[0] for i in range(5)]], columns=cols)
        pp = rf.predict_proba(row); return {c for i, c in enumerate(components) if pp[i][0][1] > 0.5}, row
    diffs, jac = 0, []
    allp = [p for v in PROMPTS.values() for p in v]
    for pr in allp:
        a, _ = select(feats(pr, 2)); b, row = select(feats(pr, 1))
        diffs += int(a != b); jac.append(len(a & b) / max(1, len(a | b)))
    res["rf_selection_changed_frac"] = diffs / len(allp)
    res["rf_jaccard_deployed_vs_fixed_mean"] = float(np.mean(jac))
    for _ in range(5): rf.predict_proba(row)
    ts = []
    for _ in range(50):
        t0 = time.perf_counter(); rf.predict_proba(row); ts.append(time.perf_counter() - t0)
    res["lat_ms_rf_predict"] = float(np.median(ts) * 1000)
except Exception as e:
    res["rf_error"] = str(e)
json.dump(res, open(OUT, "w"), indent=1)
print(json.dumps({k: v for k, v in res.items() if k != "per_type"}, indent=1))
