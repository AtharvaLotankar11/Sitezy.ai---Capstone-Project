import { GoogleGenerativeAI } from "@google/generative-ai";
import ollama, { Ollama } from "ollama";
import Joi from "joi";
import AIUsageLog from "./aiUsageLog.model.js";
import Page from "../builder/page.model.js";
import Website from "../website/website.model.js";
import Tenant from "../tenant/tenant.model.js";
import Deployment from "../deployment/deployment.model.js";
import { v4 as uuidv4 } from "uuid";
import FirebaseAgent from "../../agents/firebaseAgent.js";
import { aiUsageTotal } from "../../utils/metrics.js";
import { searchUnsplash, searchUnsplashBatch } from "../../services/unsplash.service.js";
import { redactText } from "../../utils/redact.js";
import { repairForms } from "./formRepair.js";
import axios from "axios";


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configure Ollama client with host from environment
const ollamaClient = new Ollama({
    host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
});

const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
});

const VALID_SECTION_TYPES = ["Hero", "Text", "Gallery", "CTA", "ContactForm", "DynamicForm", "Navbar", "Footer"];

// ─── Bad Image Query Filter ────────────────────────────────────────────────────
const BAD_IMAGE_QUERIES = [
    "chart", "graph", "analytics", "dashboard", "office building",
    "infographic", "diagram", "spreadsheet", "data", "statistics",
    "wireframe", "mockup", "ui screenshot", "app screenshot", "icon", "logo"
];

// ─── Curated Unsplash Photo ID Map (keyword → Unsplash photo ID) ──────────────
// These are real, reliable Unsplash photo IDs that produce great imagery
const UNSPLASH_PHOTO_MAP = {
    // Coffee / Cafe
    coffee: "photo-1495474472287-4d71bcdd2085",
    latte: "photo-1541167760496-1628856ab772",
    barista: "photo-1501339847302-ac426a4a7cbb",
    cafe: "photo-1559925393-8be0ec4767c8",
    espresso: "photo-1510591509098-f4fdc6d0ff04",
    // Restaurant / Food
    restaurant: "photo-1414235077428-338989a2e8c0",
    food: "photo-1504674900247-0877df9cc836",
    chef: "photo-1577219491135-ce391730fb2c",
    dining: "photo-1517248135467-4c7edcad34c4",
    gourmet: "photo-1555939594-58d7cb561ad1",
    pizza: "photo-1513104890138-7c749659a591",
    sushi: "photo-1553621042-f6e147245754",
    bakery: "photo-1509440159596-0249088772ff",
    // Fitness / Gym
    fitness: "photo-1534438327276-14e5300c3a48",
    gym: "photo-1571019613454-1cb2f99b2d8b",
    yoga: "photo-1593810450967-f9c42742e326",
    workout: "photo-1517836357463-d25dfeac3438",
    athlete: "photo-1552674605-db6ffd4facb5",
    runner: "photo-1476480862126-209bfaa8edc8",
    // Tech / SaaS
    tech: "photo-1496181133206-80ce9b88a853",
    startup: "photo-1497366216548-37526070297c",
    developer: "photo-1517180102446-f3ece451e9d8",
    code: "photo-1555066931-4365d14bab8c",
    laptop: "photo-1496181133206-80ce9b88a853",
    software: "photo-1518770660439-4636190af475",
    // Fashion
    fashion: "photo-1558769132-cb1aea458c5e",
    clothing: "photo-1445205170230-053b83016050",
    model: "photo-1496747611176-843222e1e57c",
    luxury: "photo-1515886657613-9f3515b0c78f",
    boutique: "photo-1441986300917-64674bd600d8",
    // Medical / Health
    medical: "photo-1576091160550-2173dba999ef",
    doctor: "photo-1559839734-2b71ea197ec2",
    healthcare: "photo-1519494026892-80bbd2d6fd0d",
    clinic: "photo-1538108149393-fbbd82ab8c59",
    hospital: "photo-1551190822-a9333d879b1f",
    // Real Estate
    "real estate": "photo-1560518883-ce09059eeffa",
    home: "photo-1568605114967-8130f3a36994",
    interior: "photo-1616486338812-3dadae4b4ace",
    architecture: "photo-1486325212027-8081e485255e",
    property: "photo-1600585154340-be6161a56a0c",
    villa: "photo-1600596542815-ffad4c1539a9",
    // Beauty / Spa
    beauty: "photo-1522337360788-8b13dee7a37e",
    spa: "photo-1519823551278-64ac92734fb1",
    skincare: "photo-1570172619644-dfd03ed5d881",
    salon: "photo-1562322140-8baeececf3df",
    makeup: "photo-1487412840662-9f0b5e0bc9ab",
    // Travel
    travel: "photo-1488646953014-85cb44e25828",
    beach: "photo-1507525428034-b723cf961d3e",
    mountain: "photo-1464822759023-fed622ff2c3b",
    paris: "photo-1499856871958-5b9627545d1a",
    hotel: "photo-1566073771259-6a8506099945",
    tropical: "photo-1539367628448-4bc5c9d171c8",
    // Law / Finance / Corporate
    law: "photo-1589829545856-d10d557cf95f",
    legal: "photo-1568027762272-e4da8b386fe9",
    finance: "photo-1611974789855-9c2a0a7236a3",
    business: "photo-1507679799987-c73779587ccf",
    corporate: "photo-1497366754035-f200968a6e72",
    office: "photo-1497366811353-6870744d04b2",
    meeting: "photo-1552664730-d307ca884978",
    // Creative / Design
    creative: "photo-1558618666-fcd25c85cd64",
    design: "photo-1561070791-2526d30994b5",
    art: "photo-1579783902614-a3fb3927b6a5",
    studio: "photo-1531746020798-e6953c6e8e04",
    photography: "photo-1452587925148-ce544e77e70d",
    // Education
    education: "photo-1509062522246-3755977927d7",
    university: "photo-1541339907198-e08756dedf3f",
    library: "photo-1481627834876-b7833e8f5570",
    student: "photo-1523240795612-9a054b0db644",
    classroom: "photo-1580582932707-520aed937b7b",
    // Generic
    professional: "photo-1521737711867-e3b97375f902",
    team: "photo-1522071820081-009f0129c71c",
    workspace: "photo-1497366216548-37526070297c",
    modern: "photo-1497366811353-6870744d04b2",
    abstract: "photo-1557683316-973673baf926",
    nature: "photo-1501854140801-50d01698950b",
    city: "photo-1477959858617-67f85cf4f1df",
};

// ─── Business Keyword Context Map ─────────────────────────────────────────────
const BUSINESS_CONTEXT_QUERIES = {
    coffee: ["coffee", "latte", "barista", "cafe", "espresso"],
    restaurant: ["restaurant", "food", "chef", "dining", "gourmet"],
    fitness: ["fitness", "gym", "yoga", "workout", "athlete"],
    tech: ["tech", "startup", "developer", "code", "software"],
    fashion: ["fashion", "clothing", "model", "luxury", "boutique"],
    medical: ["medical", "doctor", "healthcare", "clinic", "hospital"],
    real_estate: ["home", "interior", "architecture", "property", "villa"],
    beauty: ["beauty", "spa", "skincare", "salon", "makeup"],
    education: ["education", "university", "library", "student", "classroom"],
    travel: ["travel", "beach", "mountain", "hotel", "tropical"],
    law: ["law", "legal", "corporate", "meeting", "office"],
    finance: ["finance", "business", "corporate", "office", "meeting"],
    food: ["food", "restaurant", "chef", "bakery", "gourmet"],
    creative: ["creative", "design", "studio", "art", "photography"],
};

// ─── Image Intelligence Functions ─────────────────────────────────────────────

/**
 * Resolve a keyword query or string to a real Unsplash image URL
 */
function resolveImageUrl(queryOrKey, width = 800, height = 600) {
    if (!queryOrKey) return buildUnsplashUrl("photo-1497366216548-37526070297c", width, height);
    // Already a full URL
    if (queryOrKey.startsWith("https://images.unsplash.com")) {
        return queryOrKey;
    }
    const lower = queryOrKey.toLowerCase();
    // Try exact key match first
    if (UNSPLASH_PHOTO_MAP[lower]) {
        return buildUnsplashUrl(UNSPLASH_PHOTO_MAP[lower], width, height);
    }
    // Try substring match
    const matchedKey = Object.keys(UNSPLASH_PHOTO_MAP).find(key => lower.includes(key));
    if (matchedKey) {
        return buildUnsplashUrl(UNSPLASH_PHOTO_MAP[matchedKey], width, height);
    }
    // Hash-based fallback
    const fallbacks = [
        "photo-1497366216548-37526070297c",
        "photo-1522071820081-009f0129c71c",
        "photo-1560518883-ce09059eeffa",
        "photo-1507679799987-c73779587ccf",
        "photo-1531746020798-e6953c6e8e04",
        "photo-1558618666-fcd25c85cd64",
    ];
    const hash = [...lower].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return buildUnsplashUrl(fallbacks[hash % fallbacks.length], width, height);
}

