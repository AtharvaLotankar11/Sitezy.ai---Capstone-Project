/**
 * PII redaction for data that leaves the host on the cloud-LLM fallback path.
 *
 * Visitor- and user-submitted data (form submissions, chatbot and help-assistant
 * questions) is passed through redactPII()/redactText() before any cloud call. The local
 * model receives the original data, which never leaves the machine. Owner-authored site
 * content is intended for public publication and is not redacted.
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Phone-number candidates; only replaced when they carry 9+ digits, so dates,
// quantities and prices (e.g. "2026-10-04", "1500000") survive for analytics.
const PHONE_CANDIDATE = /\+?\d[\d\s().-]{7,}\d/g;

const PERSONAL_WORDS = new Set(["email", "mail", "phone", "mobile", "tel", "telephone", "whatsapp", "address", "contact"]);
const NAME_FIELDS = new Set(["name", "surname", "fullname", "firstname", "lastname"]);
const NAME_QUALIFIERS = new Set(["full", "first", "last", "sur", "customer", "client", "guest", "patient", "your", "user", "contact", "person", "parent", "student"]);

const keyWords = (key) =>
    String(key).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// True for field names that identify a person ("email", "phone_number", "customer_name",
// "firstName"); false for descriptive fields such as "product_name" or "juice_type".
export function isPersonalKey(key) {
    const words = keyWords(key);
    if (words.some((w) => PERSONAL_WORDS.has(w))) return true;
    if (NAME_FIELDS.has(words.join(""))) return true;
    return words.includes("name") && words.some((w) => NAME_QUALIFIERS.has(w));
}

export function redactText(text) {
    return String(text)
        .replace(EMAIL, "[email]")
        .replace(PHONE_CANDIDATE, (m) => (m.replace(/\D/g, "").length >= 9 ? "[phone]" : m));
}

// Deep-redacts plain objects/arrays: personal fields are masked wholesale, every other
// string is scrubbed of e-mail addresses and phone numbers. Non-plain objects (e.g.
// Firestore Timestamps) and non-string scalars are returned unchanged.
export function redactPII(value) {
    if (typeof value === "string") return redactText(value);
    if (Array.isArray(value)) return value.map(redactPII);
    if (value && typeof value === "object") {
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null) return value;
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = isPersonalKey(k) && v != null && v !== "" ? "[redacted]" : redactPII(v);
        }
        return out;
    }
    return value;
}
