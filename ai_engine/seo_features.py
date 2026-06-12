"""
seo_features.py — NLP-based SEO feature extraction for SitePilot.

Extracts 15 numeric features from a page's content (the same `layoutConfig.sections`
shape used by the builder) and normalizes each to [0,1] where 1 == ideal. Both the
training script (train_seo_model.py) and the live scorer (seo_engine.py) import this
module so features stay perfectly in sync.

Paper-faithful features include keyword density, heading-hierarchy validity, and the
Flesch-Kincaid grade level (computed by hand — no extra dependencies).
"""
import re

# ── Fixed feature order (the MLP input vector) ──────────────────────────────────
FEATURE_ORDER = [
    "title_length", "meta_desc_length", "keyword_density", "heading_hierarchy_valid",
    "flesch_kincaid", "image_alt_coverage", "internal_link_count", "external_link_count",
    "word_count", "h1_count", "h2_count", "avg_sentence_length",
    "keyword_in_title", "keyword_in_headings", "structured_data_present",
]

# Importance weights (sum≈1.0). Emphasize heading hierarchy, keyword density and alt
# coverage as the most predictive features (per the paper's feature-importance result).
# Used to generate synthetic training labels AND shown as "impact" in the UI.
WEIGHTS = {
    "heading_hierarchy_valid": 0.16, "keyword_density": 0.13, "image_alt_coverage": 0.12,
    "flesch_kincaid": 0.10, "meta_desc_length": 0.08, "title_length": 0.07,
    "word_count": 0.07, "h2_count": 0.06, "internal_link_count": 0.05,
    "keyword_in_title": 0.04, "keyword_in_headings": 0.04, "h1_count": 0.03,
    "avg_sentence_length": 0.02, "external_link_count": 0.02, "structured_data_present": 0.01,
}

LABELS = {
    "title_length": "Title length", "meta_desc_length": "Meta description",
    "keyword_density": "Keyword density", "heading_hierarchy_valid": "Heading hierarchy",
    "flesch_kincaid": "Readability", "image_alt_coverage": "Image alt coverage",
    "internal_link_count": "Internal links", "external_link_count": "External links",
    "word_count": "Word count", "h1_count": "H1 count", "h2_count": "H2 count",
    "avg_sentence_length": "Sentence length", "keyword_in_title": "Keyword in title",
    "keyword_in_headings": "Keyword in headings", "structured_data_present": "Structured data",
}

# ── Text helpers ────────────────────────────────────────────────────────────────
def _words(text):
    return re.findall(r"[A-Za-z']+", text or "")

def _sentences(text):
    parts = re.split(r"[.!?]+", text or "")
    return [p for p in parts if p.strip()]

def _syllables(word):
    w = word.lower()
    groups = re.findall(r"[aeiouy]+", w)
    n = len(groups)
    if w.endswith("e") and n > 1:
        n -= 1
    return max(1, n)

def _trapezoid(x, lo_acc, lo_ideal, hi_ideal, hi_acc, floor=0.05):
    """1.0 inside [lo_ideal,hi_ideal], ramps to `floor` at the acceptable edges."""
    if x <= lo_acc or x >= hi_acc:
        return floor
    if lo_ideal <= x <= hi_ideal:
        return 1.0
    if x < lo_ideal:
        return floor + (1 - floor) * (x - lo_acc) / max(1e-6, (lo_ideal - lo_acc))
    return floor + (1 - floor) * (hi_acc - x) / max(1e-6, (hi_acc - hi_ideal))

def _ramp_up(x, start, full, floor=0.1):
    if x <= start:
        return floor
    if x >= full:
        return 1.0
    return floor + (1 - floor) * (x - start) / (full - start)

