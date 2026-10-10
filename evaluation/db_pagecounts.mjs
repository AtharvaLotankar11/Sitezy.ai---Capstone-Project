import { createRequire } from "module";
import { fileURLToPath } from "url";
const require = createRequire(new URL("../backend/package.json", import.meta.url));
require("dotenv").config({ path: fileURLToPath(new URL("../backend/.env", import.meta.url)), quiet: true });
const { MongoClient } = require("mongodb");
const c = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
try {
  await c.connect(); const db = c.db();
  const pub = await db.collection("websites").find({ status: "published" }, { projection: { _id: 1 } }).toArray();
  const ids = pub.map((w) => w._id);
  const pages = db.collection("pages");
  const out = {
    websites_total: await db.collection("websites").countDocuments(),
    websites_published: ids.length,
    pages_total: await pages.countDocuments(),
    pages_published: await pages.countDocuments({ status: "published" }),
    pages_on_published_sites: await pages.countDocuments({ websiteId: { $in: ids } }),
    pages_on_published_sites_nonempty: await pages.countDocuments({ websiteId: { $in: ids }, "layoutConfig.sections.0": { $exists: true } }),
    tenants_with_published_sites: (await db.collection("websites").distinct("tenantId", { status: "published" })).length,
  };
  console.log(JSON.stringify(out));
} catch (e) { console.error("DB error:", e.message.replace(/mongodb(\+srv)?:\/\/\S+/gi, "<redacted>")); }
finally { await c.close(); }
