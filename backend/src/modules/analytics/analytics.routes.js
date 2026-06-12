import express from "express";
import { getDashboardStats, getActivityLogs, getWebsiteAnalytics } from "./analytics.controller.js";
import { authChain } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/dashboard", authChain, getDashboardStats);
router.get("/activity", authChain, getActivityLogs);
router.get("/website/:websiteId", authChain, getWebsiteAnalytics);

export default router;
