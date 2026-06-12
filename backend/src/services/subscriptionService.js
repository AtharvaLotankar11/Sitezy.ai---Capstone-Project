import Subscription from "../models/subscription.model.js";
import Plan from "../models/plan.model.js";

class SubscriptionService {
    /**
     * Get active subscription for tenant
     */
    async getActiveSubscription(tenantId) {
        return await Subscription.findOne({
            tenantId,
            status: "ACTIVE",
        }).sort({ createdAt: -1 });
    }

    /**
     * Get subscription by ID
     */
    async getSubscriptionById(subscriptionId) {
        return await Subscription.findById(subscriptionId);
    }

    /**
     * Create new subscription
     */
    async createSubscription(data) {
        const subscription = new Subscription(data);
        return await subscription.save();
    }

    /**
     * Update subscription status
     */
    async updateSubscriptionStatus(subscriptionId, status, additionalData = {}) {
        return await Subscription.findByIdAndUpdate(
            subscriptionId,
            {
                status,
                ...additionalData,
            },
            { new: true }
        );
    }

    /**
     * Activate subscription
     */
    async activateSubscription(subscriptionId, paymentData = {}) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

        return await Subscription.findByIdAndUpdate(
            subscriptionId,
            {
                status: "ACTIVE",
                startDate,
                endDate,
                ...paymentData,
            },
            { new: true }
        );
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(subscriptionId) {
        return await Subscription.findByIdAndUpdate(
            subscriptionId,
            {
                status: "CANCELLED",
            },
            { new: true }
        );
    }

    /**
     * Get tenant features based on subscription
     */
    async getTenantFeatures(tenantId) {
        const subscription = await this.getActiveSubscription(tenantId);

        if (!subscription || subscription.status !== "ACTIVE") {
            // Return FREE plan features
            return {
                customDomain: false,
                aiQuota: 10,
                websiteLimit: 1,
                premiumComponents: false,
                analyticsAccess: false,
                planType: "FREE",
            };
        }

        return {
            ...subscription.features,
            planType: subscription.planType,
        };
    }

    /**
     * Check if tenant has feature access
     */
    async hasFeatureAccess(tenantId, featureName) {
        const features = await this.getTenantFeatures(tenantId);
        return features[featureName] === true;
    }

    /**
     * Get all plans
     */
    async getAllPlans() {
        return await Plan.find({ isActive: true }).sort({ price: 1 });
    }

    /**
     * Get plan by name
     */
    async getPlanByName(planName) {
        return await Plan.findOne({ name: planName, isActive: true });
    }

    /**
     * Get subscription history for tenant
     */
    async getSubscriptionHistory(tenantId) {
        return await Subscription.find({ tenantId }).sort({ createdAt: -1 });
    }
}

export default new SubscriptionService();
