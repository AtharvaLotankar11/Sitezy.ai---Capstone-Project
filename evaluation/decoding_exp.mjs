// Constrained-decoding experiment on the PRODUCTION generation call.
// Reproduces ai.controller.js generateLayout: same prompt template, system message,
// options (num_predict 5000, num_ctx 8192, temperature 0.1), same JSON extraction
// regex, and the same aiLayoutSchema Joi check that decides AI content vs the
// deterministic template fallback. Paired design: every business prompt is run
// under all 4 configs. Appends JSONL, resumable (skips finished (biz,cfg) pairs).
import { createRequire } from "module";
import fs from "fs";
const require = createRequire(new URL("../backend/package.json", import.meta.url));
const Joi = require("joi");

const OUT = process.argv[2];
const DEADLINE_MS = Number(process.argv[3] || 25 * 60 * 1000); // stop before the 30-min bg cap
const T0 = Date.now();

const VALID_SECTION_TYPES = ["Hero", "Text", "Gallery", "CTA", "ContactForm", "DynamicForm", "Navbar", "Footer"];
const aiLayoutSchema = Joi.object({
  pages: Joi.array().items(Joi.object({
    title: Joi.string().required(), slug: Joi.string().required(),
    sections: Joi.array().items(Joi.object({
      type: Joi.string().valid(...VALID_SECTION_TYPES).required(),
      props: Joi.any().default({}),
    }).unknown(true)).required(),
  }).unknown(true)).min(1).required(),
}).unknown(true);

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
function getContextQueries(bt) {
  if (!bt) return ["professional", "workspace", "team", "office", "modern"];
  const b = bt.toLowerCase();
  for (const [k, q] of Object.entries(BUSINESS_CONTEXT_QUERIES)) if (b.includes(k)) return q;
  return ["professional", "workspace", "team", "office", "modern"];
}

const BUSINESSES = [
  ["artisan coffee shop", "warm", "young professionals"],
  ["boutique fitness studio", "energetic", "health-conscious adults"],
  ["family medical clinic", "reassuring", "families"],
  ["tech startup project management SaaS", "professional", "startup teams"],
  ["Italian restaurant", "cozy", "food lovers"],
  ["real_estate agency", "trustworthy", "first-time home buyers"],
  ["beauty salon and spa", "elegant", "women aged 25-45"],
  ["online coding bootcamp education", "motivating", "career switchers"],
  ["adventure travel agency", "adventurous", "millennials"],
  ["corporate law firm", "authoritative", "small businesses"],
  ["finance advisory firm", "professional", "retirees"],
  ["neighbourhood bakery food", "friendly", "local families"],
  ["creative photography studio", "artistic", "engaged couples"],
  ["pet grooming salon", "playful", "pet owners"],
  ["yoga and wellness retreat", "calm", "wellness seekers"],
  ["electronics repair shop", "helpful", "students"],
  ["organic grocery delivery", "fresh", "busy parents"],
  ["luxury fashion boutique", "sophisticated", "affluent shoppers"],
  ["children's music school", "inspiring", "parents"],
  ["modern co-working space", "modern", "freelancers"],
];
const FEATURES = ["Navbar", "Hero", "Text", "Gallery", "CTA", "DynamicForm", "Footer"];
const PER_BIZ = process.env.FEATURES_FILE
  ? JSON.parse(fs.readFileSync(process.env.FEATURES_FILE, "utf8")).map((r) => r[process.env.FEATURES_KEY || "features"]) : null;

// Same template literal as generateLayout (no base template, no brand facts, Light theme).
function buildPrompt(businessType, tone, targetAudience, i) {
  const contextImages = getContextQueries(businessType).slice(0, 5).join(" | ");
  // FEATURES_FILE: per-business section lists (e.g. from the block recommender) instead of all seven
  const features = PER_BIZ ? PER_BIZ[i] : FEATURES;
  const theme = undefined, baseTemplateSections = undefined, brandFactsBlock = "", brandDetails = undefined;
  const primaryColor = undefined, secondaryColor = undefined;
  return fs.readFileSync(new URL("./prompt_template.txt", import.meta.url), "utf8")
    .replaceAll("${businessType}", businessType)
    .replaceAll("${tone}", tone)
    .replaceAll("${theme || \"Light\"}", theme || "Light")
    .replaceAll("${targetAudience}", targetAudience)
    .replaceAll("${features.join(\", \")}", features.join(", "))
    .replaceAll("${contextImages}", contextImages)
    .replaceAll("${primaryColor || \"choose sophisticated accent color matching business\"}", primaryColor || "choose sophisticated accent color matching business")
    .replaceAll("${secondaryColor || \"choose complementary secondary\"}", secondaryColor || "choose complementary secondary")
    .trim();
}

