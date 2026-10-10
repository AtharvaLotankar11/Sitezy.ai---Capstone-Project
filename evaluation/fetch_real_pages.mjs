// READ-ONLY: stream all published pages (layout + SEO metadata) as JSON to stdout, for
// in-memory analysis by a piped consumer. Nothing is written to disk; only find() is used.
import { createRequire } from "module";
import { fileURLToPath } from "url";
const require = createRequire(new URL("../backend/package.json", import.meta.url));
require("dotenv").config({ path: fileURLToPath(new URL("../backend/.env", import.meta.url)), quiet: true });
const { MongoClient } = require("mongodb");
const c = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
try {
  await c.connect();
  const pages = await c.db().collection("pages")
    .find({ status: "published" }, { projection: { websiteId: 1, title: 1, isHomePage: 1, seo: 1, "layoutConfig.sections": 1 } })
    .sort({ _id: 1 }).toArray();
  process.stdout.write(JSON.stringify(pages.map((p) => ({
    id: String(p._id), site: String(p.websiteId), title: p.title || "", home: !!p.isHomePage,
    seo: p.seo || {}, sections: p.layoutConfig?.sections || [],
  }))));
} catch (e) {
  console.error("DB error:", e.message.replace(/mongodb(\+srv)?:\/\/\S+/gi, "<redacted>")); process.exit(1);
} finally { await c.close(); }
