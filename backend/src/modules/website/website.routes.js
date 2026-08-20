import express from "express";
import {
    getWebsites,
    getWebsite,
    createWebsite,
    updateWebsite,
    deleteWebsite,
    publishWebsite,
    getDeployments,
    rollback,
} from "./website.controller.js";
import { authChain, requireRole } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../middleware/async.middleware.js";

const router = express.Router();

router.get("/", authChain, asyncHandler(getWebsites));
router.get("/:id", authChain, asyncHandler(getWebsite));
router.post("/", authChain, requireRole("OWNER", "ADMIN"), asyncHandler(createWebsite));
router.put("/:id", authChain, requireRole("OWNER", "ADMIN", "EDITOR"), asyncHandler(updateWebsite));
router.delete("/:id", authChain, requireRole("OWNER", "ADMIN"), asyncHandler(deleteWebsite));
router.post("/:id/publish", authChain, requireRole("OWNER", "ADMIN"), asyncHandler(publishWebsite));
router.get("/:id/deployments", authChain, requireRole("OWNER", "ADMIN", "DEVELOPER"), asyncHandler(getDeployments));
router.post("/:id/rollback/:deploymentId", authChain, requireRole("OWNER"), asyncHandler(rollback));

export default router;
