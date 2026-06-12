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
}).unknown(true);

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
        preferredModel
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

        booking_section: "ContactForm"
    };


    // Convert ML output → builder section list

    const mlFeatures = recommendedSections
        .map(section => sectionMapping[section])
        .filter(Boolean);


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

        // If websiteId provided, save pages to DB
        if (website) {
            const autoPublish = req.query.autoPublish === "true" || req.body.autoPublish === true;

            for (const pageData of aiResponse.pages) {
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

                const existing = await Page.findOne({
                    websiteId: website._id,
                    slug: pageData.slug.toLowerCase(),
                    tenantId: req.tenantId,
                });

                if (existing) {
                    existing.layoutConfig.sections = sectionsWithIds;
                    existing.title = pageData.title;
                    existing.status = autoPublish ? "published" : "draft";
                    await existing.save();
                } else {
                    await Page.create({
                        tenantId: req.tenantId,
                        websiteId: website._id,
                        title: pageData.title,
                        slug: pageData.slug.toLowerCase(),
                        isHomePage: pageData.slug.toLowerCase() === "home",
                        layoutConfig: { sections: sectionsWithIds },
                        status: autoPublish ? "published" : "draft",
                        createdBy: req.user._id,
                    });
                }
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
        prompt: { businessType, tone, targetAudience, features },
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

/**
 * POST /api/public/ai/chat
 */
export const chatWithWebsite = async (req, res) => {
    try {
        const { question, websiteId } = req.body;
        if (!question || !websiteId) {
            return res.status(400).json({ success: false, message: "Missing question or websiteId" });
        }

        const pages = await Page.find({ websiteId }).lean();
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
            const result = await model.generateContent(systemPrompt + "\\n\\nUser Question: " + question);
            const answer = result.response.text();
            console.log("🔵 [AI Chat] Answer generated via Gemini.");
            return res.json({ success: true, answer });
        }

    } catch (err) {
        console.error("❌ [AI Chat] generate response error:", err);
        res.status(500).json({ success: false, message: "Failed to process chat" });
    }
};
