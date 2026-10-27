import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import api from "../../services/api.js";
import DashboardLayout from "../../layouts/DashboardLayout.jsx";
import internetIcon from "../../components/icons/internet_16521005.png";
import launchIcon from "../../components/icons/launch_5207371.png";
import scheduleIcon from "../../components/icons/schedule_5582249.png";
import browsingIcon from "../../components/icons/browsing_11831965.png";
import onlineIcon from "../../components/icons/online_11115816.png";
import {
    Globe, FileText, Wand2, Rocket, Activity,
    TrendingUp, Plus, Clock, LayoutGrid, CheckCircle2, XCircle, ArrowRight, Settings,
    LogIn, FilePlus, Trash2, UploadCloud, RefreshCw, ExternalLink
} from "lucide-react";

// Shared card + list-row styles used across the dashboard bento.
const cardStyle = {
    background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 24,
    backdropFilter: "blur(28px) saturate(1.6)", WebkitBackdropFilter: "blur(28px) saturate(1.6)", boxShadow: "var(--shadow-glass)",
};
const miniRowStyle = {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: "11px 14px", borderRadius: 12, background: "rgba(var(--fg),0.02)", border: "1px solid transparent",
    textDecoration: "none", color: "var(--text-primary)", transition: "all 0.15s ease",
};

