import Tenant from "./tenant.model.js";
import { logActivity } from "../../middleware/logger.middleware.js";

/**
 * GET /api/tenant
 * Get current tenant settings
 */
export const getTenant = async (req, res) => {
    const tenant = await Tenant.findById(req.tenantId).lean();
    res.json({ success: true, tenant });
};

/**
 * PUT /api/tenant/branding
 * OWNER updates branding (colors, font, logo)
 */
export const updateBranding = async (req, res) => {
    const { primaryColor, secondaryColor, font, logo } = req.body;

    // Basic contrast validation helper
    const validateColor = (hex) => /^#[0-9A-Fa-f]{6}$/.test(hex);

    if (primaryColor && !validateColor(primaryColor)) {
        return res.status(400).json({ success: false, message: "Invalid primaryColor hex format" });
    }
    if (secondaryColor && !validateColor(secondaryColor)) {
        return res.status(400).json({ success: false, message: "Invalid secondaryColor hex format" });
    }

    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    tenant.branding = {
        ...tenant.branding,
        ...(primaryColor && { primaryColor }),
        ...(secondaryColor && { secondaryColor }),
        ...(font && { font }),
        ...(logo !== undefined && { logo }),
    };
    await tenant.save();

    await logActivity({
        tenantId: req.tenantId,
        userId: req.user._id,
        action: "BRANDING_UPDATED",
        resource: "Tenant",
        resourceId: tenant._id,
        ip: req.ip,
    });

    res.json({ success: true, branding: tenant.branding });
};

/**
 * POST /api/tenant/logo
 * Upload tenant logo via multer
 */
export const uploadLogo = async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const logoUrl = `/uploads/${req.file.filename}`;
    const tenant = await Tenant.findById(req.tenantId);
    tenant.branding.logo = logoUrl;
    await tenant.save();

    res.json({ success: true, logo: logoUrl });
};
