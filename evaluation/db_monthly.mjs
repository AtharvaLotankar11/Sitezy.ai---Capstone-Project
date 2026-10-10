import { createRequire } from "module";
import { fileURLToPath } from "url";
const require = createRequire(new URL("../backend/package.json", import.meta.url));
require("dotenv").config({ path: fileURLToPath(new URL("../backend/.env", import.meta.url)), quiet: true });
const { MongoClient } = require("mongodb");
const c = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
try {
  await c.connect();
  const rows = await c.db().collection("aiusagelogs").aggregate([
    { $project: { m: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                  local: { $regexMatch: { input: { $ifNull: ["$model", ""] }, regex: "qwen", options: "i" } },
                  ok: { $ne: ["$success", false] } } },
    { $group: { _id: { m: "$m", local: "$local" }, n: { $sum: 1 }, ok: { $sum: { $cond: ["$ok", 1, 0] } } } },
    { $sort: { "_id.m": 1 } }]).toArray();
  const by = {};
  for (const r of rows) { const k = r._id.m; by[k] ??= { local: 0, cloud: 0, local_ok: 0, cloud_ok: 0 };
    const t = r._id.local ? "local" : "cloud"; by[k][t] += r.n; by[k][t + "_ok"] += r.ok; }
  for (const [m, v] of Object.entries(by)) {
    const n = v.local + v.cloud;
    console.log(`${m}  n=${String(n).padStart(3)}  local=${String(v.local).padStart(3)} (${(100*v.local/n).toFixed(0).padStart(3)}%)  cloud=${String(v.cloud).padStart(3)}  local_ok=${v.local_ok}/${v.local}  cloud_ok=${v.cloud_ok}/${v.cloud}`);
  }
} catch (e) { console.error("DB error:", e.message.replace(/mongodb(\+srv)?:\/\/\S+/gi, "<redacted>")); }
finally { await c.close(); }
