import Subscription from "../../models/subscription.model.js";
import Plan from "../../models/plan.model.js";

/**
 * Get revenue summary for admin dashboard
 */
export const getRevenueSummary = async (req, res) => {
    try {
        // Check if user is admin (you can add proper admin check here)
        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access required",
            });
        }

        // Get active subscriptions count
        const activeSubscriptionsCount = await Subscription.countDocuments({
            status: "ACTIVE",
        });

        // Get all active subscriptions
        const activeSubscriptions = await Subscription.find({
            status: "ACTIVE",
        }).populate("tenantId", "name slug");

        // Calculate monthly revenue (test mode - mocked)
        const monthlyRevenue = activeSubscriptions.reduce((total, sub) => {
            return total + (sub.amount || 0);
        }, 0);

        // Get plan distribution
        const planDistribution = await Subscription.aggregate([
            {
                $match: { status: "ACTIVE" },
            },
            {
                $group: {
                    _id: "$planType",
                    count: { $sum: 1 },
                    revenue: { $sum: "$amount" },
                },
            },
        ]);

        // Get subscription status breakdown
        const statusBreakdown = await Subscription.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                },
            },
        ]);

        // Get recent subscriptions
        const recentSubscriptions = await Subscription.find()
            .populate("tenantId", "name slug")
            .sort({ createdAt: -1 })
            .limit(10);

        // Get total revenue (all time)
        const totalRevenue = await Subscription.aggregate([
            {
                $match: { status: { $in: ["ACTIVE", "CANCELLED", "EXPIRED"] } },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" },
                },
            },
        ]);

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    activeSubscriptions: activeSubscriptionsCount,
                    monthlyRevenue: monthlyRevenue,
                    totalRevenue: totalRevenue[0]?.total || 0,
                    currency: "INR",
                },
                planDistribution: planDistribution.map((plan) => ({
                    planType: plan._id,
                    count: plan.count,
                    revenue: plan.revenue,
                })),
                statusBreakdown: statusBreakdown.map((status) => ({
                    status: status._id,
                    count: status.count,
                })),
                recentSubscriptions: recentSubscriptions.map((sub) => ({
                    id: sub._id,
                    tenant: sub.tenantId?.name || "Unknown",
                    planType: sub.planType,
                    status: sub.status,
                    amount: sub.amount,
                    createdAt: sub.createdAt,
                })),
            },
            note: "Test Mode - Revenue data is from test transactions",
        });
    } catch (error) {
        console.error("Get revenue summary error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch revenue summary",
            error: error.message,
        });
    }
};

/**
 * Get all subscriptions (admin only)
 */
export const getAllSubscriptions = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access required",
            });
        }

        const { status, planType, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (planType) filter.planType = planType;

        const subscriptions = await Subscription.find(filter)
            .populate("tenantId", "name slug")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await Subscription.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: subscriptions,
            pagination: {
                total: count,
                page: parseInt(page),
                pages: Math.ceil(count / limit),
            },
        });
    } catch (error) {
        console.error("Get all subscriptions error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch subscriptions",
            error: error.message,
        });
    }
};