function buildUnsplashUrl(photoId, width, height) {
    return `https://images.unsplash.com/${photoId}?w=${width}&h=${height}&fit=crop&auto=format&q=80`;
}

/**
 * Detect if a query is invalid (abstract/non-photographic)
 */
function isBadImageQuery(query) {
    if (!query || typeof query !== "string") return true;
    const q = query.toLowerCase();
    return BAD_IMAGE_QUERIES.some((bad) => q.includes(bad));
}

/**
 * Get contextual image keyword keys for a business type (matched to UNSPLASH_PHOTO_MAP)
 */
function getContextQueries(businessType) {
    if (!businessType) return ["professional", "workspace", "team", "office", "modern"];
    const bt = businessType.toLowerCase();
    for (const [key, queries] of Object.entries(BUSINESS_CONTEXT_QUERIES)) {
        if (bt.includes(key)) return queries;
    }
    // Generic fallback keywords that exist in UNSPLASH_PHOTO_MAP
    return ["professional", "workspace", "team", "office", "modern"];
}

/**
 * Sanitize a single image query — returns a keyword that exists in UNSPLASH_PHOTO_MAP
 */
function sanitizeImageQuery(query, businessType, usedQueries) {
    let sanitized = query;

    // Replace bad/abstract queries
    if (isBadImageQuery(sanitized)) {
        const contextQueries = getContextQueries(businessType);
        sanitized = contextQueries.find((q) => !usedQueries.has(q)) || "professional";
    }

    // Handle duplicates
    if (usedQueries.has(sanitized)) {
        const contextQueries = getContextQueries(businessType);
        const fresh = contextQueries.find((q) => !usedQueries.has(q));
        // Pick a variant from UNSPLASH_PHOTO_MAP keys
        const allKeys = Object.keys(UNSPLASH_PHOTO_MAP);
        sanitized = fresh || allKeys[usedQueries.size % allKeys.length];
    }

    usedQueries.add(sanitized);
    return sanitized;
}

/**
 * Post-process AI output: collect all imageQuery values, batch-resolve with
 * real Unsplash API, then write the actual photo URLs back into the layout.
 * @param {object} layout      - Parsed AI layout JSON
 * @param {string} businessType
 * @returns {Promise<object>}  - Layout with all image fields resolved
 */
async function postProcessAIOutput(layout, businessType) {
    if (!layout || !layout.pages) return layout;

    const usedKeys = new Set();

    // ── Step 1: Collect all queries needing resolution ─────────────────────────
    const pendingHero = [];   // { pageIdx, secIdx, key }
    const pendingItems = [];  // { pageIdx, secIdx, itemIdx, key }

    layout.pages.forEach((page, pi) => {
        if (!page.sections) return;
        page.sections.forEach((section, si) => {
            if (!section.props) section.props = {};

            if (section.type === "Text" && section.props.text && !section.props.description) {
                section.props.description = section.props.text;
                delete section.props.text;
            }

            if (section.type === "ContactForm" && Array.isArray(section.props.fields)) {
                section.props.fields = section.props.fields.map(f => {
                    if (typeof f === "object" && f !== null) return f.name || f.label || "message";
                    return String(f);
                });
            }

            // ── Normalise DynamicForm fields ────────────────────────────────────
            if (section.type === "DynamicForm") {
                // Qwen may output under 'fields' or 'dynamicFields' — normalise to 'dynamicFields'
                const rawFields = section.props.dynamicFields || section.props.fields;
                if (Array.isArray(rawFields) && rawFields.length > 0) {
                    section.props.dynamicFields = rawFields.map(f => {
                        // If it's just a string like "name" – convert to object
                        if (typeof f === "string") return { name: f, label: f.charAt(0).toUpperCase() + f.slice(1), type: "text" };
                        // Ensure all required keys exist
                        return {
                            name: f.name || f.label?.toLowerCase().replace(/\s+/g, "_") || "field",
                            label: f.label || f.name || "Field",
                            type: f.type || "text",
                            ...(f.options ? { options: f.options } : {}),
                            ...(f.placeholder ? { placeholder: f.placeholder } : {}),
                            ...(f.required !== undefined ? { required: f.required } : { required: true }),
                        };
                    });
                    delete section.props.fields; // avoid confusion
                }
            }

            if (section.type === "Gallery" && Array.isArray(section.props.items)) {
                section.props.items = section.props.items.map((item, ii) => {
                    if (typeof item === "string") {
                        item = { title: item, description: `Exceptional ${item.toLowerCase()} quality.`, imageQuery: item };
                    }
                    if (typeof item === "object" && item !== null) {
                        let key;
                        if (item.imageQuery && !isBadImageQuery(item.imageQuery)) {
                            key = sanitizeImageQuery(item.imageQuery, businessType, usedKeys);
                        } else if (item.title) {
                            key = sanitizeImageQuery(item.title, businessType, usedKeys);
                        } else {
                            const cq = getContextQueries(businessType);
                            key = cq.find(q => !usedKeys.has(q)) || "professional";
                            usedKeys.add(key);
                        }
                        item.imageQuery = key;
                        item.title = item.title || "Untitled";
                        item.description = item.description || `Experience world-class ${businessType} quality.`;
                        pendingItems.push({ pi, si, ii });
                    }
                    return item;
                });
            }

            if (section.type === "Hero") {
                let heroKey;
                if (section.props.backgroundImage?.startsWith("http")) {
                    heroKey = null; // already a URL
                } else if (section.props.backgroundImageQuery) {
                    heroKey = sanitizeImageQuery(section.props.backgroundImageQuery, businessType, usedKeys);
                } else {
                    const cq = getContextQueries(businessType);
                    heroKey = cq.find(q => !usedKeys.has(q)) || cq[0];
                    usedKeys.add(heroKey);
                }
                if (heroKey) {
                    section.props.backgroundImageQuery = heroKey;
                    pendingHero.push({ pi, si, key: heroKey });
                }
            }
        });
    });

    // ── Step 2: Batch-fetch all hero images ────────────────────────────────────
    const heroQueries = [...new Set(pendingHero.map(h => h.key))];
    const itemQueries = [...new Set(
        pendingItems.map(({ pi, si, ii }) => layout.pages[pi].sections[si].props.items[ii].imageQuery)
    )];

    const [heroImages, itemImages] = await Promise.all([
        heroQueries.length ? searchUnsplashBatch(heroQueries, 1400, 900) : Promise.resolve({}),
        itemQueries.length ? searchUnsplashBatch(itemQueries, 640, 480) : Promise.resolve({}),
    ]);

    // ── Step 3: Write URLs back ─────────────────────────────────────────────────
    pendingHero.forEach(({ pi, si, key }) => {
        const resolved = heroImages[key];
        if (resolved?.url) {
            layout.pages[pi].sections[si].props.backgroundImage = resolved.url;
        } else {
            layout.pages[pi].sections[si].props.backgroundImage = resolveImageUrl(key, 1400, 900);
        }
    });

    pendingItems.forEach(({ pi, si, ii }) => {
        const item = layout.pages[pi].sections[si].props.items[ii];
        const resolved = itemImages[item.imageQuery];
        item.image = resolved?.url || resolveImageUrl(item.imageQuery, 640, 480);
    });

    return layout;
}


/**
 * Build a minimal fallback layout if AI completely fails
 */