# ── Content flattening (mirrors builder section props) ──────────────────────────
def _section_texts(content):
    """Returns (title, meta_description, h1_list, h2_list, body_blocks, images, links)."""
    sections = content.get("sections", []) or []
    title = (content.get("title") or "").strip()
    meta = (content.get("metaDescription") or "").strip()
    h1, h2, body, images, links = [], [], [], [], []

    for s in sections:
        t = s.get("type")
        p = s.get("props", {}) or {}
        if t == "Hero":
            if p.get("heading"):
                h1.append(p["heading"]); body.append(p["heading"])
            if p.get("subheading"):
                body.append(p["subheading"])
                if not meta:
                    meta = p["subheading"].strip()
            if not title and p.get("heading"):
                title = p["heading"].strip()
            if p.get("ctaText"):
                body.append(p["ctaText"])
            if p.get("backgroundImage") or p.get("backgroundImageQuery"):
                images.append({"alt": p.get("heading", "")})
            if p.get("ctaLink"):
                links.append(p["ctaLink"])
        elif t in ("Text", "CTA", "ContactForm", "DynamicForm"):
            if p.get("heading"):
                h2.append(p["heading"]); body.append(p["heading"])
            for k in ("subheading", "description", "text"):
                if p.get(k):
                    body.append(p[k])
            if p.get("ctaText"):
                body.append(p["ctaText"])
            if p.get("ctaLink"):
                links.append(p["ctaLink"])
        elif t == "Gallery":
            if p.get("heading"):
                h2.append(p["heading"]); body.append(p["heading"])
            for it in (p.get("items") or []):
                if isinstance(it, dict):
                    if it.get("title"):
                        body.append(it["title"])
                    if it.get("description"):
                        body.append(it["description"])
                    if it.get("image") or it.get("imageQuery"):
                        images.append({"alt": it.get("title", "")})
        elif t == "Navbar":
            for ln in (p.get("links") or []):
                label = ln.get("label") if isinstance(ln, dict) else ln
                url = ln.get("url") if isinstance(ln, dict) else None
                if label:
                    body.append(label)
                if url:
                    links.append(url)
        elif t == "Footer":
            if p.get("text"):
                body.append(p["text"])
    return title, meta, h1, h2, body, images, links

# ── Feature extraction ──────────────────────────────────────────────────────────
def extract_raw(content, keyword=""):
    title, meta, h1, h2, body, images, links = _section_texts(content)
    keyword = (keyword or "").strip().lower()

    all_text = " ".join(body)
    words = _words(all_text)
    W = len(words) or 1
    sents = _sentences(all_text)
    S = len(sents) or 1
    Y = sum(_syllables(w) for w in words) or 1

    # keyword density
    kw_words = _words(keyword)
    if kw_words:
        joined = " ".join(words).lower()
        n_k = len(re.findall(r"\b" + re.escape(keyword) + r"\b", joined)) if keyword else 0
        density = (n_k * len(kw_words) / W) * 100
    else:
        density = 0.0

    # links
    internal, external = 0, 0
    for ln in links:
        ln = str(ln)
        if ln.startswith("http://") or ln.startswith("https://"):
            external += 1
        else:
            internal += 1

    # images / alt coverage
    n_img = len(images)
    n_alt = sum(1 for im in images if (im.get("alt") or "").strip())
    alt_cov = (n_alt / n_img) if n_img else 1.0  # no images → not penalized

    fk = 0.39 * (W / S) + 11.8 * (Y / W) - 15.59

    headings_text = " ".join(h1 + h2).lower()
    return {
        "title_length": len(title),
        "meta_desc_length": len(meta),
        "keyword_density": round(density, 3),
        "heading_hierarchy_valid": 1 if (len(h1) == 1 and len(h2) >= 1) else 0,
        "flesch_kincaid": round(fk, 2),
        "image_alt_coverage": round(alt_cov, 3),
        "internal_link_count": internal,
        "external_link_count": external,
        "word_count": W,
        "h1_count": len(h1),
        "h2_count": len(h2),
        "avg_sentence_length": round(W / S, 2),
        "keyword_in_title": 1 if (keyword and keyword in title.lower()) else 0,
        "keyword_in_headings": 1 if (keyword and keyword in headings_text) else 0,
        "structured_data_present": 1 if content.get("structuredData") else 0,
        # extra context (not features) for diagnostics
        "_image_count": n_img, "_has_keyword": bool(keyword),
    }

