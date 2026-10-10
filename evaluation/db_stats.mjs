// READ-ONLY aggregate statistics from the production MongoDB for the paper.
// Prints only counts, rates, durations and coarse error categories. Never prints the
// connection string or any tenant content (prompts, responses, names, URLs).
import { createRequire } from "module";
import { fileURLToPath } from "url";
const require = createRequire(new URL("../backend/package.json", import.meta.url));
require("dotenv").config({ path: fileURLToPath(new URL("../backend/.env", import.meta.url)), quiet: true });
const { MongoClient, ReadPreference } = require("mongodb");

const client = new MongoClient(process.env.MONGO_URI, { readPreference: ReadPreference.SECONDARY_PREFERRED, serverSelectionTimeoutMS: 15000 });
const q = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
const pct = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
function classify(msg) {
  const m = String(msg || "").toLowerCase();
  if (!m) return "none";
  if (m.includes("quota") || m.includes("limit exceeded") || m.includes("429")) return "quota/rate-limit";
  if (m.includes("permission") || m.includes("forbidden") || m.includes("403")) return "permission";
  if (m.includes("network") || m.includes("econnrefused") || m.includes("fetch failed") || m.includes("socket")) return "network";
  if (m.includes("credential") || m.includes("authentication") || m.includes("api key")) return "credentials";
  if (m.includes("timeout") || m.includes("timed out")) return "timeout";
  if (m.includes("storage")) return "storage";
  if (m.includes("json") || m.includes("parse") || m.includes("unexpected token")) return "json/parse";
  if (m.includes("valid")) return "validation";
  if (m.includes("not found")) return "not-found";
  return "other";
}
try {
  await client.connect();
  const db = client.db();
  const out = {};

  // ---------------- AI usage ----------------
  const ai = db.collection("aiusagelogs");
  const aiDocs = await ai.find({}, { projection: { model: 1, success: 1, tokensUsed: 1, createdAt: 1, tenantId: 1, errorMessage: 1 } }).toArray();
  const byModel = {};
  for (const d of aiDocs) {
    const k = d.model || "unknown"; byModel[k] ??= { n: 0, ok: 0, tokens: [], err: {} };
    byModel[k].n++; if (d.success !== false) byModel[k].ok++;
    if (d.tokensUsed) byModel[k].tokens.push(d.tokensUsed);
    if (d.success === false) { const c = classify(d.errorMessage); byModel[k].err[c] = (byModel[k].err[c] || 0) + 1; }
  }
  const dates = aiDocs.map((d) => d.createdAt).filter(Boolean).sort((a, b) => a - b);
  out.ai_usage = {
    total: aiDocs.length, distinct_tenants: new Set(aiDocs.map((d) => String(d.tenantId))).size,
    first: dates[0] ?? null, last: dates.at(-1) ?? null,
    by_model: Object.fromEntries(Object.entries(byModel).map(([k, v]) => [k, {
      n: v.n, share: q(v.n / Math.max(1, aiDocs.length)), success_rate: q(v.ok / v.n),
      tokens_logged: v.tokens.length, tokens_median: pct(v.tokens, 0.5), failure_categories: v.err }])),
  };

  // ---------------- Deployment pipeline ----------------
  const dl = db.collection("deploymentlogs");
  const dep = await dl.find({}, { projection: { status: 1, createdAt: 1, updatedAt: 1, agentLogs: 1, error: 1, tenantId: 1 } }).toArray();
  const byStatus = {}; const dur = { success: [], failed: [] }; const agents = {}; let retried = 0, diagRuns = 0;
  const diagSeverity = {}, diagAutoFix = { attempted: 0, success: 0 }, failCat = {};
  for (const d of dep) {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    if (d.createdAt && d.updatedAt && dur[d.status]) dur[d.status].push((d.updatedAt - d.createdAt) / 1000);
    let maxAttempt = 1;
    for (const a of d.agentLogs || []) {
      agents[a.agent] = (agents[a.agent] || 0) + 1; maxAttempt = Math.max(maxAttempt, a.attempt || 1);
      if (/diagnos/i.test(a.agent || "")) {
        diagRuns++;
        const sev = a.result?.severity; if (sev) diagSeverity[sev] = (diagSeverity[sev] || 0) + 1;
        if (a.result?.autoFixAttempted) diagAutoFix.attempted++;
        if (a.result?.autoFixSuccess) diagAutoFix.success++;
      }
    }
    if (maxAttempt > 1) retried++;
    if (d.status === "failed") { const c = classify(d.error?.message ?? d.error); failCat[c] = (failCat[c] || 0) + 1; }
  }
  const ddates = dep.map((d) => d.createdAt).filter(Boolean).sort((a, b) => a - b);
  out.deployments = {
    total: dep.length, distinct_tenants: new Set(dep.map((d) => String(d.tenantId))).size,
    first: ddates[0] ?? null, last: ddates.at(-1) ?? null, by_status: byStatus,
    success_rate_over_terminal: q((byStatus.success || 0) / Math.max(1, (byStatus.success || 0) + (byStatus.failed || 0))),
    duration_s_success: { n: dur.success.length, median: q(pct(dur.success, 0.5)), p90: q(pct(dur.success, 0.9)) },
    duration_s_failed: { n: dur.failed.length, median: q(pct(dur.failed, 0.5)) },
    agent_log_entries: agents, deployments_with_retry: retried,
    diagnosing_agent: { runs: diagRuns, severity: diagSeverity, autofix: diagAutoFix },
    failure_categories: failCat,
  };

  // ---------------- context counts only ----------------
  for (const c of ["websites", "pages", "tenants", "deployments", "engagementevents", "commits"]) {
    try { out[`count_${c}`] = await db.collection(c).estimatedDocumentCount(); } catch { out[`count_${c}`] = "n/a"; }
  }
  console.log(JSON.stringify(out, null, 1));
} catch (e) {
  console.error("DB error:", e.message.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "<redacted-uri>"));
  process.exit(1);
} finally {
  await client.close();
}