function buildFallbackLayout(businessType, tone, targetAudience) {
    return {
        pages: [
            {
                title: "Home",
                slug: "home",
                sections: [
                    {
                        type: "Navbar",
                        props: {
                            brand: businessType,
                            links: ["Home", "About", "Services", "Contact"],
                            variant: "Full Width Solid",
                            bgColor: "#ffffff",
                            textColor: "#111827",
                            accentColor: "#6366f1",
                        },
                    },
                    {
                        type: "Hero",
                        props: {
                            heading: `Welcome to ${businessType}`,
                            subheading: `We serve ${targetAudience} with premium ${businessType.toLowerCase()} services.`,
                            ctaText: "Get Started",
                            ctaLink: "#contact",
                            variant: "Split Text Left",
                            bgColor: "#ffffff",
                            textColor: "#111827",
                            accentColor: "#6366f1",
                            backgroundImageQuery: `${businessType} professional photography`,
                        },
                    },
                    {
                        type: "Text",
                        props: {
                            heading: "About Us",
                            description: `We are a ${tone} company focused on delivering excellence to ${targetAudience}.`,
                            variant: "Centered Standard",
                            bgColor: "#f9fafb",
                            textColor: "#111827",
                            accentColor: "#6366f1",
                        },
                    },
                    {
                        type: "Gallery",
                        props: {
                            heading: "Our Services",
                            items: [
                                { title: "Service One", description: "Premium quality service.", imageQuery: `${businessType} service photography` },
                                { title: "Service Two", description: "Expert solutions for you.", imageQuery: `${businessType} professional team` },
                                { title: "Service Three", description: "Tailored to your needs.", imageQuery: `${businessType} modern workspace` },
                            ],
                            variant: "Modern Grid",
                            bgColor: "#ffffff",
                            textColor: "#111827",
                            accentColor: "#6366f1",
                        },
                    },
                    {
                        type: "CTA",
                        props: {
                            heading: "Ready to get started?",
                            subheading: "Join hundreds of happy customers.",
                            ctaText: "Contact Us Today",
                            ctaLink: "#contact",
                            variant: "Centered Large",
                            bgColor: "#ffffff",
                            textColor: "#111827",
                            accentColor: "#6366f1",
                        },
                    },
                    {
                        type: "ContactForm",
                        props: {
                            heading: "Get In Touch",
                            fields: ["name", "email", "phone", "message"],
                            variant: "Left Text Right Form",
                            bgColor: "#f9fafb",
                            textColor: "#111827",
                            accentColor: "#6366f1",
                        },
                    },
                    {
                        type: "Footer",
                        props: {
                            text: `© ${new Date().getFullYear()} ${businessType}. All rights reserved.`,
                            variant: "Multi-Column Mock",
                            bgColor: "#111827",
                            textColor: "#9ca3af",
                            accentColor: "#6366f1",
                        },
                    },
                ],
            },
            {
                title: "About",
                slug: "about",
                sections: [
                    {
                        type: "Navbar",
                        props: { brand: businessType, links: ["Home", "About", "Services", "Contact"], variant: "Full Width Solid", bgColor: "#ffffff", textColor: "#111827", accentColor: "#6366f1" },
                    },
                    {
                        type: "Text",
                        props: { heading: "Our Story", description: `Founded with a mission to serve ${targetAudience}, we are dedicated to excellence.`, variant: "Left Aligned Big", bgColor: "#ffffff", textColor: "#111827", accentColor: "#6366f1" },
                    },
                    {
                        type: "Footer",
                        props: { text: `© ${new Date().getFullYear()} ${businessType}.`, variant: "Simple Centered", bgColor: "#111827", textColor: "#9ca3af", accentColor: "#6366f1" },
                    },
                ],
            },
            {
                title: "Contact",
                slug: "contact",
                sections: [
                    {
                        type: "Navbar",
                        props: { brand: businessType, links: ["Home", "About", "Services", "Contact"], variant: "Full Width Solid", bgColor: "#ffffff", textColor: "#111827", accentColor: "#6366f1" },
                    },
                    {
                        type: "ContactForm",
                        props: { heading: "Contact Us", fields: ["name", "email", "message"], variant: "Centered Card", bgColor: "#ffffff", textColor: "#111827", accentColor: "#6366f1" },
                    },
                    {
                        type: "Footer",
                        props: { text: `© ${new Date().getFullYear()} ${businessType}.`, variant: "Simple Centered", bgColor: "#111827", textColor: "#9ca3af", accentColor: "#6366f1" },
                    },
                ],
            },
        ],
    };
}

// ─── Joi Schemas ───────────────────────────────────────────────────────────────
const aiLayoutSchema = Joi.object({
    pages: Joi.array()
        .items(
            Joi.object({
                title: Joi.string().required(),
                slug: Joi.string().required(),
                sections: Joi.array()
                    .items(
                        Joi.object({
                            type: Joi.string()
                                .valid(...VALID_SECTION_TYPES)
                                .required(),
                            props: Joi.any().default({}),
                        }).unknown(true)
                    )
                    .required(),
            }).unknown(true)
        )
        .min(1)
        .required(),
}).unknown(true);

const inputSchema = Joi.object({
    businessType: Joi.string().min(2).max(200).required(),
    tone: Joi.string().min(2).max(100).required(),
    targetAudience: Joi.string().min(2).max(200).required(),
    features: Joi.array().items(Joi.string()).min(1).required(),
    websiteId: Joi.string().allow("").optional(),
    preferredModel: Joi.string().valid("qwen", "gemini").optional(),
    // Confirmed facts collected by the Prompt Tuner. Always optional — generation
    // behaves exactly as before when it is absent.
    brandDetails: Joi.object().unknown(true).optional(),
}).unknown(true);

// ─── Brand facts (Prompt Tuner answers → prompt block) ────────────────────────
// How each confirmed fact must be used, spelled out for the model. Keys match
// TUNE_FIELDS in the tuner below.
const BRAND_FACT_USAGE = {
    tagline: "Use this VERBATIM as the Hero heading (or as the Hero subheading if it is longer than 8 words). Do not reword it.",
    positioning: "This is the brand's positioning. Every page's copy must reflect this angle.",
    usp: "Lead the About/Text section with this differentiator and reference it in the CTA.",
    services: "These are the ONLY services/products to advertise. Use them for Gallery items, service lists and DynamicForm select options. Do not invent extra ones.",
    reviews: "REAL customer reviews. Render them as a Gallery section (e.g. heading \"What our customers say\") where each item's 'title' is the reviewer's name and 'description' is their quote, copied word for word. Never write additional reviews of your own.",
    address: "The REAL business address. Print it EXACTLY as given in the Footer and on the Contact page. Never substitute a different street, city or country anywhere on the site.",
    hours: "The REAL opening hours. Print them exactly as given in the Footer and on the Contact page.",
    cta: "Use this as the primary ctaText on the Hero and CTA sections.",
};

const BRAND_FACT_LABELS = {
    tagline: "Tagline", positioning: "Positioning / strategy", usp: "Unique selling point",
    services: "Services offered", reviews: "Customer reviews", address: "Business address",
    hours: "Opening hours", cta: "Primary call to action",
};

/** Render one answer (string, or array from a multi-select) as prompt text. */
const formatBrandFactValue = (value) => {
    if (Array.isArray(value)) {
        return value
            .map((v) => (typeof v === "string" ? v.trim() : JSON.stringify(v)))
            .filter(Boolean)
            .join(" | ");
    }
    return typeof value === "string" ? value.trim() : "";
};

/**
 * Build the CONFIRMED BRAND FACTS prompt block from tuner answers. Only keys the
 * user actually answered are included; returns "" when nothing was tuned.
 */
const formatBrandFacts = (brandDetails) => {
    if (!brandDetails || typeof brandDetails !== "object") return "";

    const lines = Object.keys(BRAND_FACT_USAGE)
        .map((key) => {
            const val = formatBrandFactValue(brandDetails[key]);
            if (!val) return null;
            return `- ${BRAND_FACT_LABELS[key]}: ${val}\n  → ${BRAND_FACT_USAGE[key]}`;
        })
        .filter(Boolean);

    if (lines.length === 0) return "";

    return `
CONFIRMED BRAND FACTS (PROVIDED BY THE BUSINESS OWNER — HIGHEST PRIORITY):
These are verified facts about the real business. Use them EXACTLY as written and build the
copy around them. NEVER invent an alternative to a fact given here, never contradict one, and
never replace one with a placeholder. Anything not listed here you may still write yourself.

${lines.join("\n")}
`;
};

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * POST /api/ai/generate-layout
 */
