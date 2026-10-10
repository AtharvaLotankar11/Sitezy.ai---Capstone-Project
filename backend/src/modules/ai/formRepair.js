/**
 * Form validation and targeted regeneration for generated layouts.
 *
 * The layout schema checks structure only, so a model can return a valid layout whose
 * DynamicForm has no fields. repairForms() validates every form field and, when a
 * DynamicForm has fewer than MIN_FIELDS valid fields, regenerates only that form with a
 * short local-model call. If regeneration fails, a small deterministic field set is used,
 * so a published form is never empty. ContactForms without fields get the default list.
 */

const ALLOWED_TYPES = new Set(["text", "email", "tel", "number", "select", "textarea", "date"]);
const MIN_FIELDS = 3;

const DEFAULT_DYNAMIC_FIELDS = [
    { name: "full_name", label: "Your Name", type: "text", required: true },
    { name: "phone", label: "Phone Number", type: "tel", required: true },
    { name: "email", label: "Email Address", type: "email", required: false },
    { name: "message", label: "How can we help?", type: "textarea", required: false },
];
const DEFAULT_CONTACT_FIELDS = ["name", "email", "phone", "message"];

/** Keep only well-formed fields: name, label, allowed type, >=2 options for select; unique names. */
export function validFields(fields) {
    if (!Array.isArray(fields)) return [];
    const seen = new Set();
    const out = [];
    for (const f of fields) {
        if (!f || typeof f !== "object") continue;
        const name = String(f.name || "").trim();
        const label = String(f.label || "").trim();
        const type = String(f.type || "text").trim().toLowerCase();
        if (!name || !label || !ALLOWED_TYPES.has(type) || seen.has(name.toLowerCase())) continue;
        const field = { name, label, type, required: f.required !== false };
        if (type === "select") {
            const options = Array.isArray(f.options) ? f.options.map((o) => String(o).trim()).filter(Boolean) : [];
            if (options.length < 2) continue;
            field.options = options;
        }
        if (f.placeholder) field.placeholder = String(f.placeholder);
        seen.add(name.toLowerCase());
        out.push(field);
    }
    return out;
}

function fieldPrompt({ businessType, tone, targetAudience, heading }) {
    return `Design the order or enquiry form for this business.

Business: ${businessType}
Tone: ${tone || "professional"}
Audience: ${targetAudience || "general customers"}
Form heading: ${heading || "Get in touch"}

Return ONLY JSON: { "dynamicFields": [ { "name": "snake_case_id", "label": "Visible label", "type": "text|email|tel|number|select|textarea|date", "options": ["only for select"], "placeholder": "optional", "required": true } ] }
Rules: 5 to 8 fields; include a name field and a phone or email field; the other fields must be specific to what a customer of THIS business would order, book or ask about; every "select" needs 3 to 7 realistic options.`;
}

function extractJson(text) {
    const fence = String(text || "").match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fence ? fence[1] : (String(text || "").match(/\{[\s\S]*\}/) || ["{}"])[0];
    try { return JSON.parse(raw.trim()); } catch { return {}; }
}

/**
 * Repair empty or invalid forms in place.
 * @param {object} layout   { pages: [{ sections: [...] }] }
 * @param {object} ctx      { businessType, tone, targetAudience }
 * @param {(prompt:string)=>Promise<string>} generate  local-model call returning raw text
 * @returns {Promise<object>} statistics for logging and evaluation
 */
export async function repairForms(layout, ctx, generate) {
    const stats = { dynamicForms: 0, validAsIs: 0, regenerated: 0, defaulted: 0, contactDefaulted: 0, llmCalls: 0, llmMs: 0 };
    for (const page of layout?.pages || []) {
        for (const section of page?.sections || []) {
            if (!section || typeof section !== "object") continue;
            section.props = section.props || {};
            const p = section.props;
            if (section.type === "ContactForm") {
                const f = Array.isArray(p.fields) ? p.fields.filter((x) => typeof x === "string" && x.trim()) : [];
                if (f.length === 0) { p.fields = [...DEFAULT_CONTACT_FIELDS]; stats.contactDefaulted++; }
                continue;
            }
            if (section.type !== "DynamicForm") continue;
            stats.dynamicForms++;
            const current = validFields(p.dynamicFields || p.fields);
            if (current.length >= MIN_FIELDS) { p.dynamicFields = current; delete p.fields; stats.validAsIs++; continue; }
            let repaired = [];
            try {
                const t0 = Date.now();
                stats.llmCalls++;
                const text = await generate(fieldPrompt({ ...ctx, heading: p.heading }));
                stats.llmMs += Date.now() - t0;
                repaired = validFields(extractJson(text).dynamicFields);
            } catch { repaired = []; }
            if (repaired.length >= MIN_FIELDS) { p.dynamicFields = repaired.slice(0, 8); stats.regenerated++; }
            else { p.dynamicFields = DEFAULT_DYNAMIC_FIELDS.map((f) => ({ ...f })); stats.defaulted++; }
            delete p.fields;
        }
    }
    return stats;
}
