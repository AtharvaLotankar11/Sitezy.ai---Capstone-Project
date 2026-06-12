"""
design_features.py — encodes a page into f in R^20 (normalized [0,1]) for the
design-flaw detector (autoencoder + isolation forest).

The contrast math is ported VERBATIM from the frontend renderer
(PublicSiteRenderer.jsx: relLuminance / contrastRatio / isDarkBg / readableText) so the
flaw score reflects exactly what a visitor would see.
"""
import re

FEATURE_ORDER_D = [
    "section_count", "has_navbar", "has_footer", "has_hero", "cta_count",
    "text_section_count", "gallery_count", "heading_hierarchy_valid", "avg_text_length",
    "image_count", "image_alt_coverage", "min_contrast", "avg_contrast",
    "frac_low_contrast", "distinct_bg_colors", "distinct_fonts", "cta_above_fold",
    "duplicate_heading_ratio", "empty_prop_ratio", "structural_order_valid",
]

_NAMED = {"white": "#ffffff", "black": "#000000", "transparent": "#ffffff"}
_DEFAULT_BG = {"Navbar": "#ffffff", "Hero": "#ffffff", "Text": "#f9fafb", "Gallery": "#ffffff",
               "CTA": "#ffffff", "ContactForm": "#ffffff", "DynamicForm": "#ffffff", "Footer": "#0f172a"}
_DEFAULT_TC = {"Footer": "#9ca3af"}


def _hex_to_rgb(color):
    if not color:
        return None
    c = str(color).lower().strip()
    c = _NAMED.get(c, c)
    if not c.startswith("#"):
        return None
    c = c[1:]
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    if len(c) != 6:
        return None
    try:
        return int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
    except ValueError:
        return None


