// Dynamic tenant-isolation and access-control tests against the REAL backend (src/server.js),
// started on a throwaway in-memory MongoDB (never Atlas). Two tenants A and B are registered
// through the public API; tenant B (OWNER) then calls every authenticated route that takes a
// resource identifier with A's identifiers. A request counts as blocked only if the status is
// 401/403/404 AND A's documents are byte-identical afterwards AND the response contains none of
// A's marker strings. Positive controls (A's own token on the same routes) show that the routes
// work, so a block is not an artefact of a broken route. Also covers token tampering, role-claim
// forgery, intra-tenant RBAC, body tenantId injection, list-endpoint leakage and draft exposure.
// Not covered (by design): payment routes, LLM-backed generation, real Firebase deploys.
import { spawn } from "child_process";
import { createRequire } from "module";
import crypto from "crypto";
import fs from "fs";

const BACKEND = fileURLToPath(new URL("../backend", import.meta.url)).replace(/[\\/]+$/, "").split("\\").join("/");
const SP = process.argv[2];
const require = createRequire(BACKEND + "/package.json");
require("dotenv").config({ path: BACKEND + "/.env", quiet: true }); const env = process.env;
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = createRequire(import.meta.url)("mongodb-memory-server");

const PORT = 5099, BASE = `http://127.0.0.1:${PORT}/api`;
const mem = await MongoMemoryServer.create();
const server = spawn(process.execPath, ["src/server.js"], { cwd: BACKEND,
  env: { ...process.env, MONGO_URI: mem.getUri("sitezy_isolation"), PORT: String(PORT), NODE_ENV: "development" },
  stdio: ["ignore", "pipe", "pipe"] });
let serverLog = ""; server.stdout.on("data", (d) => (serverLog += d)); server.stderr.on("data", (d) => (serverLog += d));
for (let i = 0; i < 60 && !/running on port/.test(serverLog); i++) await new Promise((r) => setTimeout(r, 500));
if (!/running on port/.test(serverLog)) { console.error(serverLog); throw new Error("server did not start"); }
await mongoose.connect(mem.getUri("sitezy_isolation"));
const db = mongoose.connection.db;
const cleanup = async () => { server.kill(); await mongoose.disconnect().catch(() => {}); await mem.stop().catch(() => {}); };
process.on("uncaughtException", async (e) => { console.error(e); await cleanup(); process.exit(1); });
process.on("unhandledRejection", async (e) => { console.error(e); await cleanup(); process.exit(1); });

async function call(method, path, token, body) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
    return { status: r.status, text: await r.text() };
  } catch (e) { return { status: 0, text: String(e) }; }
}
const rnd = () => crypto.randomBytes(4).toString("hex");
const pw = () => crypto.randomBytes(12).toString("base64url");

// ---------- setup: two tenants, resources for A ----------
async function register(tag) {
  const slug = `iso${tag}${rnd()}`;
  const r = await call("POST", "/auth/register", null,
    { tenantName: `Isolation ${tag}`, tenantSlug: slug, name: `Owner ${tag}`, email: `owner-${slug}@example.com`, password: pw() });
  const j = JSON.parse(r.text);
  if (r.status !== 201) throw new Error("register failed " + r.text);
  return { token: j.token, userId: j.user.id, tenantId: j.tenant.id, slug };
}
const A = await register("a"), B = await register("b");
const MARK = `MARKER-A-${rnd()}`;
const json = async (m, p, t, b) => { const r = await call(m, p, t, b); return { ...r, j: (() => { try { return JSON.parse(r.text); } catch { return {}; } })() }; };

