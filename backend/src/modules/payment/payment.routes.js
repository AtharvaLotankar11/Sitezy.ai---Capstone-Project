import express from "express";
import {
    createOrder,
    verifyPayment,
    handleWebhook,
    getCurrentSubscription,
    getPlans,
    getSubscriptionHistory,
    cancelSubscription,
} from "./payment.controller.js";
import { authenticateJWT } from "../../middleware/auth.middleware.js";

const router = express.Router();

// Public webhook endpoint (no auth)
router.post("/webhook", handleWebhook);

// Protected routes
router.post("/create-order", authenticateJWT, createOrder);
router.post("/verify", authenticateJWT, verifyPayment);
router.post("/cancel", authenticateJWT, cancelSubscription);
router.get("/subscription", authenticateJWT, getCurrentSubscription);
router.get("/plans", authenticateJWT, getPlans);
router.get("/history", authenticateJWT, getSubscriptionHistory);

export default router;
