// Evaluate the production buildFallbackLayout (verbatim source) for every business whose
// reasoning-on (C) generation failed validation; write the layout where the model output was.
import fs from "fs";
const src = fs.readFileSync(new URL("../backend/src/modules/ai/ai.controller.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const start = src.indexOf("function buildFallbackLayout(");
const end = src.indexOf("\n}\n", start) + 2;
const buildFallbackLayout = new Function(`${src.slice(start, end)}; return buildFallbackLayout;`)();
const SP = process.argv[2];
const rows = fs.readFileSync(`${SP}/decoding_results.jsonl`, "utf8").split("\n").filter(Boolean).map(JSON.parse);
// the business list is taken from decoding_exp.mjs so both experiments use identical inputs
const exp = fs.readFileSync(new URL("./decoding_exp.mjs", import.meta.url), "utf8");
const a = exp.indexOf("const BUSINESSES = ["), b = exp.indexOf("];", a) + 1;
const BUSINESSES = new Function(exp.slice(a, b) + "; return BUSINESSES;")();
fs.mkdirSync(`${SP}/ablation_C_sites`, { recursive: true });
let fb = 0;
for (const r of rows.filter((r) => r.config === "C_formatjson")) {
  const [bt, tone, aud] = BUSINESSES[r.biz_idx];
  const raw = fs.readFileSync(`${SP}/decoding_results_raw/${r.biz_idx}_C_formatjson.txt`, "utf8");
  const out = r.schema_ok ? raw : JSON.stringify(buildFallbackLayout(bt, tone, aud));
  if (!r.schema_ok) fb++;
  fs.writeFileSync(`${SP}/ablation_C_sites/${r.biz_idx}_C.txt`, out);
}
console.log("C sites written:", rows.filter((r) => r.config === "C_formatjson").length, "| template fallbacks:", fb);