const wA = (await json("POST", "/websites", A.token, { name: "Alpha Site", description: MARK })).j.website;
const wB = (await json("POST", "/websites", B.token, { name: "Beta Site", description: "beta" })).j.website;
const pagesA = (await json("GET", `/builder/websites/${wA._id}/pages`, A.token)).j.pages;
const homeA = pagesA.find((p) => p.isHomePage);
const draftA = (await json("POST", `/builder/websites/${wA._id}/pages`, A.token, { title: `Draft ${MARK}`, slug: `draft-${rnd()}` })).j.page;
const homeB = (await json("GET", `/builder/websites/${wB._id}/pages`, B.token)).j.pages[0];
const sectionA = homeA.layoutConfig.sections[0].id;
const commitA = (await json("POST", `/builder/websites/${wA._id}/pages/${homeA._id}/commit`, A.token, { message: `commit ${MARK}` })).j.commit;
const domA = (await json("POST", "/domains", A.token, { domain: `alpha-${rnd()}.test`, websiteId: wA._id })).j.domain;
const editorA = (await json("POST", "/auth/invite", A.token, { name: "Editor A", email: `editor-${A.slug}@example.com`, password: pw(), role: "EDITOR" })).j.user;
const editorTok = jwt.sign({ userId: editorA.id, tenantId: A.tenantId, role: "EDITOR" }, env.JWT_SECRET, { expiresIn: "1h" });
const markers = [MARK, wA._id, homeA._id, draftA._id, commitA._id, domA._id, editorA.id, A.tenantId, A.slug];

// snapshot of all documents belonging to tenant A (resource collections only)
const COLLS = ["websites", "pages", "commits", "domains", "users", "tenants"];
async function snapshotA() {
  const tid = new mongoose.Types.ObjectId(A.tenantId); const out = {};
  for (const c of COLLS) out[c] = await db.collection(c).find(c === "tenants" ? { _id: tid } : { tenantId: tid }).sort({ _id: 1 }).toArray();
  return crypto.createHash("sha256").update(JSON.stringify(out)).digest("hex");
}

const results = [];
function record(group, name, method, path, r, ok, extra = {}) {
  results.push({ group, name, method, path: path.replace(/[0-9a-f]{24}/g, ":id"), status: r.status, pass: ok, ...extra });
}
const leaks = (text) => markers.filter((m) => m && text.includes(m));

