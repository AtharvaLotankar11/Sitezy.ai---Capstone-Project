import mongoose from "mongoose";

const DeploymentSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tenant",
            required: true,
            index: true,
        },
        websiteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Website",
            required: true,
        },
        deployedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        version: { type: Number, required: true },
        snapshot: { type: mongoose.Schema.Types.Mixed }, // Full page/section snapshot at deploy time
        status: {
            type: String,
            enum: ["pending", "success", "failed", "rolled_back"],
            default: "success",
        },
        notes: { type: String, default: "" },
    },
    { timestamps: true }
);

const Deployment = mongoose.model("Deployment", DeploymentSchema);
export default Deployment;
