import subscriptionService from "../services/subscriptionService.js";

/**
 * Middleware to check if tenant has access to a specific feature
 */
export const requireFeature = (featureName) => {
    return async (req, res, next) => {
        try {
            const tenantId = req.user?.tenantId || req.tenantId;

            if (!tenantId) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required",
                });
            }

            const hasAccess = await subscriptionService.hasFeatureAccess(tenantId, featureName);

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: `This feature requires an active subscription. Please upgrade your plan.`,
                    requiredFeature: featureName,
                });
            }

            next();
        } catch (error) {
            console.error("Feature check error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to verify feature access",
            });
        }
    };
};

/**
 * Middleware to attach tenant features to request
 */
export const attachFeatures = async (req, res, next) => {
    try {
        const tenantId = req.user?.tenantId || req.tenantId;

        if (tenantId) {
            req.tenantFeatures = await subscriptionService.getTenantFeatures(tenantId);
        } else {
            req.tenantFeatures = {
                customDomain: false,
                aiQuota: 10,
                websiteLimit: 1,
                premiumComponents: false,
                analyticsAccess: false,
                planType: "FREE",
            };
        }

        next();
    } catch (error) {
        console.error("Attach features error:", error);
        next();
    }
};

/**
 * Middleware to check subscription status
 */
export const requireActiveSubscription = async (req, res, next) => {
    try {
        const tenantId = req.user?.tenantId || req.tenantId;

        if (!tenantId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const subscription = await subscriptionService.getActiveSubscription(tenantId);

        if (!subscription || subscription.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Active subscription required",
            });
        }

        req.subscription = subscription;
        next();
    } catch (error) {
        console.error("Subscription check error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to verify subscription",
        });
    }
};
