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

const router = express.Router();

router.get("/", authChain, getWebsites);
router.get("/:id", authChain, getWebsite);
router.post("/", authChain, requireRole("OWNER", "ADMIN"), createWebsite);
router.put("/:id", authChain, requireRole("OWNER", "ADMIN", "EDITOR"), updateWebsite);
router.delete("/:id", authChain, requireRole("OWNER", "ADMIN"), deleteWebsite);
router.post("/:id/publish", authChain, requireRole("OWNER", "ADMIN"), publishWebsite);
router.get("/:id/deployments", authChain, requireRole("OWNER", "ADMIN", "DEVELOPER"), getDeployments);
router.post("/:id/rollback/:deploymentId", authChain, requireRole("OWNER"), rollback);

export default router;
