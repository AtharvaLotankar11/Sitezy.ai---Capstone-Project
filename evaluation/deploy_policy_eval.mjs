// Isolates the DiagnosingAgent's contribution. The same 42 injected faults (7 classes x
// transient/persistent x 3) are run under three retry policies against the REAL Firebase test
// project, under fresh tenant IDs:
//   deployed    - production orchestrator: DiagnosingAgent classifies, retries medium severity once
//   no_retry    - no diagnosis-driven retry: every failure is final
//   blind_retry - no diagnosis: every failure is retried once, whatever its cause
// Deployment-log writes are stubbed in-process (bookkeeping only; no database is used).
// All Firestore data written under the test tenants is recursively deleted and verified.
import { createRequire } from "module";
import { pathToFileURL, fileURLToPath } from "url";
import fs from "fs";

const BACKEND = fileURLToPath(new URL("../backend", import.meta.url)).replace(/[\\/]+$/, "").split("\\").join("/");
const BACKEND_ABS = process.env.SITEZY_BACKEND || BACKEND;
const SP = process.argv[2];
const require = createRequire(BACKEND_ABS + "/package.json");
require("dotenv").config({ path: BACKEND_ABS + "/.env", quiet: true });
const imp = (p) => import(pathToFileURL(BACKEND_ABS + p).href);

const DeploymentLog = (await imp("/src/agents/logs/deploymentLogs.js")).default;
DeploymentLog.create = async () => ({ _id: "stub" });
DeploymentLog.addAgentLog = async () => {};
DeploymentLog.updateStatus = async () => {};
const orch = (await imp("/src/agents/orchestrator.js")).default;
const fsvc = (await imp("/src/agents/services/firebaseService.js")).default;
const { Types } = DeploymentLog.base;

const sites = fs.readdirSync(`${SP}/decoding_results_raw`).filter((f) => f.endsWith("_D_both.txt")).sort((a, b) => parseInt(a) - parseInt(b))
  .map((f) => JSON.parse(fs.readFileSync(`${SP}/decoding_results_raw/${f}`, "utf8").match(/\{[\s\S]*\}/)[0]).pages);

const realDeploy = fsvc.deployPages.bind(fsvc);
let injected = null;
fsvc.deployPages = async (...a) => {
  if (injected && injected.remaining !== 0) { if (injected.remaining > 0) injected.remaining--; throw new Error(injected.msg); }
  return realDeploy(...a);
};
const FAULTS = {
  network: "connect ECONNREFUSED 142.250.183.10:443 (network unreachable)",
  timeout: "Deadline exceeded after 60000ms: timeout",
  permission: "7 PERMISSION_DENIED: Missing or insufficient permissions.",
  quota: "8 RESOURCE_EXHAUSTED: Quota exceeded.",
  credentials: "Credential implementation provided to initializeApp() failed: invalid authentication",
  storage: "storage: the specified bucket does not exist",
  unknown: "Unexpected internal error",
};

const origShould = orch.shouldRetry.bind(orch), origDiag = orch.executeDiagnosingAgent.bind(orch);
function setPolicy(p) {
  orch.shouldRetry = p === "no_retry" ? () => false : p === "blind_retry" ? () => true : origShould;
  orch.executeDiagnosingAgent = p === "blind_retry" ? async () => ({ agent: "none", severity: "unknown" }) : origDiag;
}
const log = console.log, mute = () => { console.log = () => {}; console.warn = () => {}; console.error = () => {}; };

const TENANTS = [], out = [];
for (const policy of ["deployed", "no_retry", "blind_retry"]) {
  setPolicy(policy);
  const tid = new Types.ObjectId().toString(); TENANTS.push(tid);
  for (const [cls, msg] of Object.entries(FAULTS)) for (const mode of ["transient", "persistent"]) for (let k = 0; k < 3; k++) {
    orch.clearFailures(tid);
    injected = { msg, remaining: mode === "transient" ? 1 : -1 };
    const t = Date.now(); mute();
    const r = await orch.orchestrate({ tenantId: tid, siteId: new Types.ObjectId().toString(), websiteId: new Types.ObjectId(),
                                       userId: new Types.ObjectId(), websiteData: {}, pages: sites[k], assets: [] });
    console.log = log; injected = null;
    out.push({ policy, cls, mode, ok: r.success, attempts: r.attempts, ms: Date.now() - t });
  }
  log(policy, "done");
}

const db = fsvc.getFirestore();
for (const id of TENANTS) await db.recursiveDelete(db.collection("tenants").doc(id));
const left = [];
for (const id of TENANTS) { const ref = db.collection("tenants").doc(id); const [d, s] = await Promise.all([ref.get(), ref.listCollections()]); if (d.exists || s.length) left.push(id); }
fs.writeFileSync(`${SP}/deploy_policy_results.json`, JSON.stringify({ runs: out, cleanup: { tenants: TENANTS.length, leftovers: left } }, null, 1));
for (const p of ["deployed", "no_retry", "blind_retry"]) {
  const R = out.filter((r) => r.policy === p), T = R.filter((r) => r.mode === "transient"), P = R.filter((r) => r.mode === "persistent");
  const crit = R.filter((r) => ["permission", "credentials"].includes(r.cls));
  log(p, `transient recovered ${T.filter((r) => r.ok).length}/${T.length} | attempts on persistent ${P.reduce((a, r) => a + r.attempts, 0)} (wasted ${P.reduce((a, r) => a + r.attempts - 1, 0)}) | retries of permission/credential faults ${crit.reduce((a, r) => a + r.attempts - 1, 0)} | total s ${(R.reduce((a, r) => a + r.ms, 0) / 1000).toFixed(1)}`);
}
log("cleanup leftovers:", left.length);
process.exit(0);