// ---------- 1) cross-tenant: B's OWNER token against A's identifiers ----------
const W = wA._id, P = homeA._id, PG = `/builder/websites/${W}/pages`;
const fakeId = new mongoose.Types.ObjectId().toString();
const ATTACKS = [
  ["website", "GET", `/websites/${W}`], ["website", "PUT", `/websites/${W}`, { name: "pwned" }],
  ["website", "POST", `/websites/${W}/publish`, {}], ["website", "GET", `/websites/${W}/export`],
  ["website", "GET", `/websites/${W}/deployments`], ["website", "POST", `/websites/${W}/rollback/${fakeId}`, {}],
  ["builder", "GET", PG], ["builder", "GET", `${PG}/${P}`], ["builder", "POST", PG, { title: "pwned", slug: "pwned" }],
  ["builder", "POST", `${PG}/ai`, { title: "pwned" }], ["builder", "PUT", `${PG}/${P}/sections`, { sections: [] }],
  ["builder", "PATCH", `${PG}/${P}/sections/${sectionA}`, { props: { heading: "pwned" } }],
  ["builder", "POST", `${PG}/${P}/save-draft`, { layoutConfig: { sections: [] } }],
  ["builder", "POST", `${PG}/${P}/commit`, { message: "pwned" }], ["builder", "GET", `${PG}/${P}/commits`],
  ["builder", "POST", `${PG}/${P}/rollback/${commitA._id}`, {}],
  // path confusion: B's own website id with A's page id
  ["builder", "GET", `/builder/websites/${wB._id}/pages/${P}`], ["builder", "PUT", `/builder/websites/${wB._id}/pages/${P}/sections`, { sections: [] }],
  ["ai", "POST", "/ai/seo/score", { websiteId: W, pageId: P }], ["ai", "POST", "/ai/seo/auto-improve", { websiteId: W, pageId: P }],
  ["ai", "POST", "/ai/seo/generate-meta", { websiteId: W, pageId: P }], ["ai", "POST", "/ai/design/health", { websiteId: W, pageId: P }],
  ["ai", "POST", "/ai/engagement/suggest", { websiteId: W, pageId: P }],
  ["ai", "POST", "/ai/seo/score", { websiteId: wB._id, pageId: P }],
  ["analytics", "GET", `/analytics/website/${W}`], ["analytics", "GET", `/analytics/website/${W}/submissions`],
  ["publish", "POST", `/publish/${W}`, { pages: [{ title: "x", slug: "x", sections: [] }] }],
  ["publish", "GET", `/publish/logs/${W}`], ["publish", "GET", `/publish/logs/${W}/${fakeId}`],
  ["forms", "GET", `/forms/submissions/${W}`],
  ["domain", "POST", `/domains/${domA._id}/verify`, {}], ["domain", "PUT", `/domains/${domA._id}`, { domain: "evil.test" }],
  ["auth", "PUT", `/auth/users/${editorA.id}/role`, { role: "ADMIN" }],
  ["admin", "GET", "/admin/revenue-summary"], ["admin", "GET", "/admin/subscriptions"],
  // destructive ones last
  ["builder", "DELETE", `${PG}/${draftA._id}`], ["domain", "DELETE", `/domains/${domA._id}`],
  ["auth", "DELETE", `/auth/users/${editorA.id}`], ["website", "DELETE", `/websites/${W}`],
];
let before = await snapshotA();
for (const [g, m, p, b] of ATTACKS) {
  const r = await call(m, p, B.token, b);
  const after = await snapshotA();
  const leaked = leaks(r.text);
  const ok = [401, 403, 404].includes(r.status) && after === before && leaked.length === 0;
  record("cross-tenant", g, m, p, r, ok, { state_unchanged: after === before, leaked });
  before = after;
}

// ---------- 2) list endpoints: B must see none of A's identifiers ----------
for (const p of ["/websites", "/domains", "/auth/users", "/auth/me", "/tenant", "/analytics/dashboard", "/analytics/activity",
                 "/publish/history", "/publish/stats", "/ai/logs"]) {
  const r = await call("GET", p, B.token);
  const leaked = leaks(r.text);
  record("list-leakage", "list", "GET", p, r, r.status < 500 && leaked.length === 0, { leaked });
}

// ---------- 3) body tenantId injection ----------
{
  const r = await json("POST", "/websites", B.token, { name: "Injected", description: "x", tenantId: A.tenantId });
  const doc = r.j.website && await db.collection("websites").findOne({ _id: new mongoose.Types.ObjectId(r.j.website._id) });
  record("injection", "create website with tenantId=A", "POST", "/websites", r, !!doc && String(doc.tenantId) === B.tenantId);
  const r2 = await call("PUT", "/tenant/branding", B.token, { tenantId: A.tenantId, primaryColor: "#ff0000" });
  const tA = await db.collection("tenants").findOne({ _id: new mongoose.Types.ObjectId(A.tenantId) });
  record("injection", "branding with tenantId=A", "PUT", "/tenant/branding", r2, tA?.branding?.primaryColor !== "#ff0000");
  const r3 = await json("POST", "/domains", B.token, { domain: `beta-${rnd()}.test`, websiteId: W });
  const d = r3.j.domain;
  record("injection", "attach own domain to A's website", "POST", "/domains", r3,
    !(r3.status === 201 && d && String(d.websiteId) === W), { note: r3.status === 201 ? "domain record referencing A's website was created" : "" });
  if (d) {
    const rr = await call("GET", `/public/resolve?hostname=${encodeURIComponent(d.domain)}`, null);
    record("injection", "resolve B's domain bound to A's website", "GET", "/public/resolve", rr, rr.status === 404 && leaks(rr.text).length === 0);
  }
}

