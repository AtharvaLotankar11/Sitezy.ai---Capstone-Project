import jwt from "jsonwebtoken";
import User from "./user.model.js";
import Tenant from "../tenant/tenant.model.js";
import Domain from "../domain/domain.model.js";
import { logActivity } from "../../middleware/logger.middleware.js";
import {
    registerSchema,
    loginSchema,
    inviteUserSchema,
    updateRoleSchema,
} from "./auth.validation.js";

const signToken = (userId, tenantId, role) => {
    return jwt.sign({ userId, tenantId, role }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

/**
 * POST /api/auth/register
 * Creates a new Tenant + OWNER user atomically
 */
export const register = async (req, res) => {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { tenantName, tenantSlug, name, email, password } = value;

    // Check slug uniqueness
    const existingTenant = await Tenant.findOne({ slug: tenantSlug });
    if (existingTenant) {
        return res.status(409).json({ success: false, message: "Tenant slug already taken" });
    }

    // Create tenant
    const tenant = await Tenant.create({ name: tenantName, slug: tenantSlug });

    // Create OWNER user
    const user = await User.create({
        tenantId: tenant._id,
        name,
        email,
        password,
        role: "OWNER",
    });

    // Update tenant with ownerId
    tenant.ownerId = user._id;
    await tenant.save();

    // Create default subdomain
    await Domain.create({
        tenantId: tenant._id,
        domain: `${tenantSlug}.localhost`,
        verified: true,
        isDefault: true,
    });

    const token = signToken(user._id.toString(), tenant._id.toString(), user.role);

    res.status(201).json({
        success: true,
        message: "Tenant registered successfully",
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
        tenant: { id: tenant._id, name: tenant.name, slug: tenant.slug, branding: tenant.branding },
    });
};

/**
 * POST /api/auth/login
 */
export const login = async (req, res) => {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { email, tenantSlug, password } = value;

    const tenant = await Tenant.findOne({ slug: tenantSlug, isActive: true });
    if (!tenant) {
        return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    const user = await User.findOne({ email, tenantId: tenant._id, isActive: true });
    if (!user) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = signToken(user._id.toString(), tenant._id.toString(), user.role);

    await logActivity({
        tenantId: tenant._id,
        userId: user._id,
        action: "USER_LOGIN",
        resource: "User",
        resourceId: user._id,
        ip: req.ip,
    });

    res.json({
        success: true,
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
        tenant: { id: tenant._id, name: tenant.name, slug: tenant.slug, branding: tenant.branding },
    });
};

/**
 * POST /api/auth/invite
 * OWNER or ADMIN can invite new users to their tenant
 */
export const inviteUser = async (req, res) => {
    const { error, value } = inviteUserSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { name, email, password, role } = value;

    const existing = await User.findOne({ email, tenantId: req.tenantId });
    if (existing) {
        return res.status(409).json({ success: false, message: "User with this email already exists in tenant" });
    }

    const user = await User.create({
        tenantId: req.tenantId,
        name,
        email,
        password,
        role,
        invitedBy: req.user._id,
    });

    await logActivity({
        tenantId: req.tenantId,
        userId: req.user._id,
        action: "USER_INVITED",
        resource: "User",
        resourceId: user._id,
        details: { invitedEmail: email, role },
        ip: req.ip,
    });

    res.status(201).json({
        success: true,
        message: `User invited successfully`,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
};

/**
 * GET /api/auth/users
 * Get all users in current tenant
 */
export const getTenantUsers = async (req, res) => {
    const users = await User.find({ ...req.tenantFilter }).select("-password").lean();
    res.json({ success: true, users });
};

/**
 * PUT /api/auth/users/:userId/role
 * OWNER assigns role to user within same tenant
 */
export const updateUserRole = async (req, res) => {
    const { error, value } = updateRoleSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const user = await User.findOne({ _id: req.params.userId, ...req.tenantFilter });
    if (!user) return res.status(404).json({ success: false, message: "User not found in tenant" });

    if (user.role === "OWNER") {
        return res.status(403).json({ success: false, message: "Cannot change OWNER role" });
    }

    user.role = value.role;
    await user.save();

    await logActivity({
        tenantId: req.tenantId,
        userId: req.user._id,
        action: "USER_ROLE_UPDATED",
        resource: "User",
        resourceId: user._id,
        details: { newRole: value.role },
        ip: req.ip,
    });

    res.json({ success: true, message: "Role updated", user: { id: user._id, role: user.role } });
};

/**
 * DELETE /api/auth/users/:userId
 * OWNER removes user from tenant
 */
export const removeUser = async (req, res) => {
    const user = await User.findOne({ _id: req.params.userId, ...req.tenantFilter });
    if (!user) return res.status(404).json({ success: false, message: "User not found in tenant" });

    if (user.role === "OWNER") {
        return res.status(403).json({ success: false, message: "Cannot remove the OWNER" });
    }

    user.isActive = false;
    await user.save();

    await logActivity({
        tenantId: req.tenantId,
        userId: req.user._id,
        action: "USER_REMOVED",
        resource: "User",
        resourceId: user._id,
        ip: req.ip,
    });

    res.json({ success: true, message: "User removed from tenant" });
};

/**
 * GET /api/auth/me
 */
export const getMe = async (req, res) => {
    const user = await User.findById(req.user._id).select("-password").lean();
    const tenant = await Tenant.findById(req.tenantId).lean();
    res.json({ success: true, user, tenant });
};
