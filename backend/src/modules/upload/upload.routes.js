import express from "express";
import multer from "multer";
import path from "path";
import { authChain } from "../../middleware/auth.middleware.js";

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `img-${req.user ? req.user._id : 'anon'}-${Date.now()}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/svg+xml", "image/webp", "image/gif"];
        allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Invalid file type"));
    },
});

const router = express.Router();

router.post("/", authChain, upload.single("image"), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }
        res.status(200).json({
            success: true,
            url: `/uploads/${req.file.filename}`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
