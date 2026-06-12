import mongoose from "mongoose";

/**
 * Raw visitor engagement sessions captured by the published-site tracker.
 * Used to retrain the GRU engagement model on real traffic. TTL: 60 days.
 */
const EngagementEventSchema = new mongoose.Schema(
    {
        websiteId: { type: String, index: true },
        pageId: { type: String },
        sessionId: { type: String, index: true },
        events: [
            {
                sectionId: String,
                sectionType: String,
                tSpent: Number,       // seconds visible
                scrollDepth: Number,  // 0..1
                ctaClick: Boolean,
                formStart: Boolean,
                formDone: Boolean,
            },
        ],
        converted: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 60 },
    },
    { versionKey: false }
);

export default mongoose.model("EngagementEvent", EngagementEventSchema);
