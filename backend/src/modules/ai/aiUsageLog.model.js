import mongoose from "mongoose";

const AIUsageLogSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tenant",
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        websiteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Website",
        },
        prompt: { type: mongoose.Schema.Types.Mixed },
        response: { type: mongoose.Schema.Types.Mixed },
        tokensUsed: { type: Number, default: 0 },
        model: { type: String, default: "gemini-3-flash" },
        success: { type: Boolean, default: true },
        errorMessage: { type: String },
    },
    { timestamps: true }
);

const AIUsageLog = mongoose.model("AIUsageLog", AIUsageLogSchema);
export default AIUsageLog;
