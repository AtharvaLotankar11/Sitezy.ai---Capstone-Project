import razorpayService from "../../services/razorpayService.js";
import subscriptionService from "../../services/subscriptionService.js";
import Subscription from "../../models/subscription.model.js";

/**
 * Create Razorpay order for subscription
 */
export const createOrder = async (req, res) => {
    try {
        console.log("📝 Create order request received:", req.body);
        const { planType } = req.body;
        const tenantId = req.user?.tenantId || req.tenantId;

        console.log("👤 Tenant ID:", tenantId);

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: "Tenant ID is required",
            });
        }

        // Get plan details
        console.log("🔍 Looking up plan:", planType);
        const plan = await subscriptionService.getPlanByName(planType);
        console.log("📋 Plan found:", plan ? `${plan.name} - ₹${plan.price}` : "NOT FOUND");

        if (!plan) {
            console.error(`❌ Plan not found: ${planType}`);
            return res.status(404).json({
                success: false,
                message: `Plan "${planType}" not found`,
            });
        }

        if (plan.price === 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot create order for free plan",
            });
        }

        // Check if tenant already has active subscription for the same plan
        console.log("🔍 Checking for active subscription...");
        const activeSubscription = await subscriptionService.getActiveSubscription(tenantId);
        console.log("📊 Active subscription:", activeSubscription ? `${activeSubscription.planType} - ${activeSubscription.status}` : "NONE");

        if (activeSubscription && activeSubscription.planType === planType && activeSubscription.status === "ACTIVE") {
            return res.status(400).json({
                success: false,
                message: "You already have an active subscription for this plan",
            });
        }

        // If there's an active subscription for a different plan, cancel it first
        if (activeSubscription && activeSubscription.status === "ACTIVE" && activeSubscription.planType !== planType) {
            console.log(`🔄 Auto-cancelling existing ${activeSubscription.planType} subscription for upgrade/downgrade`);
            await subscriptionService.cancelSubscription(activeSubscription._id);
        }

        // Create subscription record in pending state
        console.log("💾 Creating subscription record...");
        const subscription = await subscriptionService.createSubscription({
            tenantId,
            planType: plan.name,
            status: "PENDING",
            amount: plan.price,
            currency: plan.currency,
            features: plan.features,
        });
        console.log("✅ Subscription created:", subscription._id);

        // Create Razorpay order
        console.log("💳 Creating Razorpay order...");
        const order = await razorpayService.createOrder({
            amount: plan.price,
            currency: plan.currency,
            receipt: `sub_${subscription._id}`,
            notes: {
                tenantId: tenantId.toString(),
                subscriptionId: subscription._id.toString(),
                planType: plan.name,
            },
        });
        console.log("✅ Razorpay order created:", order.id);

        // Update subscription with order ID
        subscription.razorpayOrderId = order.id;
        await subscription.save();

        console.log("🎉 Order creation successful!");
        res.status(200).json({
            success: true,
            data: {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: razorpayService.getKeyId(),
                subscriptionId: subscription._id,
                planDetails: {
                    name: plan.displayName,
                    type: plan.name,
                    features: plan.features,
                },
            },
        });
    } catch (error) {
        console.error("Create order error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create order",
            error: error.message,
        });
    }
};

/**
 * Verify payment signature and activate subscription
 */
export const verifyPayment = async (req, res) => {
    try {
        const { orderId, paymentId, signature, subscriptionId } = req.body;
        const tenantId = req.user?.tenantId || req.tenantId;

        if (!orderId || !paymentId || !signature || !subscriptionId) {
            return res.status(400).json({
                success: false,
                message: "Missing required payment details",
            });
        }

        // Verify signature
        const isValid = razorpayService.verifyPaymentSignature({
            orderId,
            paymentId,
            signature,
        });

        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature",
            });
        }

        // Get subscription
        const subscription = await subscriptionService.getSubscriptionById(subscriptionId);
        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: "Subscription not found",
            });
        }

        // Verify tenant ownership
        if (subscription.tenantId.toString() !== tenantId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access to subscription",
            });
        }

        // Activate subscription
        const activatedSubscription = await subscriptionService.activateSubscription(
            subscriptionId,
            {
                razorpayPaymentId: paymentId,
            }
        );

        res.status(200).json({
            success: true,
            message: "Payment verified and subscription activated",
            data: {
                subscription: activatedSubscription,
                features: activatedSubscription.features,
            },
        });
    } catch (error) {
        console.error("Verify payment error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to verify payment",
            error: error.message,
        });
    }
};

/**
 * Razorpay webhook handler
 */
