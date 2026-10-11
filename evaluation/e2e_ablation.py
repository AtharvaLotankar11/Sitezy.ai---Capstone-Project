"""End-to-end ablation on the same 20 benchmark sites. Each arm changes ONE factor of the
deployed pipeline (generation source, LLM acceptance gate, or SEO scorer) and runs the
production SEO loop with the local rewriter. 'full' is taken from rewrite_results.jsonl,
which was produced by the identical loop. Resumable JSONL; numbers only."""
import os, sys, json, re, copy, time, glob, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
SP = os.path.join(HERE, "out")                 # data produced by the earlier steps
sys.path.insert(0, HERE)
import rw_core as core                      # sets cwd to ai_engine and imports seo_engine
import seo_engine, seo_features as sf

OUT = os.path.join(SP, "e2e_results.jsonl")
DEADLINE = time.time() + float(sys.argv[1] if len(sys.argv) > 1 else 1500)
ARMS = {  # arm: (site files glob, gate, scorer)
    "reason_on":     (os.path.join(SP, "ablation_C_sites", "*_C.txt"), True, "mlp"),
    "no_gate":       (os.path.join(SP, "decoding_results_raw", "*_D_both.txt"), False, "mlp"),
    "rubric_scorer": (os.path.join(SP, "decoding_results_raw", "*_D_both.txt"), True, "rubric"),
    "cloud_gen":     (os.path.join(SP, "gemini_results_raw", "*_gemini.txt"), True, "mlp"),
    # added in revision: independent re-run of the deployed configuration (rewriter is sampled at T=0.4)
    "full_rerun":    (os.path.join(SP, "decoding_results_raw", "*_D_both.txt"), True, "mlp"),
    # routing ablation: the scoring/gating step is routed to the Tier-2 LLM instead of the Tier-1 model
    "llm_scorer":    (os.path.join(SP, "decoding_results_raw", "*_D_both.txt"), True, "llm"),
    # recommender on: sections requested from the block recommender (fixed mapping) instead of all seven
    "recommender":   (os.path.join(SP, "recommender_gen_raw", "*_D_both.txt"), True, "mlp"),
}
ONLY = sys.argv[2].split(",") if len(sys.argv) > 2 else None
SCORE_T = [0.0]                              # time spent in LLM scoring calls (llm_scorer arm)

LLM_SCORE_PROMPT = """Rate the on-page SEO quality of this web page for the target keyword on a 0-100 scale.
Consider: title and meta description (presence, length, keyword), keyword use in headings and copy (natural, not stuffed),
heading structure, amount and readability of the copy, and structured data.

Target keyword: {kw}
Title: {title}
Meta description: {meta}
Structured data present: {sd}
Page sections:
{body}

Return ONLY JSON: {{"score": <integer 0-100>}}"""

def llm_score(page, S, kw):
    c = core.build_content(page, S)
    lines = []
    for s in c["sections"]:
        p = s["props"]; parts = [str(p[k]) for k in ("heading", "subheading", "description", "text", "ctaText") if isinstance(p.get(k), str)]
        parts += [f"{it.get('title', '')}: {it.get('description', '')}" for it in (p.get("items") or []) if isinstance(it, dict)]
        lines.append(f"[{s['type']}] " + " | ".join(parts))
    prompt = LLM_SCORE_PROMPT.format(kw=kw or "(none)", title=c["title"], meta=c["metaDescription"] or "(none)",
                                     sd="yes" if c["structuredData"] else "no", body="\n".join(lines)[:4000])
    body = {"model": "qwen3.5:4b", "stream": False, "think": False, "format": "json",
            "messages": [{"role": "user", "content": prompt}], "options": {"num_predict": 60, "num_ctx": 8192, "temperature": 0}}
    t0 = time.time()
    req = urllib.request.Request("http://127.0.0.1:11434/api/chat", data=json.dumps(body).encode(), headers={"content-type": "application/json"})
    text = (json.loads(urllib.request.urlopen(req, timeout=600).read()).get("message") or {}).get("content") or ""
    SCORE_T[0] += time.time() - t0
    try: return max(0.0, min(100.0, float(json.loads(re.search(r"\{[\s\S]*\}", text).group(0))["score"])))
    except Exception: return 0.0

