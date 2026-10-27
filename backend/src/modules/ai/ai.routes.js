import express from "express";
import { generateLayout, getAILogs, autoConfigureFromPrompt, generateTuneQuestions, helpAssistant } from "./ai.controller.js";
import { scoreSeo, autoImproveSeo, designHealth, suggestEngagement, generateSeoMeta } from "./seo.controller.js";
import { authChain, requireRole } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post("/generate-website", authChain, requireRole("OWNER", "ADMIN", "DEVELOPER"), generateLayout);
router.post("/auto-configure", authChain, requireRole("OWNER", "ADMIN", "DEVELOPER"), autoConfigureFromPrompt);
router.post("/tune-questions", authChain, requireRole("OWNER", "ADMIN", "DEVELOPER"), generateTuneQuestions);

// ── DL SEO / design / engagement ──
router.post("/seo/score", authChain, requireRole("OWNER", "ADMIN", "DEVELOPER"), scoreSeo);
router.post("/seo/auto-improve", authChain, requireRole("OWNER", "ADMIN", "DEVELOPER"), autoImproveSeo);
router.post("/seo/generate-meta", authChain, requireRole("OWNER", "ADMIN", "DEVELOPER"), generateSeoMeta);
router.post("/design/health", authChain, requireRole("OWNER", "ADMIN", "DEVELOPER"), designHealth);
router.post("/engagement/suggest", authChain, requireRole("OWNER", "ADMIN", "DEVELOPER"), suggestEngagement);

router.post("/help", authChain, helpAssistant);

router.get("/logs", authChain, requireRole("OWNER", "ADMIN"), getAILogs);

export default router;
