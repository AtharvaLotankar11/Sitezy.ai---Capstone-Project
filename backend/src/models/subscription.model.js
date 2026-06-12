import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tenant",
            required: true,
        },
        razorpaySubscriptionId: {
            type: String,
        },
        razorpayOrderId: {
            type: String,
        },
        razorpayPaymentId: {
            type: String,
        },
        planType: {
            type: String,
            enum: ["FREE", "BASIC", "PRO", "ENTERPRISE"],
            default: "FREE",
            required: true,
        },
        status: {
            type: String,
            enum: ["PENDING", "ACTIVE", "CANCELLED", "FAILED", "EXPIRED"],
            default: "PENDING",
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            default: 0,
        },
        currency: {
            type: String,
            default: "INR",
        },
        startDate: {
            type: Date,
        },
        endDate: {
            type: Date,
        },
        features: {
            customDomain: { type: Boolean, default: false },
            aiQuota: { type: Number, default: 10 },
            websiteLimit: { type: Number, default: 1 },
            premiumComponents: { type: Boolean, default: false },
            analyticsAccess: { type: Boolean, default: false },
        },
    },
    { timestamps: true }
);

// Index for efficient queries (non-unique)
SubscriptionSchema.index({ tenantId: 1, status: 1 });
SubscriptionSchema.index({ razorpaySubscriptionId: 1 }, { sparse: true });

const Subscription = mongoose.model("Subscription", SubscriptionSchema);
export default Subscription;
