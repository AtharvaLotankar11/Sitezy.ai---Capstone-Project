// Deployment-pipeline evaluation against the REAL Firebase project, under a fresh test
// tenant ID that cannot collide with a real tenant. DeploymentLog writes go to a throwaway
// in-memory MongoDB (never Atlas). Faults are injected in-process by wrapping
// firebaseService.deployPages; no configuration is changed. All Firestore data written under
// tenants/<testId> is recursively deleted at the end and the deletion is verified.
import { createRequire } from "module";
import { pathToFileURL, fileURLToPath } from "url";
import fs from "fs";

const BACKEND = fileURLToPath(new URL("../backend", import.meta.url)).replace(/[\\/]+$/, "").split("\\").join("/");
const SP = process.argv[2];
const require = createRequire(BACKEND + "/package.json");
require("dotenv").config({ path: BACKEND + "/.env", quiet: true });
const { MongoMemoryServer } = createRequire(import.meta.url)("mongodb-memory-server");

const imp = (p) => import(pathToFileURL(BACKEND + p).href);
const DeploymentLog = (await imp("/src/agents/logs/deploymentLogs.js")).default;
const mem = await MongoMemoryServer.create();
await DeploymentLog.base.connect(mem.getUri());              // same mongoose instance the backend uses
const orch = (await imp("/src/agents/orchestrator.js")).default;
const fsvc = (await imp("/src/agents/services/firebaseService.js")).default;
const { Types } = DeploymentLog.base;

const TEST_TENANTS = [];
const newTenant = () => { const id = new Types.ObjectId().toString(); TEST_TENANTS.push(id); return id; };
const sites = fs.readdirSync(`${SP}/decoding_results_raw`).filter((f) => f.endsWith("_D_both.txt")).sort((a, b) => parseInt(a) - parseInt(b))
  .map((f) => { const t = fs.readFileSync(`${SP}/decoding_results_raw/${f}`, "utf8"); return JSON.parse(t.match(/\{[\s\S]*\}/)[0]).pages; });

const realDeployPages = fsvc.deployPages.bind(fsvc);
let injected = null;                                       // { msg, remaining }
fsvc.deployPages = async (...a) => {
  if (injected && injected.remaining !== 0) { if (injected.remaining > 0) injected.remaining--; throw new Error(injected.msg); }
  return realDeployPages(...a);
};
const quiet = console.log; const mute = () => { console.log = () => {}; console.warn = () => {}; console.error = () => {}; };
const unmute = () => { console.log = quiet; };

async function run(tenantId, pages) {
  const t = Date.now();
  mute();
  const r = await orch.orchestrate({ tenantId, siteId: new Types.ObjectId().toString(), websiteId: new Types.ObjectId(),
                                     userId: new Types.ObjectId(), websiteData: {}, pages, assets: [] });
  unmute();
  const diag = r.agents.filter((a) => a.agent === "DiagnosingAgent").map((a) => a.result);
  const cls = diag.map((d) => (d.analysis || []).find((x) => x.check === "error_classification")?.errorType || null);
  return { ok: r.success, attempts: r.attempts, ms: Date.now() - t, diag_types: cls,
           diag_severity: diag.map((d) => d.severity), error: r.error?.message?.slice(0, 120) || null };
}

const out = { natural: [], faults: [], breaker: [] };
// 1) natural deployments of the 20 generated sites
const T0 = newTenant();
for (const pages of sites) { orch.clearFailures(T0); out.natural.push(await run(T0, pages)); }
quiet("natural:", out.natural.filter((r) => r.ok).length, "/", out.natural.length, "succeeded");

// 2) fault injection: 7 classes x {transient (first attempt only), persistent} x 3 repetitions
const FAULTS = {
  network: "connect ECONNREFUSED 142.250.183.10:443 (network unreachable)",
  timeout: "Deadline exceeded after 60000ms: timeout",
  permission: "7 PERMISSION_DENIED: Missing or insufficient permissions.",
  quota: "8 RESOURCE_EXHAUSTED: Quota exceeded.",
  credentials: "Credential implementation provided to initializeApp() failed: invalid authentication",
  storage: "storage: the specified bucket does not exist",
  unknown: "Unexpected internal error",
};
const EXPECT = { network: "NETWORK_ERROR", timeout: "DEPLOYMENT_TIMEOUT", permission: "PERMISSION_DENIED", quota: "QUOTA_EXCEEDED",
                 credentials: "INVALID_CREDENTIALS", storage: "STORAGE_LIMIT", unknown: "UNKNOWN_ERROR" };
const T1 = newTenant();
for (const [cls, msg] of Object.entries(FAULTS)) for (const mode of ["transient", "persistent"]) for (let k = 0; k < 3; k++) {
  orch.clearFailures(T1);
  injected = { msg, remaining: mode === "transient" ? 1 : -1 };
  const r = await run(T1, sites[k]);
  injected = null;
  out.faults.push({ cls, mode, expected: EXPECT[cls], ...r, classified_ok: r.diag_types[0] === EXPECT[cls] });
}
quiet("fault runs:", out.faults.length);

// 3) circuit breaker: persistent failures on one tenant without clearing history
const T2 = newTenant();
for (let k = 0; k < 7; k++) {
  injected = { msg: FAULTS.permission, remaining: -1 };
  const r = await run(T2, sites[k]); injected = null;
  out.breaker.push({ k: k + 1, ok: r.ok, attempts: r.attempts, rejected_by_breaker: /circuit breaker/i.test(r.error || ""), ms: r.ms });
}

// 4) cleanup: recursively delete every test tenant path and verify
const db = fsvc.getFirestore();
for (const id of TEST_TENANTS) await db.recursiveDelete(db.collection("tenants").doc(id));
const leftovers = [];
for (const id of TEST_TENANTS) {
  const ref = db.collection("tenants").doc(id);
  const [doc, subs] = await Promise.all([ref.get(), ref.listCollections()]);
  if (doc.exists || subs.length) leftovers.push(id);
}
out.cleanup = { tenants: TEST_TENANTS.length, leftovers };
fs.writeFileSync(`${SP}/deploy_results.json`, JSON.stringify(out, null, 1));
quiet("cleanup:", JSON.stringify(out.cleanup));
await DeploymentLog.base.disconnect(); await mem.stop();
process.exit(0);
