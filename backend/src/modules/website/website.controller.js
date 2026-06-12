import Website from "./website.model.js";
import Page from "../builder/page.model.js";
import Deployment from "../deployment/deployment.model.js";
import { logActivity } from "../../middleware/logger.middleware.js";
import { createWebsiteSchema, updateWebsiteSchema } from "./website.validation.js";
import { websitePublishTotal, tenantWebsitesTotal } from "../../utils/metrics.js";
import slugify from "slugify";

/**
 * GET /api/websites
 */
export const getWebsites = async (req, res) => {
    const websites = await Website.find({ ...req.tenantFilter })
        .populate("createdBy", "name email")
        .lean();
    res.json({ success: true, websites });
};

/**
 * GET /api/websites/:id
 */
export const getWebsite = async (req, res) => {
    const website = await Website.findOne({ _id: req.params.id, ...req.tenantFilter })
        .populate("createdBy", "name email")
        .lean();
    if (!website) return res.status(404).json({ success: false, message: "Website not found" });
    res.json({ success: true, website });
};

/**
 * POST /api/websites
 */
export const createWebsite = async (req, res) => {
    const { error, value } = createWebsiteSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const baseSlug = slugify(value.name, { lower: true, strict: true }) || "site";
    const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    const website = await Website.create({
        ...value,
        slug: uniqueSlug,
        tenantId: req.tenantId,
        createdBy: req.user._id,
        defaultDomain: `${uniqueSlug}.${req.tenant.slug}.localhost`,
    });

    // Auto-create a homepage
    await Page.create({
        tenantId: req.tenantId,
        websiteId: website._id,
        title: "Home",
        slug: "home",
        isHomePage: true,
        layoutConfig: {
            sections: value.template ? value.template.map((s, i) => ({
                id: `section-${Date.now() + i}`,
                type: s.type,
                props: s.props,
                order: i,
            })) : [
                {
                    id: `section-${Date.now()}`,
                    type: "Navbar",
                    props: { brand: value.name, links: ["Home", "About", "Contact"] },
                    order: 0,
                },
                {
                    id: `section-${Date.now() + 1}`,
                    type: "Hero",
                    props: {
                        heading: `Welcome to ${value.name}`,
                        subheading: value.description || "Built with Sitezy.ai",
                        ctaText: "Get Started",
                        ctaLink: "#",
                    },
                    order: 1,
                },
                {
                    id: `section-${Date.now() + 2}`,
                    type: "Footer",
                    props: { text: `© ${new Date().getFullYear()} ${value.name}. All rights reserved.` },
                    order: 2,
                },
            ],
        },
        createdBy: req.user._id,
    });

    await logActivity({
        tenantId: req.tenantId,
        userId: req.user._id,
        action: "WEBSITE_CREATED",
        resource: "Website",
        resourceId: website._id,
        details: { name: website.name },
        ip: req.ip,
    });

    // Increment tenant websites counter
    tenantWebsitesTotal.inc({ tenantId: req.tenant?.name || req.tenantId.toString() });

    res.status(201).json({ success: true, website });
};

/**
 * PUT /api/websites/:id
 */
export const updateWebsite = async (req, res) => {
    const { error, value } = updateWebsiteSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const website = await Website.findOneAndUpdate(
        { _id: req.params.id, ...req.tenantFilter },
        { $set: value },
        { new: true }
    );
    if (!website) return res.status(404).json({ success: false, message: "Website not found" });

    res.json({ success: true, website });
};

/**
 * DELETE /api/websites/:id
 */
export const deleteWebsite = async (req, res) => {
    const website = await Website.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!website) return res.status(404).json({ success: false, message: "Website not found" });

    // Cascade delete pages
    await Page.deleteMany({ websiteId: website._id, tenantId: req.tenantId });
    await website.deleteOne();

    await logActivity({
        tenantId: req.tenantId,
        userId: req.user._id,
        action: "WEBSITE_DELETED",
        resource: "Website",
        resourceId: website._id,
        ip: req.ip,
    });

    res.json({ success: true, message: "Website deleted" });
};

