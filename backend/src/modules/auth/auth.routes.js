import express from "express";
import {
    register,
    login,
    inviteUser,
    getTenantUsers,
    updateUserRole,
    removeUser,
    getMe,
} from "./auth.controller.js";
import { authChain, requireRole } from "../../middleware/auth.middleware.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.get("/me", authChain, getMe);
router.post("/invite", authChain, requireRole("OWNER", "ADMIN"), inviteUser);
router.get("/users", authChain, requireRole("OWNER", "ADMIN"), getTenantUsers);
router.put("/users/:userId/role", authChain, requireRole("OWNER"), updateUserRole);
router.delete("/users/:userId", authChain, requireRole("OWNER"), removeUser);

export default router;