export const generateLayout = async (req, res) => {

    console.log("📥 [AI] Received request:", { body: req.body });

    const { error, value } = inputSchema.validate(req.body);

    if (error) {
        console.error("❌ [AI] Validation error:", error.details[0].message);
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    let {
        businessType,
        tone,
        targetAudience,
        features,
        websiteId,
        primaryColor,
        secondaryColor,
        theme,
        baseTemplateSections,
        preferredModel,
        brandDetails
    } = value;


    // ==========================================
    // STEP 1: CALL ML LAYOUT RECOMMENDER SERVICE
    // ==========================================

    let recommendedSections = [];

    try {

        const mlResponse = await axios.post(
            "http://localhost:5050/generate-layout",
            {
                businessType,
                tone,
                targetAudience
            }
        );

        /**
         * Flask response format:
         * {
         *   success: true,
         *   components: [...]
         * }
         */

        if (mlResponse.data?.components) {

            recommendedSections = mlResponse.data.components;

        }

        console.log("🤖 ML Recommended Sections:", recommendedSections);

    } catch (err) {

        console.warn("⚠️ ML recommender unavailable — fallback to manual features");

    }


    // ==========================================
    // STEP 2: MAP ML OUTPUT → BUILDER FEATURES
    // ==========================================

    /**
     * ML model outputs
     * Example:
     * hero_banner
     * gallery
     * testimonials
     * call_to_action
     *
     * Builder expects:
     * Hero
     * Gallery
     * CTA
     */

    const sectionMapping = {

        hero_banner: "Hero",
        hero: "Hero",

        gallery: "Gallery",
        gallery_section: "Gallery",

        testimonials: "Gallery", // map testimonials into gallery-style showcase section

        call_to_action: "CTA",
        cta: "CTA",

        contact_form: "ContactForm",
        contact_section: "ContactForm",

        navbar: "Navbar",

        footer: "Footer",

        blog_section: "Text",

        product_grid: "Gallery",

        booking_section: "ContactForm",

        // Blocks without a dedicated builder section map to the closest one; the block
        // name travels with it as a content hint (previously these were silently dropped).
        service_cards: "Gallery",
        pricing_table: "Gallery",
        team_section: "Gallery",
        faq: "Text",
        stats_counter: "Text",
        blog_preview: "Text",
        newsletter: "CTA"
    };


    // Convert ML output → builder section list; approximate mappings keep the block
    // name as a hint, e.g. "Gallery (pricing table)"

    const approximate = new Set(["testimonials", "product_grid", "booking_section", "service_cards",
        "pricing_table", "team_section", "faq", "stats_counter", "blog_preview", "newsletter"]);
    const mlFeatures = recommendedSections
        .filter(section => sectionMapping[section])
        .map(section => approximate.has(section)
            ? `${sectionMapping[section]} (${section.replace(/_/g, " ")})`
            : sectionMapping[section]);
    // The prompt requires an order form on every home page; the recommender's vocabulary
    // has no such block, so request it explicitly (otherwise a contact form replaces it).
    if (mlFeatures.length > 0 && !mlFeatures.includes("DynamicForm")) mlFeatures.push("DynamicForm");


    // ==========================================
    // STEP 3: AUTO-USE ML FEATURES IF AVAILABLE
    // ==========================================

    if (mlFeatures.length > 0) {

        console.log("✅ Using ML predicted layout features:", mlFeatures);

        features = mlFeatures;

    } else {

        console.log("⚠️ ML returned empty layout — using manual user selections");

    }

    // ==========================================
    // STEP 4: VERIFY WEBSITE OWNERSHIP
    // ==========================================

    let website = null;
    if (websiteId) {
        website = await Website.findOne({ _id: websiteId, tenantId: req.tenantId });
        if (!website) return res.status(404).json({ success: false, message: "Website not found" });
    }

    // Build context-aware image keywords for the prompt
    const contextImages = getContextQueries(businessType).slice(0, 5).join(" | ");

    // Facts confirmed through the Prompt Tuner — empty string when the user skipped it
    const brandFactsBlock = formatBrandFacts(brandDetails);

    const prompt = `
You are a world-class UI/UX designer and website architect. Your task is to generate a stunning, production-ready website layout in valid JSON. The output quality should match premium agencies like Webflow and Framer.

Business Type: ${businessType}
Tone: ${tone}
Theme: ${theme || "Light"}
Target Audience: ${targetAudience}
Key Sections Needed: ${features.join(", ")}
Relevant Image Contexts: ${contextImages}

${baseTemplateSections ? `
IMPORTANT - Base Template Override:
- Keep section TYPES exactly the same as provided in the Base Template.
- YOU MUST COMPLETELY REWRITE ALL TEXT content (headings, descriptions, list items, ctaText) and image queries to match the Business Type (${businessType}).
- DO NOT copy the placeholder text from the base template. It MUST be 100% relevant and specific to a ${businessType}.
Base Template:
${JSON.stringify(baseTemplateSections)}
` : ""}
${brandFactsBlock}
CRITICAL DESIGN RULES:
1. Create visually stunning layouts with strong hierarchy
2. Alternate section backgrounds for visual rhythm (white → light gray → white → etc.)
3. Dark theme: use #0f172a, #1e293b backgrounds with white text
4. Light theme: use #ffffff, #f9fafb backgrounds with #111827 text
5. CTA sections must visually stand out (use accent color as background)
6. Every section must have distinct personality

GALLERY ITEMS FORMAT (CRITICAL - MUST FOLLOW EXACTLY):
Gallery items MUST be objects in this exact format:
{
  "title": "Item Name",
  "description": "A compelling 1-2 sentence description.",
  "imageQuery": "specific realistic photo search term"
}

IMAGE QUERY RULES (VERY IMPORTANT):
- imageQuery MUST be a realistic Unsplash-style photo search term
- NEVER use: "chart", "graph", "analytics", "dashboard", "infographic", "diagram"
- ALWAYS use specific, photographic terms relevant to the business
- Example for coffee shop: "latte art pour barista", "cozy cafe interior morning", "coffee beans roasted closeup"
- Example for gym: "athlete training weights gym", "personal trainer coaching client", "yoga class studio morning"
- Make EVERY imageQuery UNIQUE — no duplicates across the entire response
- Be specific and descriptive (not generic like "coffee image" or "person working")

HERO BACKGROUNDIMAGEQUERY:
- Hero sections MUST include "backgroundImageQuery" field (a specific photo search term)
- Example: "modern coffee shop interior warm lighting" or "fitness studio aerial view"

SECTION VARIANTS (assign intelligently):
- Navbar: "Full Width Solid" | "Glassy Island" | "Minimal Transparent"
- Hero: "Split Text Left" | "Split Text Right" | "Centered Image Bg"
- Text: "Centered Standard" | "Left Aligned Big" | "Card Based"
- Gallery: "Modern Grid" | "Horizontal Scroll" | "Masonry Column" | "Bento Grid"
- CTA: "Centered Large" | "Floating Pill" | "Split Screen CTA" | "Dark Banner"
- ContactForm: "Left Text Right Form" | "Centered Card"
- DynamicForm: "Card Based" | "Split Left Text"
- Footer: "Multi-Column Mock" | "Simple Centered" | "Ultra Minimal"

CONTENT RULES:
- Write real, FULLY FLESHED OUT copy (not placeholder text).
- EXHAUSTIVE CONTENT (CRITICAL): You MUST provide rich content for EVERY section. NEVER leave 'heading', 'subheading', 'description', 'text', or 'fields' empty. If a section supports a description or subheading, YOU MUST WRITE IT!
- Hero: powerful headline (max 8 words), compelling subheading (2-3 sentences), strong CTA
- Text: substantive content describing the business in detail (3-4 sentences minimum)
- Gallery: 4-6 diverse, non-repeating items with unique 'title', 'description' (at least 2 sentences), and 'imageQuery'
- CTA: conversion-focused copy with a compelling subheading
- ContactForm: include fields relevant to the business (e.g., phone for medical, budget for agencies)
- CONTACT FORM FIELDS (CRITICAL): The 'fields' property MUST be a flat array of STRING primitives (e.g. ["name", "email", "phone", "message"]), NEVER an array of objects.
- DYNAMIC FORM (CRITICAL — READ CAREFULLY):
  * Use 'dynamicFields' key (NOT 'fields') inside DynamicForm props.
  * MUST be an array of field objects, each with: name, label, type, and optionally options (for select), placeholder, required.
  * Field types allowed: "text", "email", "tel", "number", "select", "textarea", "date"
  * Generate 5-8 fields that are HYPER-SPECIFIC to the actual business. Think about what a real customer of THIS business would order or enquire about.
  * Example for a Juice Bar:
    dynamicFields: [
      {"name":"customer_name","label":"Your Name","type":"text","placeholder":"e.g. Rahul Sharma","required":true},
      {"name":"phone","label":"Phone Number","type":"tel","placeholder":"+91 9876543210","required":true},
      {"name":"juice_type","label":"Choose Your Juice","type":"select","options":["Fresh Orange","Watermelon","Mixed Fruit","Green Detox","ABC Juice","Pomegranate"],"required":true},
      {"name":"size","label":"Size","type":"select","options":["Small (250ml)","Medium (500ml)","Large (750ml)"],"required":true},
      {"name":"quantity","label":"Quantity","type":"number","placeholder":"1","required":true},
      {"name":"add_ons","label":"Add-ons","type":"select","options":["None","Chia Seeds","Honey","Ginger Shot","Protein Boost"],"required":false},
      {"name":"delivery_time","label":"Preferred Delivery Time","type":"select","options":["Morning (8am-12pm)","Afternoon (12pm-4pm)","Evening (4pm-8pm)"],"required":true},
      {"name":"special_instructions","label":"Special Instructions","type":"textarea","placeholder":"Allergies, preferences...","required":false}
    ]
  * Example for a Salon:
    dynamicFields: [
      {"name":"name","label":"Full Name","type":"text","required":true},
      {"name":"phone","label":"Phone","type":"tel","required":true},
      {"name":"service","label":"Service","type":"select","options":["Haircut","Hair Color","Facial","Manicure","Pedicure","Waxing","Bridal Package"],"required":true},
      {"name":"stylist","label":"Preferred Stylist","type":"select","options":["Any Available","Senior Stylist","Junior Stylist"],"required":false},
      {"name":"appointment_date","label":"Appointment Date","type":"date","required":true},
      {"name":"notes","label":"Special Requests","type":"textarea","required":false}
    ]
  * NEVER generate generic fields like just name/email/message for a DynamicForm — those belong in ContactForm.

Return ONLY valid JSON in this exact structure (no markdown, no explanation):

{
  "pages": [
    {
      "title": "Page Title",
      "slug": "page-slug",
      "sections": [
        {
          "type": "SectionType",
          "props": {
            "heading": "...",
            "subheading": "...",
            "description": "...",
            "ctaText": "...",
            "ctaLink": "#",
            "brand": "...",
            "links": ["Home", "About", "Services", "Contact"],
            "items": [],
            "text": "...",
            "fields": ["name", "email", "message"],
            "dynamicFields": [{"name": "quantity", "label": "Quantity", "type": "number"}],
            "variant": "...",
            "bgColor": "#hex",
            "textColor": "#hex",
            "accentColor": "#hex",
            "backgroundImageQuery": "..."
          }
        }
      ]
    }
  ]
}

MANDATORY PAGE RULES:
- Every page MUST start with Navbar and end with Footer
- Generate exactly 3 pages: Home, About, Contact
- Home page MUST include: Navbar, Hero, Text, Gallery, CTA, DynamicForm, Footer
${brandDetails?.reviews ? `- The Home page MUST ALSO include a SECOND Gallery section holding the confirmed customer reviews (title = reviewer name, description = their exact quote, imageQuery = a portrait photo term such as "smiling customer portrait cafe"). Use ONLY the reviews provided above — do not add any of your own.` : ""}
${brandFactsBlock ? `- Re-read the CONFIRMED BRAND FACTS above before writing each section, and reproduce every fact exactly.` : ""}
- About page: Navbar, Hero or Text, Text, Gallery (team/values), Footer
- Contact page: Navbar, ContactForm, Footer

COLOR RULES:
- primaryColor hint: ${primaryColor || "choose sophisticated accent color matching business"}
- secondaryColor hint: ${secondaryColor || "choose complementary secondary"}
- Use accentColor consistently for brand identity
- Never use pure black (#000000) as background in light mode
`.trim();

    let aiResponse = null;
    let success = true;
    let errorMessage = null;
    let usedModel = preferredModel === "gemini" ? "gemini-3-flash-preview" : "qwen:4b (Ollama)";

    try {
        let text = "";
        if (preferredModel === "gemini") {
            console.log("🔵 [AI] User requested Pro AI directly. Skipping Basic AI.");
            const result = await model.generateContent(prompt);
            text = result.response.text();
            console.log("🔵 [AI] Successfully used Pro AI for content generation.");
        } else {
            try {
                console.log("🤖 [AI] Attempting generation with Basic AI (Ollama qwen3.5)...");
                const r = await ollamaClient.chat({
                    model: 'qwen3.5:4b',
                    think: false,
                    messages: [
                        { role: 'system', content: 'You are an expert AI website generator and elite copywriter. You MUST generate unique, engaging content perfectly tailored to the requested business type. NEVER blindly copy placeholder text from templates.' },
                        { role: 'user', content: prompt }
                    ],
                    format: 'json',
                    options: {
                        num_predict: 5000,
                        num_ctx: 8192,
                        temperature: 0.1
                    }
                });
                text = r.message.content || '';
                console.log("🟢 [AI] Successfully used Basic AI for content generation.");
            } catch (ollamaErr) {
                console.warn("⚠️ [AI] Basic AI failed, falling back to Pro AI...");
                console.warn("⚠️ [AI] Basic AI Error:", ollamaErr.message);
                usedModel = "gemini-3-flash-preview";
                const result = await model.generateContent(prompt);
                text = result.response.text();
                console.log("🔵 [AI] Successfully used Pro AI for content generation.");
            }
        }

        // Extract JSON from response (handle markdown code blocks)
        let jsonStr = text;
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        } else {
            const objMatch = text.match(/\{[\s\S]*\}/);
            if (objMatch) jsonStr = objMatch[0];
        }

        let parsed;
        try {
            parsed = JSON.parse(jsonStr.trim());
        } catch (parseErr) {
            console.error("❌ [AI] Failed to parse JSON, using fallback layout. Error:", parseErr.message);
            console.error("📄 [AI] Raw Output Length:", text?.length);
            console.error("📄 [AI] Raw JSON Snippet:", jsonStr?.substring(0, 1000) + (jsonStr?.length > 1000 ? "..." : ""));
            parsed = buildFallbackLayout(businessType, tone, targetAudience);
        }

        // Validate structure
        const { error: valErr, value: validated } = aiLayoutSchema.validate(parsed);
        if (valErr) {
            console.error(`⚠️ [AI] Layout validation failed: ${valErr.details[0].message}, using fallback`);
            parsed = buildFallbackLayout(businessType, tone, targetAudience);
            const { value: fallbackValidated } = aiLayoutSchema.validate(parsed);
            aiResponse = await postProcessAIOutput(fallbackValidated, businessType);
        } else {
            // Post-process: enforce image query structure, uniqueness, then fetch real Unsplash URLs
            aiResponse = await postProcessAIOutput(validated, businessType);
        }

        // The layout schema checks structure, not content: validate every form and
        // regenerate only empty ones with a short local call (deterministic default on failure).
        const formStats = await repairForms(aiResponse, { businessType, tone, targetAudience }, async (formPrompt) => {
            const r = await ollamaClient.chat({
                model: "qwen3.5:4b", think: false, format: "json",
                messages: [{ role: "user", content: formPrompt }],
                options: { num_predict: 900, num_ctx: 4096, temperature: 0.3 },
            });
            return r.message?.content || "";
        });
        if (formStats.regenerated || formStats.defaulted || formStats.contactDefaulted) {
            console.log("📝 [AI] Form repair:", formStats);
        }

        // If websiteId provided, save pages to DB
        if (website) {
            const autoPublish = req.query.autoPublish === "true" || req.body.autoPublish === true;

            // Map the first generated page onto the project's existing homepage (instead of
            // creating a second "Home"), so a full generation never leaves a stale placeholder.
            const existingHome = await Page.findOne({ websiteId: website._id, tenantId: req.tenantId, isHomePage: true });
            const savedPages = [];
            let homeHandled = false;

            for (let i = 0; i < aiResponse.pages.length; i++) {
                const pageData = aiResponse.pages[i];
                const sectionsWithIds = pageData.sections.map((s, idx) => ({
                    id: uuidv4(),
                    type: s.type,
                    props: {
                        ...(s.props || {}),
                        accentColor: primaryColor || s.props?.accentColor || undefined,
                        secondaryColor: secondaryColor || s.props?.secondaryColor || undefined,
                    },
                    order: idx,
                }));
                const slug = pageData.slug.toLowerCase();
                const isHome = i === 0 || slug === "home";

                if (isHome && existingHome && !homeHandled) {
                    existingHome.title = pageData.title;
                    existingHome.layoutConfig = { sections: sectionsWithIds };
                    existingHome.status = autoPublish ? "published" : "draft";
                    existingHome.markModified("layoutConfig");
                    await existingHome.save();
                    homeHandled = true;
                    savedPages.push(existingHome);
                    continue;
                }

                const existing = await Page.findOne({ websiteId: website._id, slug, tenantId: req.tenantId });
                if (existing) {
                    existing.layoutConfig = { sections: sectionsWithIds };
                    existing.title = pageData.title;
                    existing.status = autoPublish ? "published" : "draft";
                    existing.markModified("layoutConfig");
                    await existing.save();
                    savedPages.push(existing);
                } else {
                    const created = await Page.create({
                        tenantId: req.tenantId,
                        websiteId: website._id,
                        title: pageData.title,
                        slug,
                        isHomePage: isHome && !existingHome && !homeHandled,
                        layoutConfig: { sections: sectionsWithIds },
                        status: autoPublish ? "published" : "draft",
                        createdBy: req.user._id,
                    });
                    if (created.isHomePage) homeHandled = true;
                    savedPages.push(created);
                }
            }

            // Exactly one homepage, and wire every page's navbar to the real pages so
            // navigation is interconnected out of the box.
            const homeId = (savedPages.find((p) => p.isHomePage) || savedPages[0])?._id?.toString();
            const navLinks = savedPages
                .slice().sort((a, b) => (b.isHomePage ? 1 : 0) - (a.isHomePage ? 1 : 0))
                .map((p) => ({ label: p.title, url: p.isHomePage ? "/" : `/${p.slug}` }));
            for (const p of savedPages) {
                const shouldBeHome = p._id?.toString() === homeId;
                if (p.isHomePage !== shouldBeHome) p.isHomePage = shouldBeHome;
                const nav = (p.layoutConfig?.sections || []).find((s) => s.type === "Navbar");
                if (nav) { nav.props = nav.props || {}; nav.props.links = navLinks; }
                p.markModified("layoutConfig");
                await p.save();
            }

            // Auto-publish website if requested
            if (autoPublish) {
                if (website.status !== "published") {
                    website.status = "published";
                    website.publishedAt = new Date();
                    await website.save();
                }

                // Create a deployment snapshot
                const dbPages = await Page.find({ websiteId: website._id, tenantId: req.tenantId }).lean();
                const lastDeploy = await Deployment.findOne({ websiteId: website._id, tenantId: req.tenantId })
                    .sort({ version: -1 })
                    .lean();
                const version = lastDeploy ? lastDeploy.version + 1 : 1;

                await Deployment.create({
                    tenantId: req.tenantId,
                    websiteId: website._id,
                    deployedBy: req.user._id,
                    version,
                    snapshot: dbPages,
                    status: "success",
                });

                console.log(`📢 [AI] Auto-published website: ${website._id}`);
            }

            // 🔥 AUTO-TRIGGER FIREBASE AGENT for form backend setup
            if (autoPublish) {
                console.log(`🤖 [AI] Triggering FirebaseAgent for immediate backend setup...`);

                const firebaseAgent = new FirebaseAgent();

                // Get tenant info for human-readable slugs
                const tenant = await Tenant.findById(req.tenantId);
                const tenantSlug = tenant?.slug || req.tenantId.toString();
                const websiteSlug = website.slug || website.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || website._id.toString();

                const deploymentContext = {
                    tenantId: req.tenantId.toString(),
                    siteId: website._id.toString(),
                    tenantSlug,
                    websiteSlug,
                    websiteName: website.name,
                    websiteData: {
                        name: website.name,
                        description: website.description,
                    },
                    pages: aiResponse.pages.map((p) => ({
                        ...p,
                        layoutConfig: { sections: p.sections },
                    })),
                    assets: [],
                };

                try {
                    const firebaseResult = await firebaseAgent.execute(deploymentContext);
                    if (firebaseResult.success) {
                        console.log(`✅ [AI] Firebase backend auto-configured!`);
                        console.log(`📍 [AI] Firestore path: ${firebaseResult.firestorePath}`);
                        if (firebaseResult.hasContactForm) {
                            console.log(`📝 [AI] Form submission backend is LIVE at: tenants/${tenantSlug}/sites/${websiteSlug}/contact_form_submissions`);
                        }
                    } else {
                        console.error(`⚠️ [AI] Firebase setup failed:`, firebaseResult.error);
                    }
                } catch (firebaseError) {
                    console.error(`❌ [AI] Firebase agent error:`, firebaseError.message);
                    // Don't fail the whole AI generation if Firebase fails
                }
            }
        }
    } catch (err) {
        success = false;
        errorMessage = err.message;
        console.error("Gemini Error:", err.message);

        // Use fallback layout on complete failure
        if (!aiResponse) {
            console.log("🔄 [AI] Using fallback layout due to error");
            aiResponse = postProcessAIOutput(buildFallbackLayout(businessType, tone, targetAudience), businessType);
            success = true; // Return fallback as success
            errorMessage = null;
        }
    }

    // Log AI usage regardless of success
    await AIUsageLog.create({
        tenantId: req.tenantId,
        userId: req.user._id,
        websiteId: websiteId || null,
        prompt: { businessType, tone, targetAudience, features, brandDetails: brandDetails || null },
        response: aiResponse,
        model: usedModel,
        success,
        errorMessage,
    });

    if (!success) {
        return res.status(502).json({ success: false, message: errorMessage });
    }

    // Increment AI usage metric
    aiUsageTotal.inc({
        tenantId: req.tenant?.name || req.tenantId.toString(),
        websiteId: website ? website.name : "none",
    });

    res.json({ success: true, layout: aiResponse, savedToWebsite: !!websiteId });
};

