import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import api from "../../services/api.js";
import DashboardLayout from "../../layouts/DashboardLayout.jsx";
import {
    Globe, FileText, Wand2, Rocket, Activity,
    TrendingUp, Plus, Clock, LayoutGrid, CheckCircle2, XCircle, ArrowRight, Settings,
    LogIn, FilePlus, Trash2, UploadCloud, RefreshCw
} from "lucide-react";

// Per-item accent colors so list rows aren't a wall of grey + green.
const DASH_COLORS = ["#38bdf8", "#a855f7", "#34d399", "#fb923c", "#f472b6", "#22d3ee", "#fbbf24", "#818cf8"];
function dhash(s) { let h = 0; for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function pickColor(s) { return DASH_COLORS[dhash(s) % DASH_COLORS.length]; }
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

    useEffect(() => {
        api.get("/analytics/dashboard")
            .then((res) => setStats(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const activityList = stats?.recentActivity?.slice(0, 5) || [];
    const deploymentList = stats?.recentDeployments?.slice(0, 5) || [];

    return (
        <DashboardLayout>
            <div style={{ maxWidth: 1600, margin: "0 auto", padding: "40px 40px 60px" }}>

                {/* BENTO GRID */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(12, 1fr)",
                    gridAutoRows: "minmax(180px, auto)",
                    gap: 20,
                }}>

                    {/* 1. HERO CELL (Span 8 cols, 2 rows) */}
                    <div className="glass-card" style={{
                        gridColumn: "span 8", gridRow: "span 2", borderRadius: 24,
                        padding: 40, display: "flex", flexDirection: "column", justifyContent: "space-between",
                        position: "relative", overflow: "hidden"
                    }}>
                        {/* Decorative mesh element */}
                        <div className="sz-mesh" style={{ opacity: 0.4 }} />
                        <div style={{ position: "absolute", right: -40, bottom: -40, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />

                        <div style={{ position: "relative", zIndex: 1 }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 100, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", marginBottom: 24 }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-primary)" }} />
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-secondary)" }}>{tenant?.name} Workspace</span>
                            </div>

                            <h1 className="font-display" style={{ fontSize: 42, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 16, lineHeight: 1.05 }}>
                                Welcome back,<br /><span className="serif-accent gradient-text" style={{ fontSize: "1.1em" }}>{user?.name?.split(" ")[0]}</span>
                            </h1>
                            <p style={{ fontSize: 16, color: "var(--text-secondary)", maxWidth: 400, lineHeight: 1.5 }}>
                                Start building, deploying, and managing your high-performance websites from your command center.
                            </p>
                        </div>

                        <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 16, marginTop: 40 }}>
                            <Link to="/websites" style={{
                                display: "inline-flex", alignItems: "center", gap: 10,
                                padding: "15px 28px", borderRadius: 100, textDecoration: "none",
                                background: "var(--grad-btn)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)",
                                fontWeight: 600, fontSize: 15, transition: "all 0.2s ease",
                                boxShadow: "0 5px 16px rgba(8,90,72,0.35), inset 0 1px 0 rgba(255,255,255,0.14)"
                            }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                                <Plus size={18} strokeWidth={2.5} /> Create Project
                            </Link>

                            <Link to="/ai" style={{
                                display: "inline-flex", alignItems: "center", gap: 10,
                                padding: "15px 28px", borderRadius: 100, textDecoration: "none",
                                background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)",
                                fontWeight: 600, fontSize: 15, transition: "background 0.15s ease"
                            }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "var(--bg-input)"}>
                                <Wand2 size={18} /> AI Playground
                            </Link>
                        </div>
                    </div>

                    {/* 2. STATS COMPACT CELL (Span 4 cols, 1 row) */}
                    <div style={{
                        gridColumn: "span 4", gridRow: "span 1",
                        background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 24,
                        backdropFilter: "blur(28px) saturate(1.6)", WebkitBackdropFilter: "blur(28px) saturate(1.6)", boxShadow: "var(--shadow-glass)",
                        padding: 28, display: "flex", flexDirection: "column", justifyContent: "center"
                    }}>
                        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-secondary)", marginBottom: 18 }}>At a Glance</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            {[
                                { label: "Websites", value: stats?.stats?.websiteCount || 0, Icon: Globe, color: "#38bdf8" },
                                { label: "Deploys", value: stats?.stats?.deploymentCount || 0, Icon: Rocket, color: "#a855f7" },
                            ].map(({ label, value, Icon, color }) => (
                                <div key={label} style={{ padding: "18px 18px 16px", borderRadius: 18, background: `${color}0f`, border: `1px solid ${color}26` }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 11, background: `${color}1f`, color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                                        <Icon size={18} strokeWidth={2.2} />
                                    </div>
                                    <div className="font-display" style={{ fontSize: 36, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                                        {loading ? "—" : value}
                                    </div>
                                    <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-muted)", marginTop: 5 }}>{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. QUICK NAV CELL (Span 4 cols, 1 row) */}
                    <div style={{
                        gridColumn: "span 4", gridRow: "span 1",
                        background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 24,
                        backdropFilter: "blur(28px) saturate(1.6)", WebkitBackdropFilter: "blur(28px) saturate(1.6)", boxShadow: "var(--shadow-glass)",
                        padding: 24, display: "flex", flexDirection: "column", gap: 8
                    }}>
                        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-secondary)", marginBottom: 12, paddingLeft: 8 }}>Quick Links</h3>
                        <Link to="/settings" style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)",
                            textDecoration: "none", color: "var(--text-primary)", border: "1px solid transparent",
                            transition: "all 0.15s ease"
                        }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "var(--border-color)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "transparent"; }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                                <span style={{ fontSize: 14, fontWeight: 600 }}>Custom Domains</span>
                            </div>
                            <ArrowRight size={14} color="var(--text-muted)" />
                        </Link>
                        <Link to="/settings" style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)",
                            textDecoration: "none", color: "var(--text-primary)", border: "1px solid transparent",
                            transition: "all 0.15s ease"
                        }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "var(--border-color)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "transparent"; }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                                <span style={{ fontSize: 14, fontWeight: 600 }}>Team Settings</span>
                            </div>
                            <ArrowRight size={14} color="var(--text-muted)" />
                        </Link>
                    </div>

                    {/* 4. DEPLOYMENTS CELL (Span 6 cols, 2+ rows) */}
                    <div style={{
                        gridColumn: "span 6", gridRow: "span 2",
                        background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 24,
                        backdropFilter: "blur(28px) saturate(1.6)", WebkitBackdropFilter: "blur(28px) saturate(1.6)", boxShadow: "var(--shadow-glass)",
                        padding: 32, display: "flex", flexDirection: "column"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                            <h3 style={{ fontWeight: 700, fontSize: 18, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Recent Deployments</h3>
                            <Link to="/websites" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", textDecoration: "none" }}>View All</Link>
                        </div>

                        {loading ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {[...Array(3)].map((_, i) => <div key={i} className="shimmer" style={{ height: 60, borderRadius: 12 }} />)}
                            </div>
                        ) : deploymentList.length === 0 ? (
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyItems: "center", justifyContent: "center", padding: "40px 0" }}>
                                <Rocket size={24} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
                                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No completed deployments.</p>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {deploymentList.map((dep) => {
                                    const c = pickColor(dep.websiteId?.name || dep._id);
                                    const ok = dep.status === "success";
                                    return (
                                    <div key={dep._id} style={{
                                        display: "flex", alignItems: "center", justifyContent: "space-between",
                                        padding: "14px 16px", borderRadius: 16, background: "rgba(255,255,255,0.025)",
                                        border: "1px solid rgba(255,255,255,0.06)", transition: "background 0.15s ease"
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                                        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                                            <div style={{ width: 38, height: 38, borderRadius: 11, background: `${c}1c`, display: "flex", alignItems: "center", justifyContent: "center", color: c, flexShrink: 0 }}>
                                                <LayoutGrid size={17} strokeWidth={2.2} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <p className="font-display" style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {dep.websiteId?.name || "Website"} <span style={{ fontSize: 10.5, fontWeight: 700, color: c, marginLeft: 6, padding: "2px 7px", borderRadius: 100, background: `${c}1f` }}>v{dep.version}</span>
                                                </p>
                                                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                                    <Clock size={11} /> {new Date(dep.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                                            display: "flex", alignItems: "center", gap: 5, color: ok ? "#34d399" : "#f87171",
                                            padding: "5px 11px", borderRadius: 100, flexShrink: 0,
                                            background: ok ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                                            border: `1px solid ${ok ? "rgba(16,185,129,0.28)" : "rgba(239,68,68,0.28)"}`
                                        }}>
                                            {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                            {dep.status}
                                        </span>
                                    </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 5. ACTIVITY CELL (Span 6 cols, 2+ rows) */}
                    <div style={{
                        gridColumn: "span 6", gridRow: "span 2",
                        background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 24,
                        backdropFilter: "blur(28px) saturate(1.6)", WebkitBackdropFilter: "blur(28px) saturate(1.6)", boxShadow: "var(--shadow-glass)",
                        padding: 32, display: "flex", flexDirection: "column"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                            <h3 style={{ fontWeight: 700, fontSize: 18, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Activity Log</h3>
                        </div>

                        {loading ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {[...Array(3)].map((_, i) => <div key={i} className="shimmer" style={{ height: 60, borderRadius: 12 }} />)}
                            </div>
                        ) : activityList.length === 0 ? (
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0" }}>
                                <Activity size={24} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
                                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No recent activity.</p>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {activityList.map((log) => {
                                    const { color, Icon } = actionMeta(log.action);
                                    return (
                                    <div key={log._id} style={{
                                        display: "flex", alignItems: "center", justifyContent: "space-between",
                                        padding: "14px 16px", borderRadius: 16, background: "rgba(255,255,255,0.025)",
                                        border: "1px solid rgba(255,255,255,0.06)", transition: "background 0.15s ease"
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                                        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                                            <div style={{ width: 38, height: 38, borderRadius: 11, background: `${color}1c`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                <Icon size={16} strokeWidth={2.2} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <p className="font-display" style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", textTransform: "capitalize" }}>{log.action.replace(/_/g, " ").toLowerCase()}</p>
                                                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                                                    by <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{log.userId?.name || "System"}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", textAlign: "right", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                                            <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                                            <span style={{ opacity: 0.7 }}>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

