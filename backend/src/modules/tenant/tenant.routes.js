import express from "express";
import multer from "multer";
import path from "path";
import { getTenant, updateBranding, uploadLogo } from "./tenant.controller.js";
import { authChain, requireRole } from "../../middleware/auth.middleware.js";

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `logo-${req.tenantId}-${Date.now()}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/svg+xml", "image/webp"];
        allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Invalid file type"));
    },
});

const router = express.Router();

router.get("/", authChain, getTenant);
router.put("/branding", authChain, requireRole("OWNER"), updateBranding);
router.post("/logo", authChain, requireRole("OWNER"), upload.single("logo"), uploadLogo);

export default router;
