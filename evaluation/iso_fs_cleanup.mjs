// Delete Firestore paths created by isolation_test.mjs (tenant slugs iso[a|b] + 8 hex chars only).
import { createRequire } from "module"; import { pathToFileURL, fileURLToPath } from "url";
const BACKEND = fileURLToPath(new URL("../backend", import.meta.url)).replace(/[\\/]+$/, "").split("\\").join("/");
createRequire(BACKEND + "/package.json")("dotenv").config({ path: BACKEND + "/.env", quiet: true });
const fsvc = (await import(pathToFileURL(BACKEND + "/src/agents/services/firebaseService.js").href)).default;
const db = fsvc.getFirestore();
const refs = (await db.collection("tenants").listDocuments()).filter((r) => /^iso[ab][0-9a-f]{8}$/.test(r.id));
console.log("matching test paths:", refs.map((r) => r.id));
for (const r of refs) await db.recursiveDelete(r);
const again = (await db.collection("tenants").listDocuments()).filter((r) => /^iso[ab][0-9a-f]{8}$/.test(r.id));
console.log("remaining after delete:", again.length); process.exit(0);
