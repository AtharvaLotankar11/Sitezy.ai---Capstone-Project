import mongoose from "mongoose";

const WebsiteSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tenant",
            required: true,
            index: true,
        },
        name: { type: String, required: true, trim: true },
        slug: { type: String, trim: true, index: true },
        description: { type: String, default: "" },
        status: {
            type: String,
            enum: ["draft", "published"],
            default: "draft",
        },
        publishedAt: { type: Date },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        defaultDomain: { type: String }, // tenantslug.localhost:3000
    },
    { timestamps: true }
);

const Website = mongoose.model("Website", WebsiteSchema);
export default Website;