/**
 * GET /api/ai/logs
 */
export const getAILogs = async (req, res) => {
    const logs = await AIUsageLog.find({ ...req.tenantFilter })
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    res.json({ success: true, logs });
};

/**
 * POST /api/ai/auto-configure
 * Uses Qwen (Ollama) to auto-pick template, tone, audience, theme, purpose and brand
 * colors from a free-text concept. The frontend supplies the template list + option
 * enums so templates.js stays the single source of truth. Falls back to Gemini.
 */
export const autoConfigureFromPrompt = async (req, res) => {
    try {
        const concept = (req.body.concept || "").trim();
        if (!concept) return res.status(400).json({ success: false, message: "Concept is required." });

        const templates = Array.isArray(req.body.templates) ? req.body.templates.slice(0, 50) : [];
        if (templates.length === 0) return res.status(400).json({ success: false, message: "No templates provided." });

        const opts = req.body.options || {};
        const tones = Array.isArray(opts.tones) && opts.tones.length ? opts.tones : ["Professional", "Friendly", "Bold", "Minimalist", "Playful", "Luxury"];
        const audiences = Array.isArray(opts.audiences) && opts.audiences.length ? opts.audiences : ["General Public", "Businesses", "Developers", "Creatives", "Students", "Executives"];
        const purposes = Array.isArray(opts.purposes) && opts.purposes.length ? opts.purposes : ["Sell products", "Generate leads", "Build brand", "Showcase portfolio", "Allow bookings", "Share content", "Educate users", "Promote events"];
        const themes = Array.isArray(opts.themes) && opts.themes.length ? opts.themes : ["Light", "Dark"];

        const templateLines = templates.map(t => `- ${t.id}: "${t.name}" — ${t.description || ""}`).join("\n");

        const prompt = `You are a senior brand & web-design director. A user described the website they want. Choose the BEST configuration.

USER CONCEPT:
"""${concept}"""

Pick ONE template id from this list. Templates are STYLE-based (palette + mood), NOT industry-locked — match the aesthetic to the concept:
${templateLines}

Return ONLY a JSON object (no prose, no markdown fences) with EXACTLY these keys:
{
  "templateId": "<one id copied exactly from the list above>",
  "tone": "<one of ${JSON.stringify(tones)}>",
  "audience": "<one of ${JSON.stringify(audiences)}>",
  "theme": "<one of ${JSON.stringify(themes)}>",
  "purpose": "<one of ${JSON.stringify(purposes)}>",
  "primaryColor": "<hex like #1d4ed8 that fits the brand>",
  "secondaryColor": "<complementary hex>",
  "reason": "<max 16 words explaining the choice>"
}

Guidance: choose colors that truly match the concept's industry & mood (spa→soft rose, fintech→deep blue, eco→green, luxury dining→gold/espresso, kids→bright playful). Choose theme by vibe (sleek/premium/nightlife→Dark; clean/airy/editorial→Light).`;

        let text = "";
        let usedModel = "qwen3.5:4b (Ollama)";
        try {
            const r = await ollamaClient.chat({
                model: 'qwen3.5:4b',
                think: false,
                messages: [
                    { role: 'system', content: 'You are a precise design configuration engine. You output only strict, valid JSON.' },
                    { role: 'user', content: prompt }
                ],
                format: 'json',
                options: { num_predict: 600, num_ctx: 8192, temperature: 0.3 }
            });
            text = r.message.content || "";
        } catch (ollamaErr) {
            console.warn("⚠️ [AI Auto-Config] Ollama failed, falling back to Gemini:", ollamaErr.message);
            usedModel = "gemini-3-flash-preview";
            const result = await model.generateContent(prompt);
            text = result.response.text();
        }

        // Extract JSON (handle markdown fences / surrounding prose)
        let jsonStr = text;
        const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fence) jsonStr = fence[1];
        else { const obj = text.match(/\{[\s\S]*\}/); if (obj) jsonStr = obj[0]; }

        let parsed = {};
        try { parsed = JSON.parse(jsonStr.trim()); } catch { parsed = {}; }

        // Validate & coerce against the allowed values
        const pick = (val, list, fb) => list.includes(val) ? val : fb;
        const hex = (c, fb) => (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c.trim())) ? c.trim() : fb;
        const validTemplateId = templates.some(t => t.id === parsed.templateId) ? parsed.templateId : templates[0].id;

        const config = {
            templateId: validTemplateId,
            tone: pick(parsed.tone, tones, tones[0]),
            audience: pick(parsed.audience, audiences, audiences[0]),
            theme: pick(parsed.theme, themes, "Light"),
            purpose: pick(parsed.purpose, purposes, purposes[0]),
            primaryColor: hex(parsed.primaryColor, "#14b8a6"),
            secondaryColor: hex(parsed.secondaryColor, "#0ea5e9"),
            reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 160) : "",
        };

        return res.json({ success: true, config, model: usedModel });
    } catch (err) {
        console.error("❌ [AI Auto-Config] error:", err);
        return res.status(500).json({ success: false, message: "Failed to auto-configure." });
    }
};

