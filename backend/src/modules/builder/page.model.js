import mongoose from "mongoose";

const SectionSchema = new mongoose.Schema({
    id: { type: String, required: true }, // client-side unique id
    type: {
        type: String,
        enum: ["Hero", "Text", "Gallery", "CTA", "ContactForm", "DynamicForm", "Navbar", "Footer", "Button", "Image", "Spacer"],
        required: true,
    },
    props: { type: mongoose.Schema.Types.Mixed, default: {} },
    order: { type: Number, default: 0 },
});

const PageSchema = new mongoose.Schema(
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
        title: { type: String, required: true, trim: true },
        slug: { type: String, required: true, trim: true, lowercase: true },
        layoutConfig: {
            sections: [SectionSchema],
        },
        status: {
            type: String,
            enum: ["draft", "published"],
            default: "draft",
        },
        isHomePage: { type: Boolean, default: false },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        version: { type: Number, default: 1 },
    },
    { timestamps: true }
);

PageSchema.index({ websiteId: 1, slug: 1 }, { unique: true });

const Page = mongoose.model("Page", PageSchema);
export default Page;
