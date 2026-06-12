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
function pageToContent(page) {
    const sections = (page.layoutConfig?.sections || []).map((s) => ({
        id: s.id, type: s.type, props: s.props || {},
    }));
    return { title: page.title || "", sections };
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
        keyword_density: `Naturally weave ${kw} into the copy 2–3 times (no stuffing).`,
        keyword_in_title: `Include ${kw} in the hero heading (the page title).`,
        keyword_in_headings: `Mention ${kw} in at least one section heading.`,
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
        const data = await scoreContent(pageToContent(page), req.body.keyword);
        return res.json({ success: true, ...data });
    } catch (err) {
        return mlError(res, err, "scoreSeo");
    }
};

export const autoImproveSeo = async (req, res) => {
    try {
        const page = await loadPage(req);
        if (!page) return res.status(404).json({ success: false, message: "Page not found." });

        const keyword = (req.body.keyword || "").trim();
        const threshold = Math.min(95, Math.max(40, Number(req.body.threshold) || 75));
        const maxIters = Math.min(3, Math.max(1, Number(req.body.maxIters) || 3));

        let sections = JSON.parse(JSON.stringify(page.layoutConfig?.sections || []));
        const score = async () => scoreContent({ title: page.title, sections: sections.map((s) => ({ id: s.id, type: s.type, props: s.props })) }, keyword);

        const before = await score();
        let current = before;
        let model = "qwen3.5:4b (Ollama)";
        const steps = [];

        for (let i = 0; i < maxIters; i++) {
            if (current.score >= threshold) break;
            const weakKeys = (current.factors || [])
                .filter((f) => f.status !== "good" && TEXT_FIXABLE.has(f.key))
                .slice(0, 3).map((f) => f.key);
            if (!weakKeys.length) break;
            const { applied, model: usedModel } = await rewriteWeakFactors(sections, weakKeys, current.factors, keyword);
            model = usedModel;
            if (!applied.length) break;           // nothing changed → stop to avoid spinning
            const after = await score();
            steps.push({ iteration: i + 1, targeted: weakKeys, changes: applied, scoreBefore: current.score, scoreAfter: after.score });
            current = after;
        }

        return res.json({
            success: true,
            before: { score: before.score, factors: before.factors },
            after: { score: current.score, factors: current.factors },
            proposedSections: sections,
            steps,
            improved: current.score > before.score,
            model,
        });
    } catch (err) {
        return mlError(res, err, "autoImproveSeo");
    }
};

export const designHealth = async (req, res) => {
    try {
        const page = await loadPage(req);
        if (!page) return res.status(404).json({ success: false, message: "Page not found." });
        const r = await axios.post(`${ML_BASE}/design-health`, { content: pageToContent(page) }, { timeout: 30000 });
        return res.json({ success: true, ...r.data });
    } catch (err) {
        return mlError(res, err, "designHealth");
    }
};

export const suggestEngagement = async (req, res) => {
    try {
        const page = await loadPage(req);
        if (!page) return res.status(404).json({ success: false, message: "Page not found." });
        const sections = (page.layoutConfig?.sections || []).map((s) => ({ type: s.type }));
        const r = await axios.post(`${ML_BASE}/engagement-suggest`, { sections }, { timeout: 30000 });
        return res.json({ success: true, ...r.data });
    } catch (err) {
        return mlError(res, err, "suggestEngagement");
    }
};
