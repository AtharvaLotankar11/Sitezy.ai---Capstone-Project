import EngagementEvent from "./engagementEvent.model.js";

/**
 * POST /api/public/analytics/engagement  (public, no auth — receives sendBeacon batches)
 * Stores a visitor session for later GRU retraining. Always returns 204 so the beacon
 * never surfaces an error to the visitor's browser.
 */
export const recordEngagement = async (req, res) => {
    try {
        const { websiteId, pageId, sessionId, events, converted } = req.body || {};
        if (websiteId && Array.isArray(events) && events.length) {
            await EngagementEvent.create({
                websiteId: String(websiteId),
                pageId: pageId ? String(pageId) : undefined,
                sessionId: sessionId ? String(sessionId) : undefined,
                events: events.slice(0, 40),
                converted: !!converted,
            });
        }
    } catch (e) {
        // swallow — a tracking beacon must never error
        console.warn("⚠️ [Engagement] record failed:", e.message);
    }
    return res.status(204).end();
};
