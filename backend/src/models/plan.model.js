import mongoose from "mongoose";

const PlanSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            enum: ["FREE", "BASIC", "PRO", "ENTERPRISE"],
        },
        displayName: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        price: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            default: "INR",
        },
        billingCycle: {
            type: String,
            enum: ["MONTHLY", "YEARLY"],
            default: "MONTHLY",
        },
        features: {
            customDomain: { type: Boolean, default: false },
            aiQuota: { type: Number, default: 10 },
            websiteLimit: { type: Number, default: 1 },
            premiumComponents: { type: Boolean, default: false },
            analyticsAccess: { type: Boolean, default: false },
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

const Plan = mongoose.model("Plan", PlanSchema);
export default Plan;