// ─── Prompt Tuner ─────────────────────────────────────────────────────────────
// Before generating, the tuner asks a handful of business-specific questions so the
// site is built from facts the owner confirmed instead of invented filler.

// Answers map onto these keys and nothing else, so generateLayout can rely on the shape.
const TUNE_FIELDS = ["tagline", "positioning", "usp", "services", "reviews", "address", "hours", "cta"];
const TUNE_TYPES = ["single", "multi", "text"];

// Facts no model can guess — they exist only if the owner types them. Any question
// the LLM returns for these is forced to free text so we never offer invented options.
const TUNE_TEXT_ONLY_FIELDS = new Set(["address", "hours", "reviews"]);

const TUNE_FIELD_LABELS = {
    tagline: "Which tagline fits your brand best?",
    positioning: "How should the site position your business?",
    usp: "What makes you different from the competition?",
    services: "Which services should the website feature?",
    reviews: "Paste any real customer reviews you'd like on the site",
    address: "What is your real business address?",
    hours: "What are your opening hours?",
    cta: "What should the main button ask visitors to do?",
};

const TUNE_PLACEHOLDERS = {
    reviews: 'One review per line, e.g. "Best flat white in town." — Aditi S.',
    address: "e.g. 12 Kalyani Nagar, Pune, Maharashtra 411006",
    hours: "e.g. Mon-Sat 7am-9pm, Sunday 8am-5pm",
};

