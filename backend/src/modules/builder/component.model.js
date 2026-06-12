import mongoose from "mongoose";

const ComponentSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tenant",
            required: true,
            index: true,
        },
        pageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Page",
            required: true,
        },
        websiteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Website",
            required: true,
        },
        type: { type: String, required: true },
        props: { type: mongoose.Schema.Types.Mixed, default: {} },
        order: { type: Number, default: 0 },
    },
    { timestamps: true }
);

const Component = mongoose.model("Component", ComponentSchema);
export default Component;
