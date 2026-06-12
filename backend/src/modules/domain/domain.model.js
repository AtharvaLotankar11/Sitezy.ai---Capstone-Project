import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const DomainSchema = new mongoose.Schema(
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
        },
        domain: { type: String, required: true, unique: true, lowercase: true, trim: true },
        verified: { type: Boolean, default: false },
        verificationToken: { type: String, default: () => uuidv4() },
        isDefault: { type: Boolean, default: false }, // subdomain auto-created
    },
    { timestamps: true }
);

const Domain = mongoose.model("Domain", DomainSchema);
export default Domain;
