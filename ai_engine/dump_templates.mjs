// Regenerates templates_seed.json — the "good design" corpus used to train the
// design-flaw autoencoder + isolation forest. Run:  node dump_templates.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const mod = await import(new URL("../frontend/src/utils/templates.js", import.meta.url));
const out = mod.TEMPLATES.map((t) => ({ id: t.id, name: t.name, sections: t.sections }));
writeFileSync(join(__dir, "templates_seed.json"), JSON.stringify(out));
console.log("wrote templates_seed.json:", out.length, "templates");