def score_x(page, S, kw, scorer):
    if scorer == "mlp":
        return core.score(page, S, kw)
    if scorer == "llm":                      # LLM score drives gate/threshold; rubric factors pick the weak fields
        _, f, rub = score_x(page, S, kw, "rubric")
        return llm_score(page, S, kw), f, rub
    m, flag = seo_engine._model, seo_engine._load_attempted
    seo_engine._model, seo_engine._load_attempted = None, True     # deterministic rubric fallback
    try:
        r = seo_engine.score_page(core.build_content(page, S), kw)
    finally:
        seo_engine._model, seo_engine._load_attempted = m, flag
    return r["score"], r["factors"], max(0.0, min(100.0, sf.expert_score(sf.normalize(r["raw"]))))

def improve(page, gate, scorer, threshold=80, max_iters=3):
    S0 = copy.deepcopy(page["sections"]); kw = core.derive_keyword(S0)
    s0, f0, r0 = score_x(page, S0, kw, scorer)
    best, bs, bf, br = S0, s0, f0, r0
    rec = {"before": s0, "before_rubric": r0, "acc": 0, "acc_lower": 0, "rej": 0, "empty": 0, "llm_s": 0.0}
    for _ in range(max_iters):
        if bs >= threshold: break
        weak = [f["key"] for f in (bf or []) if f["status"] != "good" and f["key"] in core.TEXT_FIXABLE][:3]
        if not weak: break
        trial = copy.deepcopy(best)
        n, dt, _ = core.rewrite(trial, weak, kw); rec["llm_s"] += dt
        if not n: rec["empty"] += 1; break
        s1, f1, r1 = score_x(page, trial, kw, scorer)
        if s1 > bs or not gate:
            rec["acc"] += 1; rec["acc_lower"] += int(s1 <= bs)
            best, bs, bf, br = trial, s1, f1, r1
        else:
            rec["rej"] += 1; break
    kw_keys = {"keyword_in_title", "keyword_in_headings", "keyword_density"}
    if bs < threshold and any(f["key"] in kw_keys and f["status"] != "good" for f in bf):
        trial = copy.deepcopy(best)
        if core.ensure_kw(trial, kw):
            s1, f1, r1 = score_x(page, trial, kw, scorer)
            if s1 > bs: best, bs, bf, br = trial, s1, f1, r1
    if any(f["key"] in ("structured_data_present", "meta_desc_length") and f["status"] != "good" for f in bf):
        hh = core.hero_heading(best); md = core.meta_desc(best, kw)
        page = dict(page, seo={"metaTitle": core.clamp(hh or page.get("title") or "Home", 60), "metaDescription": md,
                               "jsonLd": {"@context": "https://schema.org", "@type": core.schema_type(core.collect(best)),
                                          "name": hh or page.get("title"), "description": md}})
        bs, bf, br = score_x(page, best, kw, scorer)
    rec.update(after=bs, after_rubric=br, after_mlp=core.score(page, best, kw)[0])
    return rec

def load_pages(fp):
    t = open(fp, encoding="utf-8").read()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", t)
    js = m.group(1) if m else (re.search(r"\{[\s\S]*\}", t).group(0) if re.search(r"\{[\s\S]*\}", t) else t)
    site = json.loads(js); pages = []
    for pg in site.get("pages", []):
        if not isinstance(pg, dict) or not pg.get("sections"): continue
        secs = [s for s in pg["sections"] if isinstance(s, dict)]
        for k, s in enumerate(secs): s.setdefault("id", f"s{k}"); s.setdefault("props", {})
        pages.append({"title": pg.get("title", ""), "seo": {}, "sections": secs})
    return pages

done = set()
if os.path.exists(OUT):
    for l in open(OUT, encoding="utf-8"):
        r = json.loads(l); done.add((r["arm"], r["biz"], r["page"]))
for arm, (pattern, gate, scorer) in ARMS.items():
    if ONLY and arm not in ONLY: continue
    for fp in sorted(glob.glob(pattern), key=lambda p: int(os.path.basename(p).split("_")[0])):
        biz = int(os.path.basename(fp).split("_")[0])
        for pi, page in enumerate(load_pages(fp)):
            if (arm, biz, pi) in done: continue
            if time.time() > DEADLINE: print("deadline; resume later", flush=True); sys.exit(0)
            SCORE_T[0] = 0.0
            try: rec = improve(page, gate, scorer); rec["score_llm_s"] = SCORE_T[0]
            except Exception as e: rec = {"error": str(e)[:200]}
            rec.update(arm=arm, biz=biz, page=pi)
            open(OUT, "a", encoding="utf-8").write(json.dumps(rec) + "\n")
    print("arm done:", arm, flush=True)
print("all arms done", flush=True)