/** Minimal question set used when the LLM is unreachable or returns junk. */
const buildFallbackTuneQuestions = () => ([
    {
        id: "tagline", field: "tagline", label: TUNE_FIELD_LABELS.tagline, type: "text",
        options: [], allowCustom: true, placeholder: "e.g. Crafted fresh, every single morning",
    },
    {
        id: "positioning", field: "positioning",
        label: "Describe your business in one line — what you do and who for",
        type: "text", options: [], allowCustom: true,
        placeholder: "e.g. A neighbourhood cafe for remote workers who care about single-origin coffee",
    },
    {
        id: "address", field: "address", label: TUNE_FIELD_LABELS.address, type: "text",
        options: [], allowCustom: true, placeholder: TUNE_PLACEHOLDERS.address,
    },
]);

/**
 * Whitelist / coerce whatever the model returned into questions the UI can render.
 * Anything malformed is dropped rather than patched, so a bad generation degrades to
 * fewer questions instead of broken ones.
 */
const normalizeTuneQuestions = (raw) => {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];

    for (const q of raw) {
        if (!q || typeof q !== "object") continue;

        const field = String(q.field || q.id || "").trim().toLowerCase();
        if (!TUNE_FIELDS.includes(field) || seen.has(field)) continue;

        let options = Array.isArray(q.options)
            ? [...new Set(
                q.options
                    .filter((o) => typeof o === "string")
                    .map((o) => o.trim().slice(0, 200))
                    .filter(Boolean)
            )].slice(0, 6)
            : [];

        let type = TUNE_TYPES.includes(q.type) ? q.type : "single";
        if (TUNE_TEXT_ONLY_FIELDS.has(field)) type = "text";
        // A one-option choice is not a choice — let the owner just write it.
        if (type !== "text" && options.length < 2) type = "text";
        if (type === "text") options = [];

        const label = (typeof q.label === "string" && q.label.trim())
            ? q.label.trim().slice(0, 160)
            : TUNE_FIELD_LABELS[field];

        out.push({
            id: field,
            field,
            label,
            type,
            options,
            allowCustom: true, // the owner can always overrule the AI's suggestions
            placeholder: (typeof q.placeholder === "string" && q.placeholder.trim())
                ? q.placeholder.trim().slice(0, 140)
                : (TUNE_PLACEHOLDERS[field] || ""),
        });
        seen.add(field);
        if (out.length >= 6) break;
    }

    // The whole point is to stop the model inventing a location, so always ask for one.
    if (!seen.has("address")) {
        if (out.length >= 6) out.pop();
        out.push({
            id: "address", field: "address", label: TUNE_FIELD_LABELS.address, type: "text",
            options: [], allowCustom: true, placeholder: TUNE_PLACEHOLDERS.address,
        });
    }

    return out;
};

/**
 * POST /api/ai/tune-questions
 * Turns a vague one-line concept into 4-6 high-value, business-specific questions with
 * AI-generated answer options. Qwen (Ollama) first, Gemini fallback, hardcoded set last.
 */
export const generateTuneQuestions = async (req, res) => {
    try {
        const concept = (req.body.concept || "").trim();
        if (!concept) return res.status(400).json({ success: false, message: "Concept is required." });

        const tone = (req.body.tone || "").trim();
        const audience = (req.body.audience || "").trim();
        const businessType = (req.body.businessType || "").trim();

        const prompt = `You are a brand strategist onboarding a new client. They described their business in one line and you must write their website. Ask only the FEW questions whose answers you genuinely cannot invent — the answers become the real copy on their site.

CLIENT'S CONCEPT:
"""${concept}"""
${businessType ? `Business category: ${businessType}\n` : ""}${tone ? `Desired tone: ${tone}\n` : ""}${audience ? `Target audience: ${audience}\n` : ""}
Return ONLY a JSON object (no prose, no markdown fences), exactly:
{ "questions": [ { "id": "...", "field": "...", "label": "...", "type": "single|multi|text", "options": ["..."], "allowCustom": true, "placeholder": "..." } ] }

RULES:
1. Return 4 to 6 questions. A few great questions beat many shallow ones. NEVER ask about colors, fonts, templates or layout — those are chosen elsewhere.
2. "field" MUST be one of ${JSON.stringify(TUNE_FIELDS)}, each used at most once:
   - tagline: the slogan shown in the hero
   - positioning: the brand's strategy / angle in the market
   - usp: the one thing that makes them different
   - services: what they actually sell
   - reviews: real customer testimonials
   - address: their real street address
   - hours: their real opening hours
   - cta: what the main button should ask visitors to do
3. "type" is "single" (pick one), "multi" (pick several) or "text" (they type it).
   - ALWAYS use "text" with EMPTY options for address, hours and reviews. Those are real-world facts; offering invented options would put a fake address or a fake review on a real business.
   - Use "single" or "multi" for tagline, positioning, usp, services and cta, each with 4-6 options.
4. Options must be CONCRETE and written specifically for THIS business — real candidate taglines, real service names. Never generic filler like "Option A", "Quality", "Good service" or "Professional".
5. "label" is the question as you would say it to the client, under 90 characters.
6. "placeholder" is a short example answer, and only for "text" questions.

WORKED EXAMPLE — for the concept "a cozy neighbourhood coffee shop in Pune":
{ "questions": [
  { "id": "tagline", "field": "tagline", "label": "Which tagline fits your cafe best?", "type": "single",
    "options": ["Your daily grind, perfected", "Pune's cosiest corner for coffee", "Slow mornings, strong brews", "Where the neighbourhood meets"], "allowCustom": true, "placeholder": "" },
  { "id": "services", "field": "services", "label": "Which offerings should the site showcase?", "type": "multi",
    "options": ["Single-origin pour overs", "Fresh-baked croissants", "All-day breakfast", "Cold brew on tap", "Latte art workshops", "Beans by the bag"], "allowCustom": true, "placeholder": "" },
  { "id": "usp", "field": "usp", "label": "What makes your cafe different?", "type": "single",
    "options": ["We roast our own beans in-house every week", "Laptop-friendly, with power at every table", "Everything baked fresh each morning on site", "Direct-trade beans from Chikmagalur farms"], "allowCustom": true, "placeholder": "" },
  { "id": "address", "field": "address", "label": "What is your real cafe address?", "type": "text",
    "options": [], "allowCustom": true, "placeholder": "e.g. 12 Kalyani Nagar, Pune, Maharashtra 411006" },
  { "id": "reviews", "field": "reviews", "label": "Paste any real customer reviews to feature", "type": "text",
    "options": [], "allowCustom": true, "placeholder": "One per line, e.g. Best flat white in Pune. - Aditi S." }
] }

Now do the same for the client's concept above. Every option must be unmistakably about THEIR business.`;

        let text = "";
        let usedModel = "qwen3.5:4b (Ollama)";
        try {
            const r = await ollamaClient.chat({
                model: 'qwen3.5:4b',
                think: false,
                messages: [
                    { role: 'system', content: 'You are a precise brand-onboarding engine. You output only strict, valid JSON.' },
                    { role: 'user', content: prompt }
                ],
                format: 'json',
                options: { num_predict: 1400, num_ctx: 8192, temperature: 0.6 }
            });
            text = r.message.content || "";
        } catch (ollamaErr) {
            console.warn("⚠️ [AI Tuner] Ollama failed, falling back to Gemini:", ollamaErr.message);
            usedModel = "gemini-3-flash-preview";
            const result = await model.generateContent(prompt);
            text = result.response.text();
        }

        // Extract JSON (handle markdown fences / surrounding prose)
        let jsonStr = text;
        const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fence) jsonStr = fence[1];
        else { const obj = text.match(/\{[\s\S]*\}/); if (obj) jsonStr = obj[0]; }

        let parsed = {};
        try { parsed = JSON.parse(jsonStr.trim()); } catch { parsed = {}; }

        // The model occasionally returns a bare array instead of { questions: [...] }
        let questions = normalizeTuneQuestions(Array.isArray(parsed) ? parsed : parsed?.questions);

        if (questions.length < 2) {
            console.warn("⚠️ [AI Tuner] Unusable question set — serving fallback.");
            questions = buildFallbackTuneQuestions();
            usedModel = `${usedModel} (fallback)`;
        }

        return res.json({ success: true, questions, model: usedModel });
    } catch (err) {
        console.error("❌ [AI Tuner] error:", err);
        // Never block the user: a working question set matters more than surfacing the error.
        return res.json({ success: true, questions: buildFallbackTuneQuestions(), model: "fallback" });
    }
};

