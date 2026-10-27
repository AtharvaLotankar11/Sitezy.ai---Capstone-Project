import { createRequire } from "module";
import { fileURLToPath } from "url";
const require = createRequire(new URL("../backend/package.json", import.meta.url));
require("dotenv").config({ path: fileURLToPath(new URL("../backend/.env", import.meta.url)), quiet: true });
const { MongoClient } = require("mongodb");
const c = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
try {
  await c.connect(); const db = c.db();
  const d = db.collection("deployments");
  const sites = await d.distinct("websiteId"); const tenants = await d.distinct("tenantId");
  const status = await d.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray();
  console.log(JSON.stringify({ versions: await d.countDocuments(), distinct_websites: sites.length, distinct_tenants: tenants.length, by_status: status }));
} catch (e) { console.error("DB error:", e.message.replace(/mongodb(\+srv)?:\/\/\S+/gi, "<redacted>")); }
finally { await c.close(); }