def _rel_luminance(color):
    rgb = _hex_to_rgb(color)
    if not rgb:
        return 0.5
    def f(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def _contrast_ratio(a, b):
    la, lb = _rel_luminance(a), _rel_luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def _is_dark_bg(bg):
    rgb = _hex_to_rgb(bg)
    if not rgb:
        return False
    return _rel_luminance(bg) < 0.42


def _readable_text(bg, preferred):
    if preferred and _contrast_ratio(bg, preferred) >= 3:
        return preferred
    return "#ffffff" if _is_dark_bg(bg) else "#14181d"


def _clamp01(x):
    return max(0.0, min(1.0, x))


def _heading_of(section):
    p = section.get("props", {}) or {}
    return (p.get("heading") or "").strip()


def extract_raw(content):
    sections = content.get("sections", []) or []
    n = len(sections)
    types = [s.get("type") for s in sections]

    cta = sum(1 for t in types if t == "CTA")
    text_secs = sum(1 for t in types if t == "Text")
    galleries = sum(1 for t in types if t == "Gallery")
    h1 = sum(1 for s in sections if s.get("type") == "Hero" and _heading_of(s))
    h2 = sum(1 for s in sections if s.get("type") in ("Text", "CTA", "Gallery", "ContactForm", "DynamicForm") and _heading_of(s))

    # text lengths + empties
    text_lengths, empty = [], 0
    headings = []
    images, images_with_alt = 0, 0
    bg_colors, fonts = set(), set()
    contrasts = []
    contrast_fixes = []

    for s in sections:
        t = s.get("type")
        p = s.get("props", {}) or {}
        if p.get("bgColor"):
            bg_colors.add(str(p["bgColor"]).lower())
        if p.get("fontFamily"):
            fonts.add(str(p["fontFamily"]).lower())

        # contrast — skip sections with a background image (text sits over an image +
        # dark overlay, so the solid-color ratio is irrelevant). The renderer also
        # auto-corrects text color at render time, so this rarely indicates a real issue.
        has_bg_img = bool(p.get("backgroundImage") or p.get("backgroundImageQuery"))
        if not has_bg_img:
            bg = p.get("bgColor") or _DEFAULT_BG.get(t, "#ffffff")
            tc = p.get("textColor") or _DEFAULT_TC.get(t, "#111827")
            cr = _contrast_ratio(bg, _readable_text(bg, tc))
            contrasts.append(cr)
            if cr < 3.0 and s.get("id"):
                # recommend the highest-contrast text colour for this background
                best = "#0a0a0a" if _contrast_ratio(bg, "#0a0a0a") >= _contrast_ratio(bg, "#ffffff") else "#ffffff"
                contrast_fixes.append({"sectionId": s["id"], "prop": "textColor", "value": best})

        # text content per section
        blob = " ".join(str(p.get(k, "")) for k in ("heading", "subheading", "description", "text", "ctaText"))
        if t == "Gallery":
            for it in (p.get("items") or []):
                if isinstance(it, dict):
                    blob += " " + str(it.get("title", "")) + " " + str(it.get("description", ""))
                    if it.get("image") or it.get("imageQuery"):
                        images += 1
                        if (it.get("title") or "").strip():
                            images_with_alt += 1
        if t == "Hero" and (p.get("backgroundImage") or p.get("backgroundImageQuery")):
            images += 1
            if (p.get("heading") or "").strip():
                images_with_alt += 1
        blob = blob.strip()
        if t in ("Hero", "Text", "CTA", "Gallery") and len(blob) < 3:
            empty += 1
        if blob:
            text_lengths.append(len(blob))
        h = _heading_of(s)
        if h:
            headings.append(h.lower())

    avg_text = sum(text_lengths) / len(text_lengths) if text_lengths else 0
    dup_headings = (len(headings) - len(set(headings))) if headings else 0
    dup_ratio = (dup_headings / len(headings)) if headings else 0
    min_c = min(contrasts) if contrasts else 7.0
    avg_c = sum(contrasts) / len(contrasts) if contrasts else 7.0
    # Only count genuinely poor contrast (< 3.0). The renderer guarantees >= 3 at render
    # time, so this is effectively a safety net for hand-edited raw colors.
    frac_low = (sum(1 for c in contrasts if c < 3.0) / len(contrasts)) if contrasts else 0
    cta_above = 1 if any(types[i] in ("Hero", "CTA") for i in range(min(2, n))) else 0
    order_valid = 1 if (n >= 2 and types[0] == "Navbar" and types[-1] == "Footer") else 0

    return {
        "section_count": n, "has_navbar": 1 if "Navbar" in types else 0,
        "has_footer": 1 if "Footer" in types else 0, "has_hero": 1 if "Hero" in types else 0,
        "cta_count": cta, "text_section_count": text_secs, "gallery_count": galleries,
        "heading_hierarchy_valid": 1 if (h1 == 1 and h2 >= 1) else 0,
        "avg_text_length": round(avg_text, 1), "image_count": images,
        "image_alt_coverage": round((images_with_alt / images) if images else 1.0, 3),
        "min_contrast": round(min_c, 2), "avg_contrast": round(avg_c, 2),
        "frac_low_contrast": round(frac_low, 3), "distinct_bg_colors": len(bg_colors),
        "distinct_fonts": len(fonts), "cta_above_fold": cta_above,
        "duplicate_heading_ratio": round(dup_ratio, 3), "empty_prop_ratio": round((empty / n) if n else 0, 3),
        "structural_order_valid": order_valid,
        "_h1": h1, "_h2": h2, "_contrast_fixes": contrast_fixes,
    }


def to_vector(raw):
    return [
        _clamp01(raw["section_count"] / 12.0),
        float(raw["has_navbar"]), float(raw["has_footer"]), float(raw["has_hero"]),
        _clamp01(raw["cta_count"] / 4.0),
        _clamp01(raw["text_section_count"] / 5.0),
        _clamp01(raw["gallery_count"] / 3.0),
        float(raw["heading_hierarchy_valid"]),
        _clamp01(raw["avg_text_length"] / 120.0),
        _clamp01(raw["image_count"] / 8.0),
        float(raw["image_alt_coverage"]),
        _clamp01(raw["min_contrast"] / 7.0),
        _clamp01(raw["avg_contrast"] / 7.0),
        float(raw["frac_low_contrast"]),
        _clamp01(raw["distinct_bg_colors"] / 6.0),
        _clamp01(raw["distinct_fonts"] / 4.0),
        float(raw["cta_above_fold"]),
        float(raw["duplicate_heading_ratio"]),
        float(raw["empty_prop_ratio"]),
        float(raw["structural_order_valid"]),
    ]


# Actionable flaw checks (independent of the AE, so users always get specifics)
def flaws(raw):
    out = []
    def add(key, label, severity, hint):
        out.append({"key": key, "label": label, "severity": severity, "hint": hint})

    if raw["_h1"] == 0:
        add("no_h1", "Missing H1", "high", "Add a clear hero heading — it's the page's primary H1.")
    elif raw["_h1"] > 1:
        add("multi_h1", "Multiple H1s", "medium", "Use only one hero heading (H1) per page.")
    if raw["_h2"] == 0:
        add("no_h2", "No section headings", "medium", "Add H2 headings to structure the page.")
    if not raw["has_footer"]:
        add("no_footer", "No footer", "low", "Add a footer for navigation, links, and credibility.")
    if raw["frac_low_contrast"] > 0:
        add("low_contrast", "Low contrast text", "low",
            "Some solid-background sections have borderline text contrast — one click can fix it.")
    if not raw["cta_above_fold"]:
        add("cta_buried", "CTA not near the top", "medium", "Place a call-to-action within the first sections.")
    if raw["distinct_fonts"] > 2:
        add("too_many_fonts", "Too many fonts", "low", "Limit to 1–2 typefaces for a cohesive look.")
    if raw["duplicate_heading_ratio"] > 0:
        add("dup_headings", "Duplicate headings", "low", "Make each section heading unique.")
    if raw["empty_prop_ratio"] > 0.15:
        add("empty_sections", "Empty sections", "medium", "Some sections have little or no text content.")
    if not raw["structural_order_valid"]:
        add("structure_order", "Unusual structure", "low", "Pages usually start with a navbar and end with a footer.")
    if raw["image_count"] > 0 and raw["image_alt_coverage"] < 0.8:
        add("missing_alt", "Missing image alt text", "medium", "Add descriptive titles/alt text to images.")
    return out