export const handleWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];
        const payload = req.body;

        // Verify webhook signature
        const isValid = razorpayService.verifyWebhookSignature(payload, signature);
        if (!isValid) {
            console.error("Invalid webhook signature");
            return res.status(400).json({
                success: false,
                message: "Invalid signature",
            });
        }

        const event = payload.event;
        const paymentEntity = payload.payload.payment?.entity;
        const subscriptionEntity = payload.payload.subscription?.entity;

        console.log(`📥 Webhook received: ${event}`);

        // Handle different webhook events
        switch (event) {
            case "payment.captured":
                await handlePaymentCaptured(paymentEntity);
                break;

            case "payment.failed":
                await handlePaymentFailed(paymentEntity);
                break;

            case "subscription.activated":
                await handleSubscriptionActivated(subscriptionEntity);
                break;

            case "subscription.cancelled":
                await handleSubscriptionCancelled(subscriptionEntity);
                break;

            default:
                console.log(`Unhandled webhook event: ${event}`);
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Webhook error:", error);
        res.status(500).json({
            success: false,
            message: "Webhook processing failed",
        });
    }
};

/**
 * Get current subscription details
 */
export const getCurrentSubscription = async (req, res) => {
    try {
        const tenantId = req.user?.tenantId || req.tenantId;

        let subscription = await subscriptionService.getActiveSubscription(tenantId);
        const features = await subscriptionService.getTenantFeatures(tenantId);

        if (!subscription) {
            subscription = {
                planType: "FREE",
                status: "ACTIVE",
                features: features
            };
        }

        res.status(200).json({
            success: true,
            data: {
                subscription,
                features,
            },
        });
    } catch (error) {
        console.error("Get subscription error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch subscription",
            error: error.message,
        });
    }
};

/**
 * Get all available plans
 */
export const getPlans = async (req, res) => {
    try {
        const plans = await subscriptionService.getAllPlans();

        res.status(200).json({
            success: true,
            data: plans,
        });
    } catch (error) {
        console.error("Get plans error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch plans",
            error: error.message,
        });
    }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (req, res) => {
    try {
        const tenantId = req.user?.tenantId || req.tenantId;

        const subscription = await subscriptionService.getActiveSubscription(tenantId);

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: "No active subscription found",
            });
        }

        if (subscription.planType === "FREE") {
            return res.status(400).json({
                success: false,
                message: "Cannot cancel free plan",
            });
        }

        const cancelledSubscription = await subscriptionService.cancelSubscription(subscription._id);

        res.status(200).json({
            success: true,
            message: "Subscription cancelled successfully",
            data: cancelledSubscription,
        });
    } catch (error) {
        console.error("Cancel subscription error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to cancel subscription",
            error: error.message,
        });
    }
};

/**
 * Get subscription history
 */
export const getSubscriptionHistory = async (req, res) => {
    try {
        const tenantId = req.user?.tenantId || req.tenantId;

        const history = await subscriptionService.getSubscriptionHistory(tenantId);

        res.status(200).json({
            success: true,
            data: history,
        });
    } catch (error) {
        console.error("Get subscription history error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch subscription history",
            error: error.message,
        });
    }
};

// Webhook event handlers
async function handlePaymentCaptured(payment) {
    try {
        const orderId = payment.order_id;
        const subscription = await Subscription.findOne({ razorpayOrderId: orderId });

        if (subscription && subscription.status === "PENDING") {
            await subscriptionService.activateSubscription(subscription._id, {
                razorpayPaymentId: payment.id,
            });
            console.log(`✅ Subscription activated via webhook: ${subscription._id}`);
        }
    } catch (error) {
        console.error("Handle payment captured error:", error);
    }
}

async function handlePaymentFailed(payment) {
    try {
        const orderId = payment.order_id;
        const subscription = await Subscription.findOne({ razorpayOrderId: orderId });

        if (subscription) {
            await subscriptionService.updateSubscriptionStatus(subscription._id, "FAILED");
            console.log(`❌ Subscription marked as failed: ${subscription._id}`);
        }
    } catch (error) {
        console.error("Handle payment failed error:", error);
    }
}

async function handleSubscriptionActivated(subscriptionEntity) {
    try {
        const subscription = await Subscription.findOne({
            razorpaySubscriptionId: subscriptionEntity.id,
        });

        if (subscription) {
            await subscriptionService.activateSubscription(subscription._id);
            console.log(`✅ Subscription activated: ${subscription._id}`);
        }
    } catch (error) {
        console.error("Handle subscription activated error:", error);
    }
}

async function handleSubscriptionCancelled(subscriptionEntity) {
    try {
        const subscription = await Subscription.findOne({
            razorpaySubscriptionId: subscriptionEntity.id,
        });

        if (subscription) {
            await subscriptionService.cancelSubscription(subscription._id);
            console.log(`🚫 Subscription cancelled: ${subscription._id}`);
        }
    } catch (error) {
        console.error("Handle subscription cancelled error:", error);
    }
}
