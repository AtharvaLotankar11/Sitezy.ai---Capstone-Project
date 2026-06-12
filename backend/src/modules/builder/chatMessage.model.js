import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
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
        pageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Page",
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        userName: { type: String, required: true },
        message: { type: String, required: true, maxlength: 2000 },
        color: { type: String, default: "#6366f1" },
    },
    { timestamps: true }
);

// Auto-expire messages after 30 days
ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const ChatMessage = mongoose.model("ChatMessage", ChatMessageSchema);
export default ChatMessage;
