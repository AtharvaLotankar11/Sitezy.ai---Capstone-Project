import Joi from "joi";

export const registerSchema = Joi.object({
    tenantName: Joi.string().min(2).max(50).required(),
    tenantSlug: Joi.string().min(2).max(30).alphanum().lowercase().required(),
    name: Joi.string().min(2).max(80).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
});

export const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    tenantSlug: Joi.string().min(2).required(),
    password: Joi.string().min(6).required(),
});

export const inviteUserSchema = Joi.object({
    name: Joi.string().min(2).max(80).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid("ADMIN", "EDITOR", "DEVELOPER").required(),
});

export const updateRoleSchema = Joi.object({
    role: Joi.string().valid("ADMIN", "EDITOR", "DEVELOPER").required(),
});