const SYSTEM = "You are an expert AI website generator and elite copywriter. You MUST generate unique, engaging content perfectly tailored to the requested business type. NEVER blindly copy placeholder text from templates.";

// A: free-form (thinking on, no grammar)   B: think:false only
// C: format:json only (thinking on)        D: both flags = PRODUCTION
// Production config first so its results accrue fastest; still fully paired per business.
const CONFIGS = {
  D_both:        { think: false, format: "json" },
  B_thinkfalse:  { think: false, format: null },
  C_formatjson:  { think: true,  format: "json" },
  A_freeform:    { think: true,  format: null },
};
const RAW_DIR = OUT.replace(/\.jsonl$/, "_raw");
fs.mkdirSync(RAW_DIR, { recursive: true });

function extractAndValidate(text) {
  // identical to production extraction
  let jsonStr = text;
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) jsonStr = m[1];
  else { const o = text.match(/\{[\s\S]*\}/); if (o) jsonStr = o[0]; }
  let parsed = null, parse_ok = false;
  try { parsed = JSON.parse(jsonStr.trim()); parse_ok = true; } catch { /* fallback in prod */ }
  let schema_ok = false, n_pages = 0, n_sections = 0;
  if (parse_ok) {
    const { error } = aiLayoutSchema.validate(parsed);
    schema_ok = !error;
    if (Array.isArray(parsed?.pages)) {
      n_pages = parsed.pages.length;
      n_sections = parsed.pages.reduce((a, p) => a + (Array.isArray(p.sections) ? p.sections.length : 0), 0);
    }
  }
  return { parse_ok, schema_ok, n_pages, n_sections };
}

const done = new Set();
if (fs.existsSync(OUT)) for (const l of fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean)) {
  try { const r = JSON.parse(l); done.add(`${r.biz_idx}|${r.config}`); } catch {}
}

// optional 4th arg: comma-separated config subset (used for repeated runs)
const ONLY = process.argv[4] ? process.argv[4].split(",") : null;
outer:
for (let i = 0; i < BUSINESSES.length; i++) {
  for (const [cfgName, cfg] of Object.entries(CONFIGS)) {
    if (ONLY && !ONLY.includes(cfgName)) continue;
    if (done.has(`${i}|${cfgName}`)) continue;
    if (Date.now() - T0 > DEADLINE_MS) { console.log("deadline reached; resume later"); break outer; }
    const [bt, tone, aud] = BUSINESSES[i];
    const body = {
      model: "qwen3.5:4b", stream: false, think: cfg.think,
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: buildPrompt(bt, tone, aud, i) }],
      options: { num_predict: 5000, num_ctx: 8192, temperature: 0.1 },
    };
    if (cfg.format) body.format = cfg.format;
    const t = Date.now();
    let rec = { biz_idx: i, business: bt, config: cfgName };
    try {
      const res = await fetch("http://127.0.0.1:11434/api/chat", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json();
      const content = j?.message?.content || "";
      fs.writeFileSync(`${RAW_DIR}/${i}_${cfgName}.txt`, content);
      rec = { ...rec, latency_s: (Date.now() - t) / 1000, done_reason: j.done_reason,
        prompt_tokens: j.prompt_eval_count, output_tokens: j.eval_count,
        thinking_chars: (j?.message?.thinking || "").length, content_chars: content.length,
        ...extractAndValidate(content) };
    } catch (e) {
      rec = { ...rec, latency_s: (Date.now() - t) / 1000, error: String(e), parse_ok: false, schema_ok: false };
    }
    fs.appendFileSync(OUT, JSON.stringify(rec) + "\n");
    console.log(JSON.stringify({ i, cfg: cfgName, lat: rec.latency_s, ok: rec.schema_ok, dr: rec.done_reason }));
  }
}
console.log("finished pass; total done =", fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).length);
