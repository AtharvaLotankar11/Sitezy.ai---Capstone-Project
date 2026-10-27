import Page from "./page.model.js";
import Website from "../website/website.model.js";
import Commit from "./commit.model.js";
import { logActivity } from "../../middleware/logger.middleware.js";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Ollama } from "ollama";

const _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const _gemini = _genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
const _ollama = new Ollama({ host: process.env.OLLAMA_HOST || "http://127.0.0.1:11434" });

const _slugify = (s) => String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "page";

// Build {label,url} nav links for the full set of pages (home first).
function buildNavLinks(pages) {
    return [...pages]
        .sort((a, b) => (b.isHomePage ? 1 : 0) - (a.isHomePage ? 1 : 0))
        .map((p) => ({ label: p.title, url: p.isHomePage ? "/" : `/${p.slug}` }));
}

// Ask the model to pick the best existing page to base the new one on, and write
// fresh copy for its key text fields. Qwen first, Gemini fallback, heuristic last.
async function aiChoosePageTemplate(title, candidates) {
    const prompt = `A user is adding a new page titled "${title}" to their website. Pick which existing page's layout is the best starting template, and write fresh copy for the new page.

Existing pages (slug — section types):
${candidates.map((c) => `- ${c.slug}${c.isHomePage ? " (home)" : ""} — [${c.sectionTypes.join(", ")}]`).join("\n")}

Return ONLY JSON (no markdown):
{ "sourceSlug": "<slug of the page to clone>", "heroHeading": "<headline for the new page>", "heroSubheading": "<one-line subheading>", "textHeading": "<a section heading>", "textBody": "<2-3 sentence paragraph for the new page>" }`;
    let text = "";
    try {
        const r = await _ollama.chat({
            model: "qwen3.5:4b", think: false,
            messages: [{ role: "system", content: "You output only strict valid JSON." }, { role: "user", content: prompt }],
            format: "json", options: { num_predict: 600, temperature: 0.5 },
        });
        text = r.message?.content || "";
    } catch {
        try { const r = await _gemini.generateContent(prompt); text = r.response.text(); } catch { /* heuristic fallback */ }
    }
    try {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]);
    } catch { /* ignore */ }
    return null;
}

/**
 * POST /api/builder/websites/:websiteId/pages/ai
 * Add a new page whose layout is chosen by AI (cloned from the most suitable existing
 * page) with fresh AI copy, and auto-link it into every page's navbar.
 */
export const addAiPage = async (req, res) => {
    const website = await Website.findOne({ _id: req.params.websiteId, ...req.tenantFilter }).lean();
    if (!website) return res.status(404).json({ success: false, message: "Website not found" });

    const title = (req.body.title || "").trim();
    if (!title) return res.status(400).json({ success: false, message: "Page title is required" });

    const pages = await Page.find({ websiteId: website._id, tenantId: req.tenantId });
    if (!pages.length) return res.status(400).json({ success: false, message: "Create the site first, then add pages." });

    // unique slug
    let base = _slugify(title), slug = base, n = 1;
    while (pages.some((p) => p.slug === slug)) slug = `${base}-${++n}`;

    // choose a source template + copy via AI (best-effort)
    const candidates = pages.map((p) => ({ slug: p.slug, isHomePage: p.isHomePage, sectionTypes: (p.layoutConfig?.sections || []).map((s) => s.type) }));
    const ai = await aiChoosePageTemplate(title, candidates);

    const source = pages.find((p) => p.slug === ai?.sourceSlug)
        || pages.find((p) => !p.isHomePage)
        || pages.find((p) => p.isHomePage)
        || pages[0];

    // clone the source layout with fresh section ids
    const sections = JSON.parse(JSON.stringify(source.layoutConfig?.sections || []));
    let heroDone = false, textDone = false;
    for (const s of sections) {
        s.id = uuidv4();
        const p = s.props || (s.props = {});
        if (s.type === "Hero" && !heroDone) {
            if (ai?.heroHeading) p.heading = ai.heroHeading; else p.heading = title;
            if (ai?.heroSubheading) p.subheading = ai.heroSubheading;
            heroDone = true;
        } else if (s.type === "Text" && !textDone) {
            if (ai?.textHeading) p.heading = ai.textHeading;
            if (ai?.textBody) p.description = ai.textBody;
            textDone = true;
        }
    }

    // the new page exists now → recompute nav links for ALL pages and apply everywhere
    const allMeta = [...pages.map((p) => ({ title: p.title, slug: p.slug, isHomePage: p.isHomePage })), { title, slug, isHomePage: false }];
    const navLinks = buildNavLinks(allMeta);
    const applyNav = (secs) => { const nav = (secs || []).find((s) => s.type === "Navbar"); if (nav) { nav.props = nav.props || {}; nav.props.links = navLinks; } };
    applyNav(sections);

    const page = await Page.create({
        tenantId: req.tenantId, websiteId: website._id, title, slug, isHomePage: false,
        layoutConfig: { sections }, createdBy: req.user._id,
    });

    // update every existing page's navbar so the new page appears site-wide
    for (const p of pages) {
        applyNav(p.layoutConfig?.sections);
        p.markModified("layoutConfig");
        await p.save();
    }

    await logActivity({ tenantId: req.tenantId, userId: req.user._id, action: "PAGE_CREATED", resource: "Page", resourceId: page._id, details: { title, slug, ai: !!ai }, ip: req.ip }).catch(() => {});

    res.status(201).json({ success: true, page });
};

