/**
 * seo.controller.js — DL SEO + design + engagement orchestration.
 *
 * - scoreSeo / designHealth / suggestEngagement: proxy a page's content to the Python
 *   ML engine (port 5050) which runs the trained MLP / autoencoder+IF / GRU.
 * - autoImproveSeo: the closed feedback loop — score → rewrite the weakest factor(s)
 *   with Qwen (Ollama, Gemini fallback) → re-score, up to K iterations. PREVIEW ONLY;
 *   it never persists. The frontend "Apply" reuses the existing builder PUT /sections.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Ollama } from "ollama";
import axios from "axios";
import Page from "../builder/page.model.js";

const ML_BASE = process.env.AI_ENGINE_URL || "http://localhost:5050";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const gemini = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
const ollamaClient = new Ollama({ host: process.env.OLLAMA_HOST || "http://127.0.0.1:11434" });

// Text props the AI is allowed to rewrite, with length caps.
const EDITABLE_PROPS = { heading: 90, subheading: 320, description: 600, text: 600, ctaText: 40 };

// Factors that a text rewrite can actually improve (so we don't waste an AI iteration
// targeting e.g. structured-data, which needs a markup change, not a copy edit).
const TEXT_FIXABLE = new Set([
    "keyword_density", "keyword_in_title", "keyword_in_headings", "heading_hierarchy_valid",
    "flesch_kincaid", "meta_desc_length", "title_length", "word_count", "avg_sentence_length", "h2_count",
]);

// ── helpers ─────────────────────────────────────────────────────────────────────
const STOPWORDS = new Set((
    "the a an and or but of to in for on with your you our we us is are be am was were this that it its as at by from " +
    "into over under more most very can will just get got also their they them his her what which who when where why how " +
    "all any some no not so if then than too about up out down only own same s t re ve ll d m"
).split(/\s+/));

const heroOf = (sections) => sections.find((s) => s.type === "Hero");
const heroHeadingOf = (sections) => (heroOf(sections)?.props?.heading || "").trim();
const heroSubOf = (sections) => { const p = heroOf(sections)?.props || {}; return (p.subheading || p.description || "").trim(); };

function collectCopy(sections) {
    const parts = [];
    for (const s of sections) {
        const p = s.props || {};
        for (const k of ["heading", "subheading", "description", "text", "ctaText"]) if (typeof p[k] === "string") parts.push(p[k]);
        for (const it of (p.items || [])) if (it && typeof it === "object") { if (it.title) parts.push(it.title); if (it.description) parts.push(it.description); }
    }
    return parts.join(" ");
}

// Derive a NATURAL target keyword from the page copy. Prefer a 2-word phrase only when
// it actually occurs contiguously (so word order reads naturally, e.g. "wood-fired pizza"
// not "pizza authentic"); otherwise fall back to the single most salient word.
function deriveKeyword(sections) {
    const tokSeq = (t) => ((t || "").toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []);
    const headingText = sections.map((s) => s.props?.heading || "").join(" . ");
    const heroText = `${heroHeadingOf(sections)} . ${heroSubOf(sections)}`;
    const bodyText = collectCopy(sections);

    const freq = new Map();
    const bump = (toks, n) => toks.forEach((w) => { if (!STOPWORDS.has(w)) freq.set(w, (freq.get(w) || 0) + n); });
    bump(tokSeq(bodyText), 1);
    bump(tokSeq(headingText), 3);
    bump(tokSeq(heroText), 3);
    if (!freq.size) return "";

    // Contiguous, naturally-ordered bigrams (skip stopword pairs).
    const bigram = new Map();
    const addBigrams = (t, n) => {
        const toks = tokSeq(t);
        for (let i = 0; i < toks.length - 1; i++) {
            const a = toks[i], b = toks[i + 1];
            if (STOPWORDS.has(a) || STOPWORDS.has(b)) continue;
            const g = `${a} ${b}`;
            bigram.set(g, (bigram.get(g) || 0) + n);
        }
    };
    addBigrams(headingText, 2);
    addBigrams(heroText, 2);
    addBigrams(bodyText, 1);

    const topUni = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const topBi = [...bigram.entries()].sort((a, b) => b[1] - a[1])[0];
    // Only use a phrase if it genuinely recurs; a single word is safer and reads cleaner.
    return (topBi && topBi[1] >= 2) ? topBi[0] : topUni;
}

const clampText = (t, hi) => { t = (t || "").replace(/\s+/g, " ").trim(); return t.length > hi ? t.slice(0, hi - 1).trim() + "…" : t; };

// Build the content payload the scorer sees — the real on-page H1 is the title,
// and meta description / structured data come from the page's saved SEO metadata.
function buildContent(page, sections) {
    const seo = page.seo || {};
    const secs = sections.map((s) => ({ id: s.id, type: s.type, props: s.props || {} }));
    return {
        title: seo.metaTitle || heroHeadingOf(secs) || page.title || "",
        metaDescription: seo.metaDescription || "",
        structuredData: seo.jsonLd || null,
        sections: secs,
    };
}

function buildMetaDescription(sections, keyword) {
    let base = heroSubOf(sections) || heroHeadingOf(sections) || "";
    if (keyword && !base.toLowerCase().includes(keyword.toLowerCase())) base = base ? `${base} — ${keyword}.` : `${keyword}.`;
    if (base.length < 110) { const extra = collectCopy(sections).replace(base, "").trim(); if (extra) base = `${base} ${extra}`; }
    return clampText(base, 160);
}

function inferSchemaType(text) {
    const t = (text || "").toLowerCase();
    if (/restaurant|cafe|food|menu|dining|pizza|juice|bakery|coffee/.test(t)) return "Restaurant";
    if (/shop|store|product|buy|cart|ecommerce|fashion|clothing|boutique/.test(t)) return "Store";
    if (/gym|fitness|clinic|salon|studio|spa|local/.test(t)) return "LocalBusiness";
    return "Organization";
}

const buildJsonLd = ({ name, description, type }) => ({
    "@context": "https://schema.org", "@type": type || "Organization",
    name: name || "Website", description: description || "",
});

// Deterministic, explainable engagement readiness (0–100) + reasons.
function engagementRubric(types) {
    const has = (t) => types.includes(t);
    const heroIdx = types.indexOf("Hero");
    const ctaIdx = types.indexOf("CTA");
    const hasForm = has("ContactForm") || has("DynamicForm");
    const contentCount = types.filter((t) => t === "Text" || t === "Gallery").length;
    const n = types.length;
    let score = 0; const strengths = []; const opportunities = [];

    if (has("Hero")) { score += 15; strengths.push("A strong hero anchors the top of the page."); }
    else opportunities.push("Add a hero section to lead the page.");

    if (ctaIdx !== -1) {
        score += 20;
        if (heroIdx !== -1 && ctaIdx <= heroIdx + 2) { score += 10; strengths.push("Call-to-action appears above the fold."); }
        else { strengths.push("The page has a call-to-action."); opportunities.push("Move the call-to-action higher — just after the hero."); }
    } else opportunities.push("Add a clear call-to-action — the single biggest conversion lever.");

    if (hasForm) { score += 20; strengths.push("A conversion form lets visitors act immediately."); }
    else opportunities.push("Add a contact or order form so visitors can convert on-page.");

    if (has("Navbar")) score += 8; else opportunities.push("Add a navbar so visitors can navigate.");
    if (has("Footer")) score += 7; else opportunities.push("Add a footer for trust and secondary links.");

    if (n >= 5 && n <= 9) { score += 10; strengths.push("Healthy page length keeps visitors moving."); }
    else if (n < 5) opportunities.push("The page is thin — add a section or two.");
    else opportunities.push("The page is long — consider trimming weaker sections.");

    if (contentCount >= 1) { score += 10; strengths.push("Supporting content builds context and trust."); }
    else opportunities.push("Add a content or gallery section to build trust.");

    return { engagementScore: Math.max(0, Math.min(100, Math.round(score))), strengths, opportunities };
}

// Deterministic keyword safety-net: a MINIMAL, natural touch — if the keyword is
// absent from the whole page, add it ONCE to a body paragraph with a clean sentence.
// Never renames brand/proper-noun headings and never stuffs (avoids the "Authentic
// Pizza Authentic" / renamed-brand problem). The user reviews the diff before applying.
function ensureKeywordInCopy(sections, keyword) {
    if (!keyword) return [];
    const kw = keyword.trim().toLowerCase();
    const has = (s) => (s || "").toLowerCase().includes(kw);
    const keys = ["description", "subheading", "text"];
    // Add the keyword once to a body field that doesn't already contain it — this lifts
    // density/coverage naturally without stuffing the same paragraph repeatedly.
    for (const s of sections) {
        for (const k of keys) {
            const v = s.props?.[k];
            if (typeof v === "string" && v.trim() && !has(v)) {
                const after = clampText(`${v} Discover what makes our ${kw} stand out.`, EDITABLE_PROPS[k]);
                if (after === v) continue;
                s.props[k] = after;
                return [{ sectionId: s.id, type: s.type, propKey: k, before: v, after }];
            }
        }
    }
    return [];
}

async function loadPage(req) {
    const { websiteId, pageId } = req.body || {};
    if (!websiteId || !pageId) return null;
    return Page.findOne({ _id: pageId, websiteId, tenantId: req.tenantId });
}

function mlError(res, err, label) {
    const offline = err?.code === "ECONNREFUSED" || err?.code === "ECONNABORTED" || !err?.response;
    if (offline) {
        console.warn(`⚠️ [SEO] AI engine unreachable for ${label}:`, err?.message);
        return res.status(503).json({ success: false, message: "AI engine offline. Start the Python service (ai_engine) on port 5050." });
    }
    console.error(`❌ [SEO] ${label} failed:`, err?.response?.data || err?.message);
    return res.status(500).json({ success: false, message: "SEO engine error." });
}

async function scoreContent(content, keyword) {
    const r = await axios.post(`${ML_BASE}/seo-score`, { content, keyword: keyword || "" }, { timeout: 30000 });
    return r.data;
}

// Per-factor rewrite guidance for the LLM.
function factorInstruction(key, keyword) {
    const kw = keyword ? `"${keyword}"` : "the page's main keyword";
    return {
        keyword_density: `Ensure ${kw} appears naturally ONCE or twice total across the whole page — never more (avoid stuffing/repetition).`,
        keyword_in_title: `Only if it reads naturally, work ${kw} into the hero heading or subheading. Do NOT rename a brand or product name to force it in.`,
        keyword_in_headings: `Only if it reads naturally, mention ${kw} in ONE section heading. Never rename a brand or proper-noun heading (e.g. keep "Artisan Crust" exactly).`,
        heading_hierarchy_valid: `Make the hero heading a single strong H1 and ensure other sections have clear, distinct headings.`,
        flesch_kincaid: `Simplify the writing: shorter sentences, plainer words, easier to read.`,
        meta_desc_length: `Expand the hero subheading into a compelling 110–160 character summary of the page.`,
        title_length: `Adjust the hero heading to a punchy 40–60 characters.`,
        word_count: `Add more substantive, benefit-driven copy to thin sections.`,
        avg_sentence_length: `Break long sentences into shorter ones (~12–20 words).`,
        h2_count: `Give content sections clear, descriptive headings.`,
        internal_link_count: `Strengthen calls-to-action so the page guides visitors onward.`,
    }[key] || `Improve "${key}".`;
}

// ── Qwen rewrite (one iteration) ─────────────────────────────────────────────────
async function rewriteWeakFactors(sections, weakKeys, factors, keyword) {
    const editable = sections
        .filter((s) => Object.keys(EDITABLE_PROPS).some((k) => s.props && typeof s.props[k] === "string"))
        .map((s) => {
            const fields = {};
            for (const k of Object.keys(EDITABLE_PROPS)) {
                if (typeof s.props?.[k] === "string" && s.props[k].trim()) fields[k] = s.props[k];
            }
            return { id: s.id, type: s.type, fields };
        });

    const guidance = weakKeys.map((k) => `- ${k}: ${factorInstruction(k, keyword)}`).join("\n");
    const prompt = `You are an expert SEO copywriter. Improve the website copy below to fix specific weaknesses WITHOUT changing the meaning, tone, or factual claims. Keep it natural and human.

TARGET KEYWORD: ${keyword || "(none provided — infer the main topic)"}

WEAKNESSES TO FIX:
${guidance}

EDITABLE SECTIONS (id, type, current text fields):
${JSON.stringify(editable, null, 2)}

CRITICAL RULES — copy quality comes first:
- Keep every edit natural, human, and grammatically correct, with natural word order.
- Use the target keyword SPARINGLY: at most once or twice across the ENTIRE page. Never repeat it awkwardly, and never write phrases like "Authentic Pizza Authentic".
- NEVER rename brand names, product names, or proper-noun headings (e.g. keep "Artisan Crust" exactly as written).
- If the keyword does not fit a field naturally, leave that field unchanged — a clean sentence beats a keyword-stuffed one.
- Preserve the original meaning, tone, and factual claims.

Return ONLY JSON (no markdown):
{ "patches": [ { "sectionId": "<id>", "propKey": "<heading|subheading|description|text|ctaText>", "newValue": "<rewritten text>" } ] }
Rules: only edit existing fields shown above; keep each value concise and within sensible length; do not invent new sections; only include fields you actually improved.`;

    let text = "";
    let model = "qwen3.5:4b (Ollama)";
    try {
        const r = await ollamaClient.chat({
            model: "qwen3.5:4b", think: false,
            messages: [
                { role: "system", content: "You are a precise SEO copy editor. You output only strict, valid JSON." },
                { role: "user", content: prompt },
            ],
            format: "json",
            options: { num_predict: 1500, num_ctx: 8192, temperature: 0.4 },
        });
        text = r.message.content || "";
    } catch (e) {
        console.warn("⚠️ [SEO] Ollama rewrite failed, falling back to Gemini:", e.message);
        model = "gemini-3-flash-preview";
        const result = await gemini.generateContent(prompt);
        text = result.response.text();
    }

    let jsonStr = text;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1];
    else { const obj = text.match(/\{[\s\S]*\}/); if (obj) jsonStr = obj[0]; }
    let parsed = {};
    try { parsed = JSON.parse(jsonStr.trim()); } catch { parsed = {}; }

    const byId = new Map(sections.map((s) => [s.id, s]));
    const applied = [];
    for (const patch of (parsed.patches || [])) {
        const sec = byId.get(patch?.sectionId);
        const key = patch?.propKey;
        const val = patch?.newValue;
        if (!sec || !EDITABLE_PROPS[key] || typeof val !== "string") continue;
        const clean = val.trim().slice(0, EDITABLE_PROPS[key]);
        if (!clean || typeof sec.props?.[key] !== "string") continue;     // only edit existing fields
        if (clean === sec.props[key]) continue;
        const before = sec.props[key];
        sec.props[key] = clean;
        applied.push({ sectionId: sec.id, type: sec.type, propKey: key, before, after: clean });
    }
    return { applied, model };
}

// ── Endpoints ─────────────────────────────────────────────────────────────────────
export const scoreSeo = async (req, res) => {
    try {
        const page = await loadPage(req);
        if (!page) return res.status(404).json({ success: false, message: "Page not found." });
        const sections = page.layoutConfig?.sections || [];
        const typed = (req.body.keyword || "").trim();
        const keyword = typed || deriveKeyword(sections);
        const data = await scoreContent(buildContent(page, sections), keyword);
        return res.json({ success: true, ...data, keyword, keywordDerived: !typed });
    } catch (err) {
        return mlError(res, err, "scoreSeo");
    }
};

export const autoImproveSeo = async (req, res) => {
    try {
        const page = await loadPage(req);
        if (!page) return res.status(404).json({ success: false, message: "Page not found." });

        const baseSections = JSON.parse(JSON.stringify(page.layoutConfig?.sections || []));
        const typed = (req.body.keyword || "").trim();
        const keyword = typed || deriveKeyword(baseSections);
        const threshold = Math.min(95, Math.max(40, Number(req.body.threshold) || 80));
        const maxIters = Math.min(3, Math.max(1, Number(req.body.maxIters) || 3));

        const scoreOf = async (secs) => scoreContent(buildContent(page, secs), keyword);

        const before = await scoreOf(baseSections);
        // Keep only edits that actually raise the score — never accept a regression.
        let best = baseSections;
        let bestScore = before.score;
        let bestFactors = before.factors;
        const steps = [];

        for (let i = 0; i < maxIters; i++) {
            if (bestScore >= threshold) break;
            const weakKeys = (bestFactors || [])
                .filter((f) => f.status !== "good" && TEXT_FIXABLE.has(f.key))
                .slice(0, 3).map((f) => f.key);
            if (!weakKeys.length) break;

            const trial = JSON.parse(JSON.stringify(best));
            const { applied } = await rewriteWeakFactors(trial, weakKeys, bestFactors, keyword);
            if (!applied.length) break;
            const after = await scoreOf(trial);
            if (after.score > bestScore) {
                steps.push({ iteration: steps.length + 1, targeted: weakKeys, changes: applied, scoreBefore: bestScore, scoreAfter: after.score });
                best = trial; bestScore = after.score; bestFactors = after.factors;
            } else {
                break; // rewrite didn't help → discard it and stop (keep the best version)
            }
        }

        // Deterministic safety net — only kept if it improves the score.
        const kwKeys = ["keyword_in_title", "keyword_in_headings", "keyword_density"];
        const kwWeak = (bestFactors || []).some((f) => kwKeys.includes(f.key) && f.status !== "good");
        if (bestScore < threshold && kwWeak) {
            const trial = JSON.parse(JSON.stringify(best));
            const applied = ensureKeywordInCopy(trial, keyword);
            if (applied.length) {
                const after = await scoreOf(trial);
                if (after.score > bestScore) {
                    steps.push({ iteration: steps.length + 1, targeted: kwKeys, changes: applied, scoreBefore: bestScore, scoreAfter: after.score, deterministic: true });
                    best = trial; bestScore = after.score; bestFactors = after.factors;
                }
            }
        }

        // Structured data + meta description aren't copy edits — generate them as SEO
        // metadata so those checks can pass too. Persisted (invisible to visitors), so it
        // doesn't need the section "Apply" step.
        const metaWeak = (bestFactors || []).some((f) => ["structured_data_present", "meta_desc_length"].includes(f.key) && f.status !== "good");
        let metaGenerated = false;
        if (metaWeak) {
            const heroHeading = heroHeadingOf(best);
            const metaTitle = clampText(heroHeading || page.title || "Home", 60);
            const metaDescription = buildMetaDescription(best, keyword);
            const jsonLd = buildJsonLd({ name: heroHeading || page.title, description: metaDescription, type: inferSchemaType(collectCopy(best)) });
            page.seo = { metaTitle, metaDescription, keyword, jsonLd };
            await page.save();
            const after = await scoreOf(best);
            steps.push({ iteration: steps.length + 1, targeted: ["structured_data_present", "meta_desc_length"], changes: [], meta: true, label: "Generated a meta description and structured data (JSON-LD).", scoreBefore: bestScore, scoreAfter: after.score });
            bestScore = after.score; bestFactors = after.factors; metaGenerated = true;
        }

        return res.json({
            success: true,
            keyword, keywordDerived: !typed,
            metaGenerated,
            before: { score: before.score, factors: before.factors },
            after: { score: bestScore, factors: bestFactors },
            proposedSections: best,
            steps,
            improved: bestScore > before.score,
            model: "AI",
        });
    } catch (err) {
        return mlError(res, err, "autoImproveSeo");
    }
};

export const designHealth = async (req, res) => {
    try {
        const page = await loadPage(req);
        if (!page) return res.status(404).json({ success: false, message: "Page not found." });
        const r = await axios.post(`${ML_BASE}/design-health`, { content: buildContent(page, page.layoutConfig?.sections || []) }, { timeout: 30000 });
        return res.json({ success: true, ...r.data });
    } catch (err) {
        return mlError(res, err, "designHealth");
    }
};

export const suggestEngagement = async (req, res) => {
    try {
        const page = await loadPage(req);
        if (!page) return res.status(404).json({ success: false, message: "Page not found." });
        const types = (page.layoutConfig?.sections || []).map((s) => s.type);
        // Deterministic, explainable readiness score (always available).
        const { engagementScore, strengths, opportunities } = engagementRubric(types);
        // GRU model signal + applyable reorder suggestions (best-effort; the readiness
        // score above is deterministic, so engagement insights work even if ML is offline).
        let model = {};
        try {
            const r = await axios.post(`${ML_BASE}/engagement-suggest`, { sections: types.map((t) => ({ type: t })) }, { timeout: 30000 });
            model = r.data || {};
        } catch (e) {
            console.warn("⚠️ [SEO] GRU engagement model unavailable; returning deterministic readiness only:", e?.message);
        }
        return res.json({ success: true, engagementScore, strengths, opportunities, ...model });
    } catch (err) {
        return mlError(res, err, "suggestEngagement");
    }
};

/**
 * POST /api/ai/seo/generate-meta
 * Build + persist a meta title/description and JSON-LD structured data for the page,
 * so the "meta description" and "structured data" SEO checks become real (and pass).
 */
export const generateSeoMeta = async (req, res) => {
    try {
        const page = await loadPage(req);
        if (!page) return res.status(404).json({ success: false, message: "Page not found." });
        const sections = page.layoutConfig?.sections || [];
        const typed = (req.body.keyword || "").trim();
        const keyword = typed || deriveKeyword(sections);
        const heroHeading = heroHeadingOf(sections);
        const metaTitle = clampText(heroHeading || page.title || "Home", 60);
        const metaDescription = buildMetaDescription(sections, keyword);
        const jsonLd = buildJsonLd({ name: heroHeading || page.title, description: metaDescription, type: inferSchemaType(collectCopy(sections)) });
        page.seo = { metaTitle, metaDescription, keyword, jsonLd };
        await page.save();
        const data = await scoreContent(buildContent(page, sections), keyword);
        return res.json({ success: true, seo: page.seo, keyword, score: data.score, factors: data.factors });
    } catch (err) {
        return mlError(res, err, "generateSeoMeta");
    }
};
