// Recommender arm: keep valid generations; replace invalid ones by the production buildFallbackLayout.
import fs from "fs";
const src = fs.readFileSync(new URL("../backend/src/modules/ai/ai.controller.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const start = src.indexOf("function buildFallbackLayout(");
const end = src.indexOf("\n}\n", start) + 2;
const buildFallbackLayout = new Function(`${src.slice(start, end)}; return buildFallbackLayout;`)();
const SP = process.argv[2];
const rows = fs.readFileSync(`${SP}/recommender2_gen.jsonl`, "utf8").split("\n").filter(Boolean).map(JSON.parse);
// the business list is taken from decoding_exp.mjs so all experiments use identical inputs
const exp = fs.readFileSync(new URL("./decoding_exp.mjs", import.meta.url), "utf8");
const a = exp.indexOf("const BUSINESSES = ["), b = exp.indexOf("];", a) + 1;
const BUSINESSES = new Function(exp.slice(a, b) + "; return BUSINESSES;")();
fs.mkdirSync(`${SP}/recommender2_sites`, { recursive: true });
let fb = 0;
for (const r of rows) {
  const [bt, tone, aud] = BUSINESSES[r.biz_idx];
  const raw = fs.readFileSync(`${SP}/recommender2_gen_raw/${r.biz_idx}_D_both.txt`, "utf8");
  const out = r.schema_ok ? raw : JSON.stringify(buildFallbackLayout(bt, tone, aud));
  if (!r.schema_ok) fb++;
  fs.writeFileSync(`${SP}/recommender2_sites/${r.biz_idx}_R.txt`, out);
}
console.log("recommender sites written:", rows.length, "| template fallbacks:", fb);
