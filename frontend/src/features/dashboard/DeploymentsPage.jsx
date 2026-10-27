import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api.js";
import DashboardLayout from "../../layouts/DashboardLayout.jsx";
import { Rocket, Clock, LayoutGrid, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";

const COLORS = ["#38bdf8", "#a855f7", "#34d399", "#fb923c", "#f472b6", "#22d3ee", "#fbbf24", "#818cf8"];
function dhash(s) { let h = 0; for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
const pickColor = (s) => COLORS[dhash(s) % COLORS.length];

export default function DeploymentsPage() {
    const [deployments, setDeployments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/analytics/dashboard")
            .then((res) => setDeployments(res.data.recentDeployments || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return (
        <DashboardLayout>
            <style>{`@media (max-width: 720px){ .pg-pad{ padding: 28px 18px 48px !important; } .pg-pad h1{ font-size: 28px !important; } }`}</style>
            <div className="pg-pad" style={{ maxWidth: 980, margin: "0 auto", padding: "40px 40px 60px" }}>
                <Link to="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textDecoration: "none", marginBottom: 22 }}>
                    <ArrowLeft size={15} /> Back to Dashboard
                </Link>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 30 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 14, background: "rgba(168,85,247,0.14)", color: "#a855f7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Rocket size={24} strokeWidth={2.2} />
                    </div>
                    <div>
                        <h1 className="font-display" style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>Deployments</h1>
                        <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>Every publish event across your workspace.</p>
                    </div>
                </div>

                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 24 }}>
                    {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {[...Array(5)].map((_, i) => <div key={i} className="shimmer" style={{ height: 64, borderRadius: 14 }} />)}
                        </div>
                    ) : deployments.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "60px 0" }}>
                            <Rocket size={40} style={{ color: "rgba(var(--fg),0.15)", margin: "0 auto 16px" }} />
                            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-muted)" }}>No deployments yet.</p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {deployments.map((dep) => {
                                const c = pickColor(dep.websiteId?.name || dep._id);
                                const ok = dep.status === "success";
                                return (
                                    <div key={dep._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderRadius: 16, background: "rgba(var(--fg),0.025)", border: "1px solid rgba(var(--fg),0.06)" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                                            <div style={{ width: 40, height: 40, borderRadius: 11, background: `${c}1c`, display: "flex", alignItems: "center", justifyContent: "center", color: c, flexShrink: 0 }}>
                                                <LayoutGrid size={18} strokeWidth={2.2} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <p className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {dep.websiteId?.name || "Website"} <span style={{ fontSize: 10.5, fontWeight: 700, color: c, marginLeft: 6, padding: "2px 7px", borderRadius: 100, background: `${c}1f` }}>v{dep.version}</span>
                                                </p>
                                                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                                    <Clock size={11} /> {new Date(dep.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 5, color: ok ? "#34d399" : "#f87171", padding: "5px 11px", borderRadius: 100, flexShrink: 0, background: ok ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", border: `1px solid ${ok ? "rgba(16,185,129,0.28)" : "rgba(239,68,68,0.28)"}` }}>
                                            {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {dep.status}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
