import express from "express";
import Joi from "joi";
import firebaseService from "../../agents/services/firebaseService.js";
import Website from "../website/website.model.js";
import { authenticateJWT } from "../../middleware/auth.middleware.js";

const router = express.Router();

/**
 * POST /api/public/forms/submit/:websiteId
 * Public endpoint for form submissions (no auth required)
 * Accepts ANY fields dynamically - no hardcoded schema
 */
router.post("/submit/:websiteId", async (req, res) => {
    try {
        const { websiteId } = req.params;
        const formData = req.body;

        // Minimal validation - just ensure we have some data
        if (!formData || Object.keys(formData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Form data is required",
            });
        }

        // Sanitize and validate each field dynamically
        const sanitizedData = {};
        for (const [key, value] of Object.entries(formData)) {
            // Skip empty values
            if (value === null || value === undefined || value === "") continue;

            // Basic type validation
            if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
                continue; // Skip complex types
            }

            // Convert to string and trim
            const stringValue = String(value).trim();
            
            // Max length check (prevent abuse)
            if (stringValue.length > 5000) {
                return res.status(400).json({
                    success: false,
                    message: `Field "${key}" exceeds maximum length`,
                });
            }

            sanitizedData[key] = stringValue;
        }

        // Ensure at least one field was provided
        if (Object.keys(sanitizedData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one field is required",
            });
        }

        // Find website with tenant info
        const website = await Website.findById(websiteId)
            .populate("tenantId")
            .lean();

        if (!website) {
            return res.status(404).json({
                success: false,
                message: "Website not found",
            });
        }

        const tenantId = website.tenantId._id.toString();
        const siteId = website._id.toString();
        
        // Generate human-readable slugs
        const tenantSlug = website.tenantId.slug || tenantId;
        const websiteSlug = website.slug || website.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || siteId;

        // Save to Firebase with human-readable structure
        const result = await firebaseService.saveFormSubmission(
            tenantSlug,
            websiteSlug,
            sanitizedData,
            { tenantId, siteId }
        );

        console.log(`📝 [Forms] Submission saved: ${result.submissionId} at ${result.path}`);

        return res.status(200).json({
            success: true,
            message: "Your details have been confirmed. We'll get back to you soon!",
            submissionId: result.submissionId,
        });
    } catch (error) {
        console.error("[Forms] Submission error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to submit form. Please try again.",
        });
    }
});

/**
 * GET /api/forms/submissions/:websiteId
 * Get form submissions for a website (authenticated)
 */
router.get("/submissions/:websiteId", authenticateJWT, async (req, res) => {
    try {
        const { websiteId } = req.params;
        const tenantId = req.user.tenantId.toString();
        const limit = parseInt(req.query.limit) || 50;

        // Verify website ownership
        const website = await Website.findOne({
            _id: websiteId,
            tenantId,
        }).populate("tenantId");

        if (!website) {
            return res.status(404).json({
                success: false,
                message: "Website not found or access denied",
            });
        }

        // Generate human-readable slugs
        const tenantSlug = website.tenantId.slug || tenantId;
        const websiteSlug = website.slug || website.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || websiteId;

        // Get submissions from Firebase using human-readable structure
        const submissions = await firebaseService.getFormSubmissions(
            tenantSlug,
            websiteSlug,
            limit
        );

        return res.json({
            success: true,
            data: submissions,
            count: submissions.length,
        });
    } catch (error) {
        console.error("[Forms] Error fetching submissions:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch submissions",
        });
    }
});

export default router;
