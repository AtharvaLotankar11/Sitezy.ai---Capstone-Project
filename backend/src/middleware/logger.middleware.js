import ActivityLog from "../modules/analytics/activityLog.model.js";

/**
 * requestLogger
 * Lightweight HTTP request logger middleware.
 */
export const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
        );
    });
    next();
};

/**
 * logActivity
 * Helper to log user actions to ActivityLogs collection.
 * Call inside controllers after successful operations.
 */
export const logActivity = async ({ tenantId, userId, action, resource, resourceId, details, ip }) => {
    try {
        await ActivityLog.create({ tenantId, userId, action, resource, resourceId, details, ip });
    } catch (err) {
        console.error("ActivityLog error:", err.message);
    }
};
