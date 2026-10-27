"""Shared core: faithful Python port of seo.controller.js autoImproveSeo, run on REAL Qwen-generated
pages (decoding experiment, production config D_both). Scorer = the DEPLOYED seo_mlp.pt via
seo_engine.score_page. Also tracks the linear expert rubric (label function) per stage and
every REJECTED LLM proposal, to measure the monotone gate. Resumable JSONL."""
import os, sys, json, re, copy, time, glob, urllib.request
AI = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ai_engine"))
sys.path.insert(0, AI); os.chdir(AI)
import seo_engine, seo_features as sf


EDITABLE = {"heading": 90, "subheading": 320, "description": 600, "text": 600, "ctaText": 40}
TEXT_FIXABLE = {"keyword_density", "keyword_in_title", "keyword_in_headings", "heading_hierarchy_valid",
                "flesch_kincaid", "meta_desc_length", "title_length", "word_count", "avg_sentence_length", "h2_count"}
STOP = set(("the a an and or but of to in for on with your you our we us is are be am was were this that it its as at by from "
            "into over under more most very can will just get got also their they them his her what which who when where why how "
            "all any some no not so if then than too about up out down only own same s t re ve ll d m").split())

def hero(S): return next((s for s in S if s.get("type") == "Hero"), None)
def hero_heading(S): h = hero(S); return ((h or {}).get("props", {}).get("heading") or "").strip()
def hero_sub(S): p = (hero(S) or {}).get("props", {}); return (p.get("subheading") or p.get("description") or "").strip()
def collect(S):
    out = []
    for s in S:
        p = s.get("props") or {}
        for k in ("heading", "subheading", "description", "text", "ctaText"):
            if isinstance(p.get(k), str): out.append(p[k])
        for it in (p.get("items") or []):
            if isinstance(it, dict):
                if it.get("title"): out.append(str(it["title"]))
                if it.get("description"): out.append(str(it["description"]))
    return " ".join(out)
def toks(t): return re.findall(r"[a-z][a-z'-]{2,}", (t or "").lower())
def derive_keyword(S):
    heading_text = " . ".join((s.get("props") or {}).get("heading") or "" for s in S)
    hero_text = f"{hero_heading(S)} . {hero_sub(S)}"; body = collect(S)
    freq = {}
    for t, n in ((body, 1), (heading_text, 3), (hero_text, 3)):
        for w in toks(t):
            if w not in STOP: freq[w] = freq.get(w, 0) + n
    if not freq: return ""
    bi = {}
    for t, n in ((heading_text, 2), (hero_text, 2), (body, 1)):
        tk = toks(t)
        for a, b in zip(tk, tk[1:]):
            if a in STOP or b in STOP: continue
            bi[f"{a} {b}"] = bi.get(f"{a} {b}", 0) + n
    top_uni = sorted(freq.items(), key=lambda x: -x[1])[0][0]
    top_bi = sorted(bi.items(), key=lambda x: -x[1])[0] if bi else None
    return top_bi[0] if (top_bi and top_bi[1] >= 2) else top_uni
def clamp(t, hi):
    t = re.sub(r"\s+", " ", t or "").strip(); return (t[:hi - 1].strip() + "…") if len(t) > hi else t
def build_content(page, S):
    seo = page.get("seo") or {}
    return {"title": seo.get("metaTitle") or hero_heading(S) or page.get("title") or "",
            "metaDescription": seo.get("metaDescription") or "", "structuredData": seo.get("jsonLd"),
            "sections": [{"id": s.get("id"), "type": s.get("type"), "props": s.get("props") or {}} for s in S]}
def score(page, S, kw):
    r = seo_engine.score_page(build_content(page, S), kw)
    rub = max(0.0, min(100.0, sf.expert_score(sf.normalize(r["raw"]))))
    return r["score"], r["factors"], rub

