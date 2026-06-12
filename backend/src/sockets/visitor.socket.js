/**
 * Visitor Socket — tracks live public visitors per website.
 * Uses a separate, unauthenticated namespace so published-site visitors
 * (who have no JWT) can connect freely.
 *
 * Room key: `visitor:<websiteId>`
 * The in-memory Map is exported so the analytics controller can query it.
 */

// websiteId → Set<socketId>
export const liveVisitors = new Map();

export const initializeVisitorSockets = (io) => {
    // Separate namespace — no JWT middleware
    const visitorNs = io.of('/visitors');

    visitorNs.on('connection', (socket) => {
        socket.on('visitor:join', ({ websiteId }) => {
            if (!websiteId) return;
            socket.join(`visitor:${websiteId}`);
            socket.trackedWebsiteId = websiteId;

            if (!liveVisitors.has(websiteId)) {
                liveVisitors.set(websiteId, new Set());
            }
            liveVisitors.get(websiteId).add(socket.id);
            console.log(`👁️ [Visitors] +1 live visitor on website ${websiteId} (total: ${liveVisitors.get(websiteId).size})`);
        });

        socket.on('disconnect', () => {
            const wid = socket.trackedWebsiteId;
            if (wid && liveVisitors.has(wid)) {
                liveVisitors.get(wid).delete(socket.id);
                if (liveVisitors.get(wid).size === 0) {
                    liveVisitors.delete(wid);
                }
                console.log(`👁️ [Visitors] -1 live visitor on website ${wid} (remaining: ${liveVisitors.get(wid)?.size ?? 0})`);
            }
        });
    });
};
