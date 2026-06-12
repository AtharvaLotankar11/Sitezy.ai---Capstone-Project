import express from "express";
import { getRevenueSummary, getAllSubscriptions } from "./admin.controller.js";
import { authenticateJWT } from "../../middleware/auth.middleware.js";

const router = express.Router();

// Admin routes (protected)
router.get("/revenue-summary", authenticateJWT, getRevenueSummary);
router.get("/subscriptions", authenticateJWT, getAllSubscriptions);

export default router;
