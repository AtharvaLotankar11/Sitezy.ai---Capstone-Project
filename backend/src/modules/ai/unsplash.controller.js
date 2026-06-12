/**
 * unsplash.controller.js
 * Public proxy endpoint for Unsplash image search.
 * The frontend calls /api/public/unsplash?query=... instead of hitting Unsplash directly.
 * This keeps the Access Key server-side only.
 */
import { searchUnsplash, searchUnsplashBatch } from "../../services/unsplash.service.js";
import express from "express";

const router = express.Router();

/**
 * GET /api/public/unsplash?query=coffee+barista&w=800&h=600
 * Returns a single best-match image URL.
 */
router.get("/", async (req, res) => {
    const { query, w = "800", h = "600", orientation = "landscape" } = req.query;

    if (!query || query.trim().length < 2) {
        return res.status(400).json({ success: false, message: "Query parameter is required" });
    }

    try {
        const result = await searchUnsplash(
            query.trim(),
            parseInt(w, 10),
            parseInt(h, 10),
            orientation
        );
        return res.json({ success: true, ...result });
    } catch (err) {
        console.error("[Unsplash Proxy] Error:", err.message);
        return res.status(500).json({ success: false, message: "Image search failed" });
    }
});

/**
 * POST /api/public/unsplash/batch
 * Body: { queries: ["coffee", "fitness", ...], w: 640, h: 480 }
 * Returns a map of { query: { url, thumb, photographer } }
 */
router.post("/batch", async (req, res) => {
    const { queries, w = 640, h = 480 } = req.body;

    if (!Array.isArray(queries) || queries.length === 0) {
        return res.status(400).json({ success: false, message: "queries array is required" });
    }

    if (queries.length > 20) {
        return res.status(400).json({ success: false, message: "Maximum 20 queries per batch" });
    }

    try {
        const results = await searchUnsplashBatch(queries, parseInt(w, 10), parseInt(h, 10));
        return res.json({ success: true, results });
    } catch (err) {
        console.error("[Unsplash Batch Proxy] Error:", err.message);
        return res.status(500).json({ success: false, message: "Batch image search failed" });
    }
});

export default router;