INSTR = {
 "keyword_density": 'Ensure {kw} appears naturally ONCE or twice total across the whole page — never more (avoid stuffing/repetition).',
 "keyword_in_title": 'Only if it reads naturally, work {kw} into the hero heading or subheading. Do NOT rename a brand or product name to force it in.',
 "keyword_in_headings": 'Only if it reads naturally, mention {kw} in ONE section heading. Never rename a brand or proper-noun heading (e.g. keep "Artisan Crust" exactly).',
 "heading_hierarchy_valid": 'Make the hero heading a single strong H1 and ensure other sections have clear, distinct headings.',
 "flesch_kincaid": 'Simplify the writing: shorter sentences, plainer words, easier to read.',
 "meta_desc_length": 'Expand the hero subheading into a compelling 110–160 character summary of the page.',
 "title_length": 'Adjust the hero heading to a punchy 40–60 characters.',
 "word_count": 'Add more substantive, benefit-driven copy to thin sections.',
 "avg_sentence_length": 'Break long sentences into shorter ones (~12–20 words).',
 "h2_count": 'Give content sections clear, descriptive headings.',
 "internal_link_count": 'Strengthen calls-to-action so the page guides visitors onward.'}
def instr(k, kw): return INSTR.get(k, 'Improve "' + k + '".').replace("{kw}", f'"{kw}"' if kw else "the page's main keyword")

def rewrite(S, weak, kw):
    editable = []
    for s in S:
        p = s.get("props") or {}
        if any(isinstance(p.get(k), str) for k in EDITABLE):
            editable.append({"id": s["id"], "type": s["type"],
                             "fields": {k: p[k] for k in EDITABLE if isinstance(p.get(k), str) and p[k].strip()}})
    guidance = "\n".join(f"- {k}: {instr(k, kw)}" for k in weak)
    prompt = f"""You are an expert SEO copywriter. Improve the website copy below to fix specific weaknesses WITHOUT changing the meaning, tone, or factual claims. Keep it natural and human.

TARGET KEYWORD: {kw or "(none provided — infer the main topic)"}

WEAKNESSES TO FIX:
{guidance}

EDITABLE SECTIONS (id, type, current text fields):
{json.dumps(editable, indent=2, ensure_ascii=False)}

CRITICAL RULES — copy quality comes first:
- Keep every edit natural, human, and grammatically correct, with natural word order.
- Use the target keyword SPARINGLY: at most once or twice across the ENTIRE page. Never repeat it awkwardly, and never write phrases like "Authentic Pizza Authentic".
- NEVER rename brand names, product names, or proper-noun headings (e.g. keep "Artisan Crust" exactly as written).
- If the keyword does not fit a field naturally, leave that field unchanged — a clean sentence beats a keyword-stuffed one.
- Preserve the original meaning, tone, and factual claims.

Return ONLY JSON (no markdown):
{{ "patches": [ {{ "sectionId": "<id>", "propKey": "<heading|subheading|description|text|ctaText>", "newValue": "<rewritten text>" }} ] }}
Rules: only edit existing fields shown above; keep each value concise and within sensible length; do not invent new sections; only include fields you actually improved."""
    body = {"model": "qwen3.5:4b", "stream": False, "think": False, "format": "json",
            "messages": [{"role": "system", "content": "You are a precise SEO copy editor. You output only strict, valid JSON."},
                         {"role": "user", "content": prompt}],
            "options": {"num_predict": 1500, "num_ctx": 8192, "temperature": 0.4}}
    t0 = time.time()
    req = urllib.request.Request("http://127.0.0.1:11434/api/chat", data=json.dumps(body).encode(),
                                 headers={"content-type": "application/json"})
    j = json.loads(urllib.request.urlopen(req, timeout=600).read())
    text = (j.get("message") or {}).get("content") or ""
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    js = m.group(1) if m else (re.search(r"\{[\s\S]*\}", text).group(0) if re.search(r"\{[\s\S]*\}", text) else text)
    try: parsed = json.loads(js.strip())
    except Exception: parsed = {}
    by = {s["id"]: s for s in S}; applied = 0
    for pt in (parsed.get("patches") or []):
        if not isinstance(pt, dict): continue
        sec, key, val = by.get(pt.get("sectionId")), pt.get("propKey"), pt.get("newValue")
        if not sec or key not in EDITABLE or not isinstance(val, str): continue
        clean = val.strip()[:EDITABLE[key]]
        if not clean or not isinstance((sec.get("props") or {}).get(key), str) or clean == sec["props"][key]: continue
        sec["props"][key] = clean; applied += 1
    return applied, time.time() - t0, j.get("eval_count")

