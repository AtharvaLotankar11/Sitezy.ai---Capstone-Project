import express from "express";
import { getDashboardStats, getActivityLogs, getWebsiteAnalytics, getFormSubmissions } from "./analytics.controller.js";
import { authChain, requireRole } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/dashboard", authChain, getDashboardStats);
router.get("/activity", authChain, getActivityLogs);
router.get("/website/:websiteId", authChain, getWebsiteAnalytics);
router.get("/website/:websiteId/submissions", authChain, requireRole("OWNER", "ADMIN"), getFormSubmissions);

export default router;
