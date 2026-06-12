import mongoose from "mongoose";

const TenantSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        branding: {
            primaryColor: { type: String, default: "#6366f1" },
            secondaryColor: { type: String, default: "#8b5cf6" },
            font: { type: String, default: "Inter" },
            logo: { type: String, default: "" },
        },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

const Tenant = mongoose.model("Tenant", TenantSchema);
export default Tenant;
