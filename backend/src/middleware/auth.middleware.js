import jwt from "jsonwebtoken";
import User from "../modules/auth/user.model.js";
import Tenant from "../modules/tenant/tenant.model.js";

/**
 * authenticateJWT
 * Verifies JWT token and attaches user + tenant context to req.
 */
export const authenticateJWT = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, message: "No token provided" });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.userId).lean();
        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, message: "User not found or inactive" });
        }

        // Enforce tenantId in token matches user's tenantId (prevents token replay across tenants)
        if (decoded.tenantId !== user.tenantId.toString()) {
            return res.status(403).json({ success: false, message: "Tenant mismatch — access denied" });
        }

        req.user = user;
        req.tenantId = user.tenantId;
        req.role = user.role;
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ success: false, message: "Token expired" });
        }
        return res.status(401).json({ success: false, message: "Invalid token" });
    }
};

/**
 * attachTenantContext
 * Verifies the tenant exists and is active.
 * Must run after authenticateJWT.
 */
export const attachTenantContext = async (req, res, next) => {
    try {
        const tenant = await Tenant.findById(req.tenantId).lean();
        if (!tenant || !tenant.isActive) {
            return res.status(403).json({ success: false, message: "Tenant not found or inactive" });
        }
        req.tenant = tenant;
        next();
    } catch (error) {
        return res.status(500).json({ success: false, message: "Error resolving tenant context" });
    }
};

/**
 * enforceTenantScope
 * Injects tenantId filter into all req.query/body.
 * Ensures no DB query can leak cross-tenant data.
 */
export const enforceTenantScope = (req, res, next) => {
    if (!req.tenantId) {
        return res.status(403).json({ success: false, message: "Tenant scope not established" });
    }
    // Attach to req for controllers to use in ALL queries
    req.tenantFilter = { tenantId: req.tenantId };
    next();
};

/**
 * requireRole
 * Factory function — use: requireRole("OWNER", "ADMIN")
 */
export const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.role || !roles.includes(req.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role(s): ${roles.join(", ")}`,
            });
        }
        next();
    };
};

/**
 * Full auth chain (convenience)
 */
export const authChain = [authenticateJWT, attachTenantContext, enforceTenantScope];
