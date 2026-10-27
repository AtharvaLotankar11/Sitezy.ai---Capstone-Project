// Field-level validation rules per field type for generated forms (before any repair):
// conformance to the production field validator, required flag, placeholder, select options,
// and type/name consistency (an e-mail field typed email, a phone field typed tel, a date
// field typed date). Usage: node field_rules.mjs <label>=<rawDir>:<suffix> ...  [--repaired file.json]
import fs from "fs";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";
const BACKEND = process.env.SITEZY_BACKEND || fileURLToPath(new URL("../backend", import.meta.url));
const { validFields } = await import(pathToFileURL(path.resolve(BACKEND, "src/modules/ai/formRepair.js")).href);
const TYPES = ["text", "email", "tel", "number", "select", "textarea", "date"];
const expect = (n) => /e-?mail/.test(n) ? "email" : /phone|mobile|tel\b|whatsapp/.test(n) ? "tel" : /date|day\b/.test(n) ? "date" : null;

function analyse(fields) {
  const per = Object.fromEntries(TYPES.concat("other").map((t) => [t, { n: 0, ok: 0, req: 0, ph: 0, opts: [], typed: 0, typable: 0 }]));
  for (const f of fields) {
    const t = TYPES.includes(String(f?.type || "").toLowerCase()) ? f.type.toLowerCase() : "other";
    const r = per[t]; r.n++;
    if (validFields([f]).length === 1) r.ok++;
    if (f?.required === true) r.req++;
    if (f?.placeholder) r.ph++;
    if (t === "select") r.opts.push(Array.isArray(f.options) ? f.options.length : 0);
    const e = expect(String(f?.name || "").toLowerCase() + " " + String(f?.label || "").toLowerCase());
    if (e) { r.typable++; if (t === e) r.typed++; }
  }
  return per;
}
const fieldsOf = (file) => {
  try {
    const L = JSON.parse(fs.readFileSync(file, "utf8").match(/\{[\s\S]*\}/)[0]);
    return L.pages.flatMap((p) => p.sections || []).filter((s) => s?.type === "DynamicForm")
      .flatMap((s) => (Array.isArray(s.props?.dynamicFields) ? s.props.dynamicFields : Array.isArray(s.props?.fields) ? s.props.fields : []))
      .filter((f) => f && typeof f === "object");
  } catch { return []; }
};
const out = {};
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--repaired=")) {
    const R = JSON.parse(fs.readFileSync(arg.slice(11), "utf8"));
    out.repaired = analyse(R.filter((r) => r.regenerated).flatMap((r) => r.forms_after.flat()));
    continue;
  }
  const [label, spec] = arg.split("="); const [dir, suffix] = spec.split(":");
  const fields = fs.readdirSync(dir).filter((f) => f.endsWith(suffix)).flatMap((f) => fieldsOf(path.join(dir, f)));
  out[label] = analyse(fields);
}
for (const [label, per] of Object.entries(out)) {
  const all = Object.values(per).reduce((a, r) => ({ n: a.n + r.n, ok: a.ok + r.ok, req: a.req + r.req, typed: a.typed + r.typed, typable: a.typable + r.typable }), { n: 0, ok: 0, req: 0, typed: 0, typable: 0 });
  const sel = per.select.opts;
  console.log(`${label}: fields ${all.n}, conformant ${all.ok}, required ${all.req}, type matches name ${all.typed}/${all.typable}, select options mean ${sel.length ? (sel.reduce((a, b) => a + b, 0) / sel.length).toFixed(1) : "-"} (min ${sel.length ? Math.min(...sel) : "-"})`);
  console.log("   per type n/ok: " + TYPES.concat("other").map((t) => `${t} ${per[t].n}/${per[t].ok}`).join(", "));
}
fs.writeFileSync(process.env.FR_OUT || "field_rules.json", JSON.stringify(out, null, 1));