// Per-item accent colors so list rows aren't a wall of grey + green.
const DASH_COLORS = ["#38bdf8", "#a855f7", "#34d399", "#fb923c", "#f472b6", "#22d3ee", "#fbbf24", "#818cf8"];
function dhash(s) { let h = 0; for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function pickColor(s) { return DASH_COLORS[dhash(s) % DASH_COLORS.length]; }
// Recolor a PNG icon per item (keeps its detail) by rotating its hue a deterministic amount.
function hueFilter(s) { return `hue-rotate(${dhash(s) % 360}deg) saturate(1.3)`; }
// Activity action → { color, Icon }
function actionMeta(a) {
    const k = (a || "").toLowerCase();
    if (k.includes("login")) return { color: "#38bdf8", Icon: LogIn };
    if (k.includes("creat")) return { color: "#34d399", Icon: FilePlus };
    if (k.includes("publish") || k.includes("deploy")) return { color: "#a855f7", Icon: UploadCloud };
    if (k.includes("delet")) return { color: "#f87171", Icon: Trash2 };
    if (k.includes("updat")) return { color: "#fbbf24", Icon: RefreshCw };
    return { color: "#94a3b8", Icon: Activity };
}

export default function DashboardPage() {
    const { user, tenant } = useSelector((s) => s.auth);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [websites, setWebsites] = useState([]);
    const [domains, setDomains] = useState([]);

    useEffect(() => {
        api.get("/analytics/dashboard")
            .then((res) => setStats(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
        api.get("/websites").then((r) => setWebsites(r.data.websites || [])).catch(() => { });
        api.get("/domains").then((r) => setDomains(r.data.domains || [])).catch(() => { });
    }, []);

    return (
        <DashboardLayout>
            <style>{`
                @media (max-width: 1200px) {
                    .dash-welcome-row { flex-direction: column !important; }
                    .dash-quicklinks { width: 100% !important; border-left: none !important; border-top: 1px solid var(--border-color); padding-left: 0 !important; padding-top: 16px !important; }
                }
                @media (max-width: 1024px) {
                    .dash-bento > * { grid-column: span 6 !important; grid-row: auto !important; }
                }
                @media (max-width: 720px) {
                    .dash-page-pad { padding: 28px 18px 48px !important; }
                    .dash-bento { grid-template-columns: 1fr !important; }
                    .dash-bento > * { grid-column: 1 / -1 !important; grid-row: auto !important; }
                }
            `}</style>
            <div className="dash-page-pad" style={{ maxWidth: 1600, margin: "0 auto", padding: "40px 40px 60px" }}>

                {/* BENTO GRID */}
                <div className="dash-bento" style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(12, 1fr)",
                    gridAutoRows: "minmax(180px, auto)",
                    gap: 20,
                }}>

                    {/* 1. WELCOME (span 8) — hero on the left, Quick Links column on the right */}
                    <div className="glass-card" style={{
                        gridColumn: "span 8", gridRow: "span 1", borderRadius: 24,
                        padding: 30, display: "flex", alignItems: "stretch",
                        position: "relative", overflow: "hidden"
                    }}>
                        <div className="sz-mesh" style={{ opacity: 0.4 }} />
                        <div style={{ position: "absolute", right: -40, bottom: -40, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />

                        <div className="dash-welcome-row" style={{ position: "relative", zIndex: 1, display: "flex", gap: 24, width: "100%", alignItems: "stretch" }}>
                            {/* Left — hero */}
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
                                <div>
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 13px", borderRadius: 100, background: "rgba(var(--fg),0.03)", border: "1px solid var(--border-color)", marginBottom: 14 }}>
                                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-primary)" }} />
                                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-secondary)" }}>{tenant?.name}</span>
                                    </div>
                                    <h1 className="font-display" style={{ fontSize: 33, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)", lineHeight: 1.1 }}>
                                        Welcome back, <span className="serif-accent gradient-text">{user?.name?.split(" ")[0]}</span>
                                    </h1>
                                    <p style={{ fontSize: 14.5, color: "var(--text-secondary)", maxWidth: 440, lineHeight: 1.5, marginTop: 8 }}>
                                        Build, deploy, and manage your high-performance websites from your command center.
                                    </p>
                                </div>
                                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                    <Link to="/websites" style={{
                                        display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 22px", borderRadius: 100, textDecoration: "none",
                                        background: "var(--grad-btn)", color: "#fff", border: "1px solid rgba(var(--fg),0.12)",
                                        fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, transition: "all 0.2s ease",
                                        boxShadow: "0 5px 16px rgba(8,90,72,0.35), inset 0 1px 0 rgba(var(--fg),0.14)"
                                    }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                                        <Plus size={17} strokeWidth={2.5} /> Create Project
                                    </Link>
                                    <Link to="/ai" style={{
                                        display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 22px", borderRadius: 100, textDecoration: "none",
                                        background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)",
                                        fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, transition: "background 0.15s ease"
                                    }} onMouseEnter={e => e.currentTarget.style.background = "rgba(var(--fg),0.05)"} onMouseLeave={e => e.currentTarget.style.background = "var(--bg-input)"}>
                                        <Wand2 size={17} /> AI Playground
                                    </Link>
                                </div>
                            </div>

                            {/* Right — Quick Links column */}
                            <div className="dash-quicklinks" style={{ width: 230, flexShrink: 0, borderLeft: "1px solid var(--border-color)", paddingLeft: 22, display: "flex", flexDirection: "column", justifyContent: "center", gap: 9 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 2 }}>Quick Links</span>
                                {[
                                    { label: "Custom Domains", to: "/settings", dot: "#10b981" },
                                    { label: "Team Settings", to: "/settings", dot: "#f59e0b" },
                                ].map(({ label, to, dot }) => (
                                    <Link key={label} to={to} style={{
                                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 14px", borderRadius: 12,
                                        background: "rgba(var(--fg),0.03)", border: "1px solid var(--border-color)", textDecoration: "none",
                                        color: "var(--text-primary)", fontSize: 13.5, fontWeight: 600, transition: "all 0.15s ease",
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(var(--fg),0.06)"; e.currentTarget.style.borderColor = "rgba(var(--fg),0.18)"; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(var(--fg),0.03)"; e.currentTarget.style.borderColor = "var(--border-color)"; }}>
                                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} /> {label}
                                        </span>
                                        <ArrowRight size={14} style={{ opacity: 0.5 }} />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 2. AT A GLANCE (span 4) — stats + Recent Deployments / Activity Log */}
                    <div style={{ ...cardStyle, gridColumn: "span 4", gridRow: "span 1", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-secondary)" }}>At a Glance</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {[
                                { label: "Websites", value: stats?.stats?.websiteCount ?? websites.length, img: internetIcon, color: "#38bdf8" },
                                { label: "Deploys", value: stats?.stats?.deploymentCount || 0, img: launchIcon, color: "#a855f7" },
                            ].map(({ label, value, img, color }) => (
                                <div key={label} style={{ padding: "16px 16px 14px", borderRadius: 16, background: `${color}0f`, border: `1px solid ${color}26` }}>
                                    <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}1f`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                                        <img src={img} alt="" style={{ width: 19, height: 19, objectFit: "contain" }} />
                                    </div>
                                    <div className="font-display" style={{ fontSize: 30, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>{loading ? "—" : value}</div>
                                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", marginTop: 4 }}>{label}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {[
                                { to: "/deployments", label: "Recent Deployments", sub: `${stats?.stats?.deploymentCount ?? 0} total`, img: launchIcon, color: "#a855f7" },
                                { to: "/activity", label: "Activity Log", sub: "Full workspace history", img: scheduleIcon, color: "#38bdf8" },
                            ].map(({ to, label, sub, img, color }) => (
                                <Link key={to} to={to} style={miniRowStyle}
                                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(var(--fg),0.04)"; e.currentTarget.style.borderColor = "var(--border-color)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(var(--fg),0.02)"; e.currentTarget.style.borderColor = "transparent"; }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                                        <span style={{ width: 34, height: 34, borderRadius: 10, background: `${color}1c`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            <img src={img} alt="" style={{ width: 18, height: 18, objectFit: "contain" }} />
                                        </span>
                                        <span style={{ minWidth: 0 }}>
                                            <span className="font-display" style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
                                            <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{sub}</span>
                                        </span>
                                    </span>
                                    <ArrowRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* 3. RECENT PROJECTS (span 8) */}
                    <div style={{ ...cardStyle, gridColumn: "span 8", gridRow: "span 1", padding: 28, display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                            <h3 className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Recent Projects</h3>
                            <Link to="/websites" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>View all <ArrowRight size={13} /></Link>
                        </div>
                        {websites.length === 0 ? (
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "30px 0", gap: 12 }}>
                                <LayoutGrid size={28} style={{ color: "rgba(var(--fg),0.15)" }} />
                                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No projects yet.</p>
                                <Link to="/websites" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-accent)", textDecoration: "none" }}>Create your first project →</Link>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {websites.slice(0, 5).map((w) => {
                                    const c = pickColor(w._id || w.name);
                                    const live = w.status === "published";
                                    return (
                                        <Link key={w._id} to={`/websites/${w._id}/builder`} style={miniRowStyle}
                                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(var(--fg),0.04)"; e.currentTarget.style.borderColor = "var(--border-color)"; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(var(--fg),0.02)"; e.currentTarget.style.borderColor = "transparent"; }}>
                                            <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                                <span style={{ width: 36, height: 36, borderRadius: 10, background: `${c}1c`, border: `1px solid ${c}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                    <img src={browsingIcon} alt="" style={{ width: 20, height: 20, objectFit: "contain", filter: hueFilter(w._id || w.name) }} />
                                                </span>
                                                <span style={{ minWidth: 0 }}>
                                                    <span className="font-display" style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.name}</span>
                                                    <span className="font-mono" style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{w.defaultDomain || `${w.slug || "draft"}.sitezy.ai`}</span>
                                                </span>
                                            </span>
                                            <span style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                                                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 10px", borderRadius: 100, color: live ? "#34d399" : "var(--accent-sky)", background: live ? "rgba(16,185,129,0.12)" : "rgba(56,189,248,0.12)", border: `1px solid ${live ? "rgba(16,185,129,0.3)" : "rgba(56,189,248,0.3)"}` }}>{live ? "Live" : "Draft"}</span>
                                                <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 4. ACTIVE LINKS / DOMAINS (span 4) */}
                    <div style={{ ...cardStyle, gridColumn: "span 4", gridRow: "span 1", padding: 28, display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                            <h3 className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Active Links</h3>
                            <Link to="/settings" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", textDecoration: "none" }}>Manage</Link>
                        </div>
                        {domains.length === 0 ? (
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "30px 0", gap: 12 }}>
                                <Globe size={28} style={{ color: "rgba(var(--fg),0.15)" }} />
                                <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>No custom domains yet.</p>
                                <Link to="/settings" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-accent)", textDecoration: "none" }}>Add a domain →</Link>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {domains.slice(0, 5).map((d) => (
                                    <a key={d._id} href={d.verified ? `/site/${d.domain}` : undefined} target={d.verified ? "_blank" : undefined} rel="noreferrer" style={{ ...miniRowStyle, cursor: d.verified ? "pointer" : "default" }}
                                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(var(--fg),0.04)"; e.currentTarget.style.borderColor = "var(--border-color)"; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(var(--fg),0.02)"; e.currentTarget.style.borderColor = "transparent"; }}>
                                        <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                                            <span style={{ width: 32, height: 32, borderRadius: 9, background: `${pickColor(d.domain)}1c`, border: `1px solid ${pickColor(d.domain)}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                <img src={onlineIcon} alt="" style={{ width: 18, height: 18, objectFit: "contain", filter: hueFilter(d._id || d.domain) }} />
                                            </span>
                                            <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{d.domain}</span>
                                        </span>
                                        {d.isDefault
                                            ? <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", flexShrink: 0 }}>Primary</span>
                                            : d.verified ? <ExternalLink size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} /> : null}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

