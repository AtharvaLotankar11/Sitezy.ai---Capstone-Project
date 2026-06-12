import mongoose from "mongoose";

const ActivityLogSchema = new mongoose.Schema(
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
        },
        action: { type: String, required: true }, // e.g. "PAGE_CREATED", "WEBSITE_PUBLISHED"
        resource: { type: String }, // e.g. "Page", "Website"
        resourceId: { type: mongoose.Schema.Types.ObjectId },
        details: { type: mongoose.Schema.Types.Mixed },
        ip: { type: String },
    },
    { timestamps: true }
);

const ActivityLog = mongoose.model("ActivityLog", ActivityLogSchema);
export default ActivityLog;