/**
 * POST /api/public/ai/chat
 */
export const chatWithWebsite = async (req, res) => {
    try {
        const { question, websiteId } = req.body;
        if (!question || !websiteId) {
            return res.status(400).json({ success: false, message: "Missing question or websiteId" });
        }

        // Public endpoint: answer only from published pages, never from drafts.
        const pages = await Page.find({ websiteId, status: "published" }).lean();
        if (!pages || pages.length === 0) {
            return res.status(404).json({ success: false, message: "Website not found or has no content" });
        }

        // Simplify pages content to save tokens
        const siteContext = pages.map(page => {
            return `Page: ${page.title} (${page.slug})
Sections:
${(page.layoutConfig?.sections || []).map(s => {
                const p = s.props || {};
                // Extract textual content to form the context
                let content = `- [${s.type} Section]:`;
                if (p.heading) content += ` Heading: "${p.heading}"`;
                if (p.subheading) content += ` Subheading: "${p.subheading}"`;
                if (p.description) content += ` Description: "${p.description}"`;
                if (p.text) content += ` Text: "${p.text}"`;
                if (p.items && Array.isArray(p.items)) {
                    content += ` Items: ` + p.items.map(i => `(Title: ${i.title}, Desc: ${i.description})`).join(', ');
                }
                return content;
            }).join('\n')}
`;
        }).join('\n\n');

        const systemPrompt = `You are a helpful AI chatbot specifically built for a website.
You must answer questions strictly based on the following website content. Do not invent information or provide details outside of this content.
If the answer is not in the content, say "I'm sorry, I don't have that information on our website."
Keep your answers concise, helpful, and friendly.

CRITICAL LANGUAGE INSTRUCTION:
You must detect if the user's question is in Hindi, Marathi, or English. You MUST answer specifically in the exact same language.
- If the user asks in Hindi, answer in Hindi.
- If the user asks in Marathi, answer in Marathi.
- If the user asks in English, answer in English.

Website Content Context:
${siteContext}
`;

        try {
            console.log("🤖 [AI Chat] Attempting answer with qwen3.5:4b...");
            const r = await ollamaClient.chat({
                model: 'qwen3.5:4b',
                think: false,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: question }
                ],
                options: {
                    num_predict: 512,
                    num_ctx: 4096,
                    temperature: 0.2
                }
            });
            const answer = r.message.content || '';
            console.log("🟢 [AI Chat] Answer generated via qwen:4b.");
            return res.json({ success: true, answer });
        } catch (ollamaErr) {
            console.warn("⚠️ [AI Chat] Ollama failure, falling back to Gemini...");
            // Visitor input leaves the host here, so strip contact identifiers first.
            const result = await model.generateContent(systemPrompt + "\\n\\nUser Question: " + redactText(question));
            const answer = result.response.text();
            console.log("🔵 [AI Chat] Answer generated via Gemini.");
            return res.json({ success: true, answer });
        }

    } catch (err) {
        console.error("❌ [AI Chat] generate response error:", err);
        res.status(500).json({ success: false, message: "Failed to process chat" });
    }
};

/**
 * POST /api/ai/help
 * In-app AI help assistant — answers "how do I…" / "what is…" questions about using
 * Sitezy, with short, friendly, step-by-step guidance. Qwen first, Gemini fallback.
 */
const HELP_KNOWLEDGE = `You are the in-app help assistant for Sitezy, an AI website builder. Answer the user's question with SHORT, friendly, step-by-step guidance (use numbered steps when explaining how to do something). Keep it concise. Only discuss Sitezy. Never mention the underlying AI model names.

HOW TO BUILD A SITE (follow these EXACTLY — do not invent extra steps):
- From scratch: 1) On the Dashboard or Projects page, click "Create Project". 2) Enter a name (and optional description), then click "Create Project". IMPORTANT: this only asks for a name/description — it does NOT ask for a template, tone, audience, colors, or blocks. 3) Your new project appears on the Projects page — click "Edit" on its card to open the Builder and start editing. 4) In the Builder, use "Add Section" to add blocks (Hero, Gallery, etc.) and click any section to edit it. 5) Click Save, then Publish to go live. (Tip: to fill it with AI-written content, open the AI Playground and set "Apply to" your project.)
- With AI (AI Playground): 1) Open "AI Playground" (from the Projects page header or the Dashboard). 2) Describe your website concept. 3) Optionally click "AI auto configure" to let AI choose everything. 4) Pick a base template and set Tone, Audience, Theme Mode and Website Purpose, plus colors and Required Blocks. 5) Set "Apply to" to a project (or leave it on Preview), then click "Generate with Basic AI" or "Generate with Pro AI". 6) Open the project in the Builder to fine-tune, then Publish.

PLATFORM MAP:
- Dashboard: overview. "Create Project" makes a new blank project (asks for a name + description only). "AI Playground" generates a full site with AI. "At a Glance" shows website + deploy counts. Quick Links → Custom Domains & Team Settings. Recent Deployments and Activity Log open full history pages.
- Projects page: each project card has Edit (open builder), Update/Deploy (publish), the rename/details pencil, Form Submissions (inbox), Analytics (bar chart), Delete, and an "Export" button (downloads the working code as a zip). AI Playground & Settings buttons are on this page header.
- AI Playground: 1) Describe your concept. 2) Optionally click "AI auto configure" to let AI pick everything. 3) Pick a base template (the starting design). 4) Set Tone, Audience, Theme Mode, Website Purpose. 5) Pick Primary/Secondary colors. 6) "Apply to" = save into a project or just preview. 7) Choose Required Blocks (sections to include). 8) Generate with Basic AI (fast) or Pro AI (higher quality, more relevant images).
   - TONE = the writing voice (Professional, Friendly, Bold, etc.). AUDIENCE = who the site is for. THEME MODE = Light or Dark look. WEBSITE PURPOSE = the main goal (sell, build brand, book, etc.). REQUIRED BLOCKS = which sections the page must include (Hero, Gallery, Pricing, Contact Form, etc.).
- Builder: Left column = Pages list (+ to add an AI-built page) and "Page Layers (Sections)". Click "Add Section" to add a block. Drag the handle to reorder sections. Click a section to open its editor on the right.
   - SECTIONS: Navbar = the top bar with your brand + menu links. Hero = the big intro/banner at the top. Text = a paragraph/about block. Gallery = a grid of images/cards. CTA (Call To Action) = a band that nudges visitors to act (e.g. "Order now"). ContactForm/DynamicForm = a form to collect details (you can add fields: text, email, dropdown, radio, checkbox). Footer = the bottom bar. Button/Image/Spacer = small building blocks.
   - EDIT AN IMAGE (e.g. in the Navbar or Hero): click that section in Page Layers → its editor opens on the right → find the "Background Image" / image field → paste an image URL or click Upload.
   - SEO button (top toolbar): scores your page's SEO, predicts engagement, and scans design health; "Auto-Improve" rewrites copy and "Generate meta & schema" adds SEO metadata.
   - History: every Save/Publish is a version snapshot you can roll back to.
   - Save = saves your draft. Publish = takes the site live and lets you pick a domain.
- Settings: Workspace Details, Team Members, Custom Domains (open / rename / remove your domains).`;

export const helpAssistant = async (req, res) => {
    try {
        const question = (req.body.question || "").toString().slice(0, 500).trim();
        if (!question) return res.status(400).json({ success: false, message: "Ask a question." });
        const where = (req.body.context || "").toString();
        const prompt = `${HELP_KNOWLEDGE}\n\nThe user is currently on the ${where || "app"}.\n\nUser question: ${question}`;
        try {
            const r = await ollamaClient.chat({
                model: "qwen3.5:4b", think: false,
                messages: [{ role: "system", content: "You are Sitezy's concise, friendly in-app help assistant." }, { role: "user", content: prompt }],
                options: { num_predict: 450, num_ctx: 8192, temperature: 0.3 },
            });
            return res.json({ success: true, answer: r.message?.content || "" });
        } catch (e) {
            const cloudPrompt = `${HELP_KNOWLEDGE}\n\nThe user is currently on the ${where || "app"}.\n\nUser question: ${redactText(question)}`;
            const result = await model.generateContent(cloudPrompt);
            return res.json({ success: true, answer: result.response.text() });
        }
    } catch (err) {
        console.error("❌ [AI Help] error:", err?.message);
        return res.status(500).json({ success: false, message: "Help is unavailable right now." });
    }
};
