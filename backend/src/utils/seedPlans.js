import mongoose from "mongoose";
import dotenv from "dotenv";
import Plan from "../models/plan.model.js";

dotenv.config();

const plans = [
    {
        name: "FREE",
        displayName: "Free Plan",
        description: "Perfect for getting started",
        price: 0,
        currency: "INR",
        billingCycle: "MONTHLY",
        features: {
            customDomain: false,
            aiQuota: 10,
            websiteLimit: 1,
            premiumComponents: false,
            analyticsAccess: false,
        },
        isActive: true,
    },
    {
        name: "BASIC",
        displayName: "Basic Plan",
        description: "For small businesses and personal projects",
        price: 499,
        currency: "INR",
        billingCycle: "MONTHLY",
        features: {
            customDomain: true,
            aiQuota: 50,
            websiteLimit: 3,
            premiumComponents: false,
            analyticsAccess: true,
        },
        isActive: true,
    },
    {
        name: "PRO",
        displayName: "Pro Plan",
        description: "For growing businesses",
        price: 999,
        currency: "INR",
        billingCycle: "MONTHLY",
        features: {
            customDomain: true,
            aiQuota: 200,
            websiteLimit: 10,
            premiumComponents: true,
            analyticsAccess: true,
        },
        isActive: true,
    },
    {
        name: "ENTERPRISE",
        displayName: "Enterprise Plan",
        description: "For large organizations",
        price: 2499,
        currency: "INR",
        billingCycle: "MONTHLY",
        features: {
            customDomain: true,
            aiQuota: 1000,
            websiteLimit: 50,
            premiumComponents: true,
            analyticsAccess: true,
        },
        isActive: true,
    },
];

const seedPlans = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB Connected");

        await Plan.deleteMany({});
        console.log("🗑️  Cleared existing plans");

        await Plan.insertMany(plans);
        console.log("✅ Plans seeded successfully");

        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding plans:", error);
        process.exit(1);
    }
};

seedPlans();