// ---------- 4) token tampering ----------
const now = Math.floor(Date.now() / 1000);
const TOKENS = {
  "no token": null, "malformed": "abc.def.ghi",
  "wrong secret": jwt.sign({ userId: B.userId, tenantId: B.tenantId, role: "OWNER" }, "not-the-secret"),
  "alg none": jwt.sign({ userId: A.userId, tenantId: A.tenantId, role: "OWNER" }, null, { algorithm: "none" }),
  "expired": jwt.sign({ userId: A.userId, tenantId: A.tenantId, role: "OWNER", exp: now - 60 }, env.JWT_SECRET),
  "B user claiming tenant A": jwt.sign({ userId: B.userId, tenantId: A.tenantId, role: "OWNER" }, env.JWT_SECRET),
  "deleted/unknown user": jwt.sign({ userId: fakeId, tenantId: A.tenantId, role: "OWNER" }, env.JWT_SECRET),
};
for (const [name, tok] of Object.entries(TOKENS)) {
  const r = await call("GET", `/websites`, tok);
  record("token", name, "GET", "/websites", r, [401, 403].includes(r.status) && leaks(r.text).length === 0);
}

// ---------- 5) intra-tenant RBAC: A's EDITOR, including a forged OWNER role claim ----------
const forged = jwt.sign({ userId: editorA.id, tenantId: A.tenantId, role: "OWNER" }, env.JWT_SECRET, { expiresIn: "1h" });
const W2 = (await json("POST", "/websites", A.token, { name: "Alpha Two", description: MARK })).j.website._id;
const RBAC = [
  ["DELETE", `/websites/${W2}`], ["POST", `/websites/${W2}/publish`, {}], ["PUT", "/tenant/branding", { primaryColor: "#000000" }],
  ["POST", "/auth/invite", { name: "X Y", email: `x-${rnd()}@example.com`, password: pw(), role: "ADMIN" }],
  ["PUT", `/auth/users/${editorA.id}/role`, { role: "ADMIN" }], ["POST", "/domains", { domain: `ed-${rnd()}.test` }],
  ["GET", "/ai/logs"], ["GET", `/analytics/website/${W2}/submissions`],
];
for (const [label, tok] of [["EDITOR", editorTok], ["EDITOR with forged OWNER claim", forged]]) {
  for (const [m, p, b] of RBAC) {
    const s0 = await snapshotA(); const r = await call(m, p, tok, b); const s1 = await snapshotA();
    record("rbac", label, m, p, r, r.status === 403 && s0 === s1);
  }
}
// RBAC gap probe (non-destructive): /api/publish/:id has no role check; an empty page list stops at body validation.
{
  const r = await call("POST", `/publish/${W2}`, editorTok, { pages: [] });
  record("rbac", "EDITOR reaches deploy route (empty body)", "POST", `/publish/${W2}`, r, r.status === 403,
    { note: r.status === 400 ? "passed auth and ownership; only body validation stopped it" : "" });
}

