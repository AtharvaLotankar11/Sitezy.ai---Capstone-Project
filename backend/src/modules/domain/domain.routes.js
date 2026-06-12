import express from "express";
import {
    getDomains,
    addDomain,
    verifyDomain,
    deleteDomain,
    resolveHostname,
    getPublicPage,
    getPublicSite,
} from "./domain.controller.js";
import { authChain, requireRole } from "../../middleware/auth.middleware.js";

const router = express.Router();

// Protected domain management
router.get("/", authChain, getDomains);
router.post("/", authChain, requireRole("OWNER"), addDomain);
router.post("/:id/verify", authChain, requireRole("OWNER"), verifyDomain);
router.delete("/:id", authChain, requireRole("OWNER"), deleteDomain);

export default router;