def normalize(raw):
    """Map raw values → [0,1] where 1 == ideal."""
    n = {}
    n["title_length"] = _trapezoid(raw["title_length"], 10, 35, 60, 75)
    n["meta_desc_length"] = _trapezoid(raw["meta_desc_length"], 40, 110, 160, 200)
    d = raw["keyword_density"]
    n["keyword_density"] = 0.15 if d == 0 else _trapezoid(d, 0.2, 0.8, 2.5, 5.0)
    n["heading_hierarchy_valid"] = float(raw["heading_hierarchy_valid"])
    # FK grade level: lower = easier; ideal ~5–9 for the web
    n["flesch_kincaid"] = _trapezoid(raw["flesch_kincaid"], 1, 4, 9, 16, floor=0.2)
    n["image_alt_coverage"] = float(raw["image_alt_coverage"])
    n["internal_link_count"] = _ramp_up(raw["internal_link_count"], 0, 3, floor=0.25)
    n["external_link_count"] = 1.0 if raw["external_link_count"] <= 5 else 0.6
    n["word_count"] = _ramp_up(raw["word_count"], 40, 300, floor=0.15)
    n["h1_count"] = 1.0 if raw["h1_count"] == 1 else (0.0 if raw["h1_count"] == 0 else 0.3)
    n["h2_count"] = _ramp_up(raw["h2_count"], 0, 2, floor=0.2)
    n["avg_sentence_length"] = _trapezoid(raw["avg_sentence_length"], 4, 10, 20, 30)
    n["keyword_in_title"] = float(raw["keyword_in_title"])
    n["keyword_in_headings"] = float(raw["keyword_in_headings"])
    n["structured_data_present"] = float(raw["structured_data_present"])
    return n

def to_vector(norm):
    return [float(norm[k]) for k in FEATURE_ORDER]

def expert_score(norm):
    """Weighted score in [0,100] — used to label synthetic training data."""
    return 100.0 * sum(WEIGHTS[k] * norm[k] for k in FEATURE_ORDER)

# ── Human-readable diagnostics ──────────────────────────────────────────────────
_HINTS = {
    "title_length": "Aim for a 40–60 character page title.",
    "meta_desc_length": "Write a 110–160 character meta description (e.g. the hero subheading).",
    "keyword_density": "Use your target keyword naturally 1–2.5% of the time (avoid stuffing).",
    "heading_hierarchy_valid": "Use exactly one H1 (hero heading) and at least one H2 (section headings).",
    "flesch_kincaid": "Simplify wording — shorter sentences and common words read better.",
    "image_alt_coverage": "Give every image descriptive alt text (use the item title/heading).",
    "internal_link_count": "Add a few internal links (nav items / CTAs) to aid crawling.",
    "external_link_count": "Too many external links can dilute authority.",
    "word_count": "Add more substantive copy — aim for 300+ words on key pages.",
    "h1_count": "There should be exactly one H1 on the page.",
    "h2_count": "Add at least two H2 section headings to structure the page.",
    "avg_sentence_length": "Keep sentences around 12–20 words.",
    "keyword_in_title": "Include your target keyword in the page title.",
    "keyword_in_headings": "Mention your target keyword in at least one heading.",
    "structured_data_present": "Add structured data (JSON-LD) for richer search results.",
}

def _status(v):
    return "good" if v >= 0.7 else ("warn" if v >= 0.4 else "bad")

def diagnostics(raw, norm):
    out = []
    for k in FEATURE_ORDER:
        out.append({
            "key": k, "label": LABELS[k], "value": raw[k],
            "normalized": round(norm[k], 3), "weight": WEIGHTS[k],
            "status": _status(norm[k]), "hint": _HINTS[k],
        })
    # Sort weakest-first by (weight * shortfall) so the UI shows the most impactful issues on top
    out.sort(key=lambda f: -f["weight"] * (1 - f["normalized"]))
    return out
