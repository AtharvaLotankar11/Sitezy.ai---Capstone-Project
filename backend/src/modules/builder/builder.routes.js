import express from "express";
import {
    getPages,
    getPage,
    createPage,
    deletePage,
    updateSections,
    updateSectionProps,
    saveDraft,
    commitPage,
    getCommits,
    rollbackToCommit,
} from "./builder.controller.js";
import { authChain, requireRole } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../middleware/async.middleware.js";

const router = express.Router({ mergeParams: true });

// All builder routes require auth
router.get("/", authChain, asyncHandler(getPages));
router.get("/:pageId", authChain, asyncHandler(getPage));
router.post("/", authChain, requireRole("OWNER", "ADMIN", "DEVELOPER"), asyncHandler(createPage));
router.delete("/:pageId", authChain, requireRole("OWNER", "ADMIN"), asyncHandler(deletePage));
router.put("/:pageId/sections", authChain, requireRole("OWNER", "ADMIN", "EDITOR", "DEVELOPER"), asyncHandler(updateSections));
router.patch("/:pageId/sections/:sectionId", authChain, requireRole("OWNER", "ADMIN", "EDITOR", "DEVELOPER"), asyncHandler(updateSectionProps));
router.post("/:pageId/save-draft", authChain, requireRole("OWNER", "ADMIN", "EDITOR", "DEVELOPER"), asyncHandler(saveDraft));

// Version control routes
router.post("/:pageId/commit", authChain, requireRole("OWNER", "ADMIN", "EDITOR", "DEVELOPER"), asyncHandler(commitPage));
router.get("/:pageId/commits", authChain, asyncHandler(getCommits));
router.post("/:pageId/rollback/:commitId", authChain, requireRole("OWNER", "ADMIN"), asyncHandler(rollbackToCommit));

export default router;