/**
 * GET /api/builder/websites/:websiteId/pages
 */
export const getPages = async (req, res) => {
    // Verify website belongs to tenant
    const website = await Website.findOne({ _id: req.params.websiteId, ...req.tenantFilter }).lean();
    if (!website) return res.status(404).json({ success: false, message: "Website not found" });

    const pages = await Page.find({ websiteId: website._id, tenantId: req.tenantId })
        .select("-__v")
        .lean();
    res.json({ success: true, pages });
};

/**
 * GET /api/builder/websites/:websiteId/pages/:pageId
 */
export const getPage = async (req, res) => {
    const page = await Page.findOne({
        _id: req.params.pageId,
        websiteId: req.params.websiteId,
        ...req.tenantFilter,
    }).lean();
    if (!page) return res.status(404).json({ success: false, message: "Page not found" });
    res.json({ success: true, page });
};

/**
 * POST /api/builder/websites/:websiteId/pages
 */
export const createPage = async (req, res) => {
    const website = await Website.findOne({ _id: req.params.websiteId, ...req.tenantFilter }).lean();
    if (!website) return res.status(404).json({ success: false, message: "Website not found" });

    const { title, slug, isHomePage } = req.body;
    if (!title || !slug) {
        return res.status(400).json({ success: false, message: "title and slug are required" });
    }

    const existing = await Page.findOne({
        websiteId: website._id,
        slug,
        tenantId: req.tenantId,
    });
    if (existing) {
        return res.status(409).json({ success: false, message: "Page slug already exists for this website" });
    }

    const page = await Page.create({
        tenantId: req.tenantId,
        websiteId: website._id,
        title,
        slug,
        isHomePage: isHomePage || false,
        layoutConfig: { sections: [] },
        createdBy: req.user._id,
    });

    await logActivity({
        tenantId: req.tenantId,
        userId: req.user._id,
        action: "PAGE_CREATED",
        resource: "Page",
        resourceId: page._id,
        details: { title, slug },
        ip: req.ip,
    });

    res.status(201).json({ success: true, page });
};

/**
 * DELETE /api/builder/websites/:websiteId/pages/:pageId
 */
export const deletePage = async (req, res) => {
    const page = await Page.findOne({
        _id: req.params.pageId,
        websiteId: req.params.websiteId,
        ...req.tenantFilter,
    });
    if (!page) return res.status(404).json({ success: false, message: "Page not found" });

    if (page.isHomePage) {
        return res.status(400).json({ success: false, message: "Cannot delete homepage" });
    }

    await page.deleteOne();

    await logActivity({
        tenantId: req.tenantId,
        userId: req.user._id,
        action: "PAGE_DELETED",
        resource: "Page",
        resourceId: page._id,
        ip: req.ip,
    });

    res.json({ success: true, message: "Page deleted" });
};

/**
 * PUT /api/builder/websites/:websiteId/pages/:pageId/sections
 * Replace entire sections array (drag-reorder + edit)
 */
export const updateSections = async (req, res) => {
    const { sections } = req.body;
    if (!Array.isArray(sections)) {
        return res.status(400).json({ success: false, message: "sections must be an array" });
    }

    const validTypes = ["Hero", "Text", "Gallery", "CTA", "ContactForm", "DynamicForm", "Navbar", "Footer", "Button", "Image", "Spacer"];
    for (const section of sections) {
        if (!validTypes.includes(section.type)) {
            return res.status(400).json({ success: false, message: `Invalid section type: ${section.type}` });
        }
        if (!section.id) section.id = uuidv4();
    }

    const page = await Page.findOneAndUpdate(
        { _id: req.params.pageId, websiteId: req.params.websiteId, ...req.tenantFilter },
        { $set: { "layoutConfig.sections": sections, status: "draft" } },
        { new: true }
    );

    if (!page) return res.status(404).json({ success: false, message: "Page not found" });

    await logActivity({
        tenantId: req.tenantId,
        userId: req.user._id,
        action: "SECTIONS_UPDATED",
        resource: "Page",
        resourceId: page._id,
        ip: req.ip,
    });

    res.json({ success: true, page });
};

