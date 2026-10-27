// Same-workload CLOUD baseline: production Gemini path = model.generateContent(prompt)
// (no system message, no JSON mode). Same 20 prompts as the local experiment.
// Records billed usageMetadata. Never prints the API key. Resumable JSONL.
import { createRequire } from "module";
import { fileURLToPath } from "url";
import fs from "fs";
const require = createRequire(new URL("../backend/package.json", import.meta.url));
require("dotenv").config({ path: fileURLToPath(new URL("../backend/.env", import.meta.url)), quiet: true });
const Joi = require("joi");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const OUT = process.argv[2];
const RAW = OUT.replace(/\.jsonl$/, "_raw"); fs.mkdirSync(RAW, { recursive: true });
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

// Same template literal as generateLayout (no base template, no brand facts, Light theme).
function buildPrompt(businessType, tone, targetAudience) {
  const contextImages = getContextQueries(businessType).slice(0, 5).join(" | ");
  const features = FEATURES;
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


function extractAndValidate(text) {
  let jsonStr = text;
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) jsonStr = m[1]; else { const o = text.match(/\{[\s\S]*\}/); if (o) jsonStr = o[0]; }
  let parsed = null, parse_ok = false;
  try { parsed = JSON.parse(jsonStr.trim()); parse_ok = true; } catch {}
  let schema_ok = false, n_pages = 0;
  if (parse_ok) { schema_ok = !aiLayoutSchema.validate(parsed).error; n_pages = Array.isArray(parsed?.pages) ? parsed.pages.length : 0; }
  return { parse_ok, schema_ok, n_pages };
}
// GEMINI_MATCHED=1: same constraints as the local call (system message, JSON mode,
// temperature 0.1, 5,000-token output budget) instead of the production cloud path;
// GEMINI_NOCAP=1 additionally drops the token budget.
const SYSTEM = "You are an expert AI website generator and elite copywriter. You MUST generate unique, engaging content perfectly tailored to the requested business type. NEVER blindly copy placeholder text from templates.";
const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel(process.env.GEMINI_MATCHED
  ? { model: "gemini-3-flash-preview", systemInstruction: SYSTEM,
      generationConfig: { responseMimeType: "application/json", temperature: 0.1,
                          ...(process.env.GEMINI_NOCAP ? {} : { maxOutputTokens: 5000 }) } }
  : { model: "gemini-3-flash-preview" });
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).biz_idx) : []);
for (let i = 0; i < BUSINESSES.length; i++) {
  if (done.has(i)) continue;
  const [bt, tone, aud] = BUSINESSES[i];
  const t = Date.now(); let rec = { biz_idx: i, business: bt };
  try {
    const r = await model.generateContent(buildPrompt(bt, tone, aud));
    const text = r.response.text(); const u = r.response.usageMetadata || {};
    fs.writeFileSync(`${RAW}/${i}_gemini.txt`, text);
    rec = { ...rec, latency_s: (Date.now() - t) / 1000, prompt_tokens: u.promptTokenCount, output_tokens: u.candidatesTokenCount,
            thinking_tokens: u.thoughtsTokenCount ?? 0, total_tokens: u.totalTokenCount, finish: r.response.candidates?.[0]?.finishReason,
            ...extractAndValidate(text) };
  } catch (e) {
    const msg = String(e?.message || e).replace(/key=[^&\s]+/gi, "key=<redacted>");
    rec = { ...rec, latency_s: (Date.now() - t) / 1000, error: msg.slice(0, 300), parse_ok: false, schema_ok: false };
  }
  fs.appendFileSync(OUT, JSON.stringify(rec) + "\n");
  console.log(JSON.stringify({ i, lat: rec.latency_s, ok: rec.schema_ok, in: rec.prompt_tokens, out: rec.output_tokens, think: rec.thinking_tokens, err: rec.error?.slice(0, 80) }));
}
console.log("done");
