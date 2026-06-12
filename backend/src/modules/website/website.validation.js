import Joi from "joi";

export const createWebsiteSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(500).allow(""),
}).unknown(true);

export const updateWebsiteSchema = Joi.object({
    name: Joi.string().min(2).max(100),
    description: Joi.string().max(500).allow(""),
});
