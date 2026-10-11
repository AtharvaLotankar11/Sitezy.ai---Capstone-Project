// Evaluate the production form repair (backend/src/modules/ai/formRepair.js) on every site
// generated with the deployed configuration. The model call is identical to the one in
// generateLayout. Reports forms filled before/after, regenerated vs defaulted, field validity,
// fields per form, reuse of prompt-example names, and added latency per site.
import fs from "fs";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";

const BACKEND = fileURLToPath(new URL("../backend", import.meta.url)).replace(/[\\/]+$/, "").split("\\").join("/");
const SP = process.argv[2];
const { repairForms, validFields } = await import(pathToFileURL(BACKEND + "/src/modules/ai/formRepair.js").href);
// the business list is taken from decoding_exp.mjs so all experiments use identical inputs
const exp = fs.readFileSync(new URL("./decoding_exp.mjs", import.meta.url), "utf8");
const bA = exp.indexOf("const BUSINESSES = ["), bB = exp.indexOf("];", bA) + 1;
const BUSINESSES = new Function(exp.slice(bA, bB) + "; return BUSINESSES;")();
const EXAMPLE = new Set(["customer_name", "phone", "juice_type", "size", "quantity", "add_ons", "delivery_time",
  "special_instructions", "name", "service", "stylist", "appointment_date", "notes"]);

const generate = async (prompt) => {
  const r = await fetch("http://127.0.0.1:11434/api/chat", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "qwen3.5:4b", stream: false, think: false, format: "json",
      messages: [{ role: "user", content: prompt }], options: { num_predict: 900, num_ctx: 4096, temperature: 0.3 } }) });
  return (await r.json())?.message?.content || "";
};
const formsOf = (layout) => layout.pages.flatMap((p) => p.sections || []).filter((s) => s?.type === "DynamicForm");
const filled = (s) => validFields(s.props?.dynamicFields || s.props?.fields).length >= 3;

// optional: FR_SUFFIX (file suffix, default _D_both.txt) and FR_OUT (output name) environment variables
const SUFFIX = process.env.FR_SUFFIX || "_D_both.txt";
const OUTF = process.env.FR_OUT || "form_repair_results.json";
const runs = process.argv.slice(3);                        // raw dirs of generated sites
const out = [];
for (const dir of runs) {
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(SUFFIX))) {
    const biz = parseInt(f);
    let layout;                                            // invalid generations get the template fallback in production
    try { layout = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8").match(/\{[\s\S]*\}/)[0]); }
    catch { out.push({ run: path.basename(dir), biz: parseInt(f), invalid_generation: true }); continue; }
    const before = formsOf(layout).map(filled);
    const [bt, tone, aud] = BUSINESSES[biz];
    const stats = await repairForms(layout, { businessType: bt, tone, targetAudience: aud }, generate);
    const after = formsOf(layout);
    const names = after.flatMap((s) => s.props.dynamicFields.map((x) => x.name.toLowerCase()));
    out.push({ run: path.basename(dir), biz, forms: after.length, filled_before: before.filter(Boolean).length,
      filled_after: after.filter(filled).length, ...stats,
      fields_after: after.map((s) => s.props.dynamicFields.length),
      example_overlap: names.length ? names.filter((n) => EXAMPLE.has(n)).length / names.length : 0,
      ...(process.env.FR_SAVE ? { forms_after: after.map((s) => s.props.dynamicFields), forms_before: before } : {}) });
    process.stdout.write(".");
  }
}
fs.writeFileSync(`${SP}/${OUTF}`, JSON.stringify(out, null, 1));
const sum = (k) => out.reduce((a, r) => a + (r[k] || 0), 0);
console.log(`\nsites ${out.length} | forms ${sum("forms")} | filled before ${sum("filled_before")} after ${sum("filled_after")} | `
  + `regenerated ${sum("regenerated")} defaulted ${sum("defaulted")} contactDefaulted ${sum("contactDefaulted")} | llm calls ${sum("llmCalls")}`);