/**
 * PATCH /api/builder/websites/:websiteId/pages/:pageId/sections/:sectionId
 * Update props of a single section
 */
export const updateSectionProps = async (req, res) => {
    const { props } = req.body;

    const page = await Page.findOne({
        _id: req.params.pageId,
        websiteId: req.params.websiteId,
        ...req.tenantFilter,
    });

    if (!page) return res.status(404).json({ success: false, message: "Page not found" });

    const section = page.layoutConfig.sections.find((s) => s.id === req.params.sectionId);
    if (!section) return res.status(404).json({ success: false, message: "Section not found" });

    section.props = { ...section.props, ...props };
    page.status = "draft";
    await page.save();

    res.json({ success: true, page });
};

/**
 * POST /api/builder/websites/:websiteId/pages/:pageId/save-draft
 */
export const saveDraft = async (req, res) => {
    const { layoutConfig } = req.body;

    const page = await Page.findOneAndUpdate(
        { _id: req.params.pageId, websiteId: req.params.websiteId, ...req.tenantFilter },
        { $set: { layoutConfig, status: "draft" } },
        { new: true }
    );

    if (!page) return res.status(404).json({ success: false, message: "Page not found" });

    res.json({ success: true, page });
};

/**
 * POST /api/builder/websites/:websiteId/pages/:pageId/commit
 * Create a version snapshot (commit)
 */
export const commitPage = async (req, res) => {
    const { message } = req.body;
    if (!message?.trim()) {
        return res.status(400).json({ success: false, message: "Commit message is required" });
    }

    const page = await Page.findOne({
        _id: req.params.pageId,
        websiteId: req.params.websiteId,
        ...req.tenantFilter,
    }).lean();

    if (!page) return res.status(404).json({ success: false, message: "Page not found" });

    // Get next version number
    const lastCommit = await Commit.findOne({ pageId: page._id })
        .sort({ version: -1 })
        .lean();
    const version = lastCommit ? lastCommit.version + 1 : 1;

    const commit = await Commit.create({
        tenantId: req.tenantId,
        websiteId: page.websiteId,
        pageId: page._id,
        version,
        message: message.trim(),
        snapshot: {
            sections: page.layoutConfig?.sections || [],
        },
        committedBy: req.user._id,
        committedByName: req.user.name || "Unknown",
    });

    // Also update the page version field
    await Page.findByIdAndUpdate(page._id, { $set: { version } });

    await logActivity({
        tenantId: req.tenantId,
        userId: req.user._id,
        action: "PAGE_COMMITTED",
        resource: "Page",
        resourceId: page._id,
        details: { version, message: message.trim() },
        ip: req.ip,
    });

    res.status(201).json({ success: true, commit });
};

/**
 * GET /api/builder/websites/:websiteId/pages/:pageId/commits
 * Get all commits (version history) for a page
 */
export const getCommits = async (req, res) => {
    const page = await Page.findOne({
        _id: req.params.pageId,
        websiteId: req.params.websiteId,
        ...req.tenantFilter,
    }).lean();

    if (!page) return res.status(404).json({ success: false, message: "Page not found" });

    const commits = await Commit.find({ pageId: page._id })
        .sort({ version: -1 })
        .lean();

    res.json({ success: true, commits });
};

/**
 * POST /api/builder/websites/:websiteId/pages/:pageId/rollback/:commitId
 * Rollback a page to a specific commit's snapshot
 */
export const rollbackToCommit = async (req, res) => {
    const commit = await Commit.findOne({
        _id: req.params.commitId,
        pageId: req.params.pageId,
        tenantId: req.tenantId,
    }).lean();

    if (!commit) return res.status(404).json({ success: false, message: "Commit not found" });

    const page = await Page.findOneAndUpdate(
        { _id: req.params.pageId, websiteId: req.params.websiteId, ...req.tenantFilter },
        {
            $set: {
                "layoutConfig.sections": commit.snapshot.sections,
                status: "draft",
            },
        },
        { new: true }
    );

    if (!page) return res.status(404).json({ success: false, message: "Page not found" });

    await logActivity({
        tenantId: req.tenantId,
        userId: req.user._id,
        action: "PAGE_ROLLED_BACK",
        resource: "Page",
        resourceId: page._id,
        details: { toVersion: commit.version, commitMessage: commit.message },
        ip: req.ip,
    });

    res.json({ success: true, page, restoredFromVersion: commit.version });
};