// ---------- 6) public endpoints: drafts must not be exposed ----------
{
  const r0 = await call("POST", "/public/chat", null, { question: "what do you sell?", websiteId: W2 });
  record("public", "chat over all-draft website", "POST", "/public/chat", r0, r0.status === 404);
  const rs = await call("GET", `/public/sites/${A.slug}`, null);
  record("public", "unpublished website", "GET", "/public/sites/:slug", rs, rs.status === 404 && !rs.text.includes(MARK));
  // publish A's website + home page directly in the DB (no Firebase deploy), keep draftA as draft
  const W3 = (await json("POST", "/websites", A.token, { name: "Alpha Pub", description: "pub" })).j.website;
  const pages3 = (await json("GET", `/builder/websites/${W3._id}/pages`, A.token)).j.pages;
  const d3 = (await json("POST", `/builder/websites/${W3._id}/pages`, A.token, { title: `Hidden ${MARK}`, slug: "hidden" })).j.page;
  await db.collection("websites").updateOne({ _id: new mongoose.Types.ObjectId(W3._id) }, { $set: { status: "published" } });
  await db.collection("pages").updateOne({ _id: new mongoose.Types.ObjectId(pages3[0]._id) }, { $set: { status: "published" } });
  // public sites are served from the latest successful deployment snapshot; insert one containing only the home page
  await db.collection("deployments").insertOne({ tenantId: new mongoose.Types.ObjectId(A.tenantId), websiteId: new mongoose.Types.ObjectId(W3._id),
    status: "success", version: 1, snapshot: [{ ...pages3[0], status: "published" }], createdAt: new Date() });
  const rp = await call("GET", `/public/sites/${A.slug}?websiteId=${W3._id}`, null);
  record("public", "published site (positive control)", "GET", "/public/sites/:slug", rp, rp.status === 200);
  record("public", "draft page absent from published site", "GET", "/public/sites/:slug", rp, !rp.text.includes(`Hidden ${MARK}`));
  const rd = await call("GET", `/public/sites/${A.slug}/pages/${d3.slug}?websiteId=${W3._id}`, null);
  record("public", "draft page by slug", "GET", "/public/sites/:slug/pages/:slug", rd, rd.status === 404 && !rd.text.includes(MARK));
}

// ---------- 7) positive controls: A's own token reaches the same routes ----------
const W4 = (await json("POST", "/websites", A.token, { name: "Alpha Four", description: MARK })).j.website._id;
const P4 = (await json("GET", `/builder/websites/${W4}/pages`, A.token)).j.pages[0]._id;
for (const [m, p, b] of [["GET", `/websites/${W4}`], ["PUT", `/websites/${W4}`, { name: "Alpha Four b" }], ["GET", `/builder/websites/${W4}/pages`],
  ["GET", `/builder/websites/${W4}/pages/${P4}`], ["POST", `/builder/websites/${W4}/pages/${P4}/commit`, { message: "ok" }],
  ["GET", `/builder/websites/${W4}/pages/${P4}/commits`], ["GET", `/websites/${W4}/export`], ["GET", `/websites/${W4}/deployments`],
  ["GET", `/analytics/website/${W4}`], ["GET", `/publish/logs/${W4}`], ["GET", "/auth/users"], ["GET", "/domains"]]) {
  const r = await call(m, p, A.token, b);
  record("positive-control", "owner A", m, p, r, r.status >= 200 && r.status < 300);
}

// ---------- report ----------
const groups = {};
for (const r of results) { const g = (groups[r.group] ||= { n: 0, pass: 0 }); g.n++; if (r.pass) g.pass++; }
fs.writeFileSync(`${SP}/isolation_results.json`, JSON.stringify({ groups, results }, null, 1));
console.log(JSON.stringify(groups));
for (const r of results.filter((x) => !x.pass)) console.log("FAIL", JSON.stringify(r));
const { pathToFileURL } = await import("url");
const fsvc = (await import(pathToFileURL(BACKEND + "/src/agents/services/firebaseService.js").href)).default;
await new Promise((r) => setTimeout(r, 3000));           // let fire-and-forget counters land
const fdb = fsvc.getFirestore(); const left = [];
for (const slug of [A.slug, B.slug]) {
  const ref = fdb.collection("tenants").doc(slug); await fdb.recursiveDelete(ref);
  const [d, subs] = await Promise.all([ref.get(), ref.listCollections()]); if (d.exists || subs.length) left.push(slug);
}
console.log("firestore cleanup leftovers:", left.length);
const saved = JSON.parse(fs.readFileSync(`${SP}/isolation_results.json`, "utf8")); saved.firestore_leftovers = left.length;
fs.writeFileSync(`${SP}/isolation_results.json`, JSON.stringify(saved, null, 1));
await cleanup();
process.exit(0);