def ensure_kw(S, kw):
    if not kw: return 0
    k = kw.strip().lower()
    for s in S:
        for key in ("description", "subheading", "text"):
            v = (s.get("props") or {}).get(key)
            if isinstance(v, str) and v.strip() and k not in v.lower():
                after = clamp(f"{v} Discover what makes our {k} stand out.", EDITABLE[key])
                if after == v: continue
                s["props"][key] = after; return 1
    return 0
def meta_desc(S, kw):
    base = hero_sub(S) or hero_heading(S) or ""
    if kw and kw.lower() not in base.lower(): base = f"{base} — {kw}." if base else f"{kw}."
    if len(base) < 110:
        extra = collect(S).replace(base, "", 1).strip()
        if extra: base = f"{base} {extra}"
    return clamp(base, 160)
def schema_type(t):
    t = (t or "").lower()
    if re.search(r"restaurant|cafe|food|menu|dining|pizza|juice|bakery|coffee", t): return "Restaurant"
    if re.search(r"shop|store|product|buy|cart|ecommerce|fashion|clothing|boutique", t): return "Store"
    if re.search(r"gym|fitness|clinic|salon|studio|spa|local", t): return "LocalBusiness"
    return "Organization"

def auto_improve(page, threshold=80, max_iters=3):
    S0 = copy.deepcopy(page["sections"]); kw = derive_keyword(S0)
    s0, f0, r0 = score(page, S0, kw)
    best, bs, bf, br = S0, s0, f0, r0
    rec = {"keyword": kw, "before": s0, "before_rubric": r0, "llm_accepted": 0, "llm_rejected": 0,
           "rejected_deltas": [], "llm_time_s": 0.0, "llm_tokens": 0}
    for _ in range(max_iters):
        if bs >= threshold: break
        weak = [f["key"] for f in (bf or []) if f["status"] != "good" and f["key"] in TEXT_FIXABLE][:3]
        if not weak: break
        trial = copy.deepcopy(best)
        n, dt, tok = rewrite(trial, weak, kw); rec["llm_time_s"] += dt; rec["llm_tokens"] += tok or 0
        if not n: rec["llm_empty"] = rec.get("llm_empty", 0) + 1; break
        s1, f1, r1 = score(page, trial, kw)
        if s1 > bs: rec["llm_accepted"] += 1; best, bs, bf, br = trial, s1, f1, r1
        else: rec["llm_rejected"] += 1; rec["rejected_deltas"].append(s1 - bs); break
    rec["after_llm"], rec["after_llm_rubric"] = bs, br
    kw_keys = {"keyword_in_title", "keyword_in_headings", "keyword_density"}
    if bs < threshold and any(f["key"] in kw_keys and f["status"] != "good" for f in bf):
        trial = copy.deepcopy(best)
        if ensure_kw(trial, kw):
            s1, f1, r1 = score(page, trial, kw)
            if s1 > bs: best, bs, bf, br = trial, s1, f1, r1; rec["kw_net_applied"] = True
    rec["after_kw"], rec["after_kw_rubric"] = bs, br
    if any(f["key"] in ("structured_data_present", "meta_desc_length") and f["status"] != "good" for f in bf):
        hh = hero_heading(best); md = meta_desc(best, kw)
        page = dict(page, seo={"metaTitle": clamp(hh or page.get("title") or "Home", 60), "metaDescription": md,
                               "jsonLd": {"@context": "https://schema.org", "@type": schema_type(collect(best)),
                                          "name": hh or page.get("title"), "description": md}})
        bs, bf, br = score(page, best, kw); rec["meta_applied"] = True
    rec["after_meta"], rec["after_meta_rubric"] = bs, br
    return rec