/**
 * POST /api/websites/:id/publish
 * Clone layout → save snapshot in Deployments → mark published
 */
export const publishWebsite = async (req, res) => {
    const website = await Website.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!website) return res.status(404).json({ success: false, message: "Website not found" });

    const { domainId } = req.body || {};

    const pages = await Page.find({ websiteId: website._id, tenantId: req.tenantId }).lean();

    // Get last deployment version number
    const lastDeploy = await Deployment.findOne({ websiteId: website._id, tenantId: req.tenantId })
        .sort({ version: -1 })
        .lean();
    const version = lastDeploy ? lastDeploy.version + 1 : 1;

    await Deployment.create({
        tenantId: req.tenantId,
        websiteId: website._id,
        deployedBy: req.user._id,
        version,
        snapshot: pages,
        status: "success",
    });

    // Mark all pages as published
    await Page.updateMany(
        { websiteId: website._id, tenantId: req.tenantId },
        { $set: { status: "published" } }
    );

    website.status = "published";
    website.publishedAt = new Date();

    const Domain = (await import("../domain/domain.model.js")).default;
    let linkedDomain = null;

    if (domainId) {
        const domain = await Domain.findOne({ _id: domainId, tenantId: req.tenantId, verified: true });
        if (domain) {
            domain.websiteId = website._id;
            await domain.save();
            website.defaultDomain = domain.domain;
            linkedDomain = domain.domain;
        }
    } else {
        // Find default domain and map it if we are using the fallback
        const defaultDomainDoc = await Domain.findOne({ domain: website.defaultDomain, tenantId: req.tenantId });
        if (defaultDomainDoc) {
            defaultDomainDoc.websiteId = website._id;
            await defaultDomainDoc.save();
            linkedDomain = defaultDomainDoc.domain;
        }
    }

    await website.save();

    await logActivity({
        tenantId: req.tenantId,
        userId: req.user._id,
        action: "WEBSITE_PUBLISHED",
        resource: "Website",
        resourceId: website._id,
        details: { version, domain: linkedDomain },
        ip: req.ip,
    });

    // Increment website publish counter
    websitePublishTotal.inc({
        tenantId: req.tenant?.name || req.tenantId.toString(),
        websiteId: website.name || website._id.toString()
    });

    res.json({ success: true, message: "Website published", version, website, linkedDomain });
};

/**
 * GET /api/websites/:id/deployments
 * Version history
 */
export const getDeployments = async (req, res) => {
    // Verify website belongs to tenant
    const website = await Website.findOne({ _id: req.params.id, ...req.tenantFilter }).lean();
    if (!website) return res.status(404).json({ success: false, message: "Website not found" });

    const deployments = await Deployment.find({ websiteId: website._id, tenantId: req.tenantId })
        .populate("deployedBy", "name email")
        .sort({ version: -1 })
        .lean();

    res.json({ success: true, deployments });
};

/**
 * POST /api/websites/:id/rollback/:deploymentId
 */
export const rollback = async (req, res) => {
    const website = await Website.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!website) return res.status(404).json({ success: false, message: "Website not found" });

    const deployment = await Deployment.findOne({
        _id: req.params.deploymentId,
        websiteId: website._id,
        tenantId: req.tenantId,
    });
    if (!deployment) return res.status(404).json({ success: false, message: "Deployment not found" });

    // Restore snapshot pages
    await Page.deleteMany({ websiteId: website._id, tenantId: req.tenantId });
    const restoredPages = deployment.snapshot.map((p) => ({
        ...p,
        _id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
    }));
    await Page.insertMany(restoredPages);

    deployment.status = "rolled_back";
    await deployment.save();

    await logActivity({
        tenantId: req.tenantId,
        userId: req.user._id,
        action: "WEBSITE_ROLLED_BACK",
        resource: "Website",
        resourceId: website._id,
        details: { version: deployment.version },
        ip: req.ip,
    });

    res.json({ success: true, message: `Rolled back to version ${deployment.version}` });
};
