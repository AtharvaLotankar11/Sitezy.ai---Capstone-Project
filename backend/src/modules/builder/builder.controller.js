import Page from "./page.model.js";
import Website from "../website/website.model.js";
import Commit from "./commit.model.js";
import { logActivity } from "../../middleware/logger.middleware.js";
import { v4 as uuidv4 } from "uuid";

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
