import mongoose from "mongoose";

const CommitSchema = new mongoose.Schema(
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
            index: true,
        },
        pageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Page",
            required: true,
            index: true,
        },
        version: { type: Number, required: true },
        message: { type: String, required: true, trim: true, maxlength: 200 },
        snapshot: {
            // Full copy of layoutConfig at commit time
            sections: { type: mongoose.Schema.Types.Mixed, default: [] },
        },
        committedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        committedByName: { type: String, default: "Unknown" },
    },
    { timestamps: true }
);

CommitSchema.index({ pageId: 1, version: -1 });

const Commit = mongoose.model("Commit", CommitSchema);
export default Commit;
