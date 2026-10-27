import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api.js";
import DashboardLayout from "../../layouts/DashboardLayout.jsx";
import { Activity, ArrowLeft, LogIn, FilePlus, UploadCloud, Trash2, RefreshCw } from "lucide-react";

function actionMeta(a) {
    const k = (a || "").toLowerCase();
    if (k.includes("login")) return { color: "#38bdf8", Icon: LogIn };
    if (k.includes("creat")) return { color: "#34d399", Icon: FilePlus };
    if (k.includes("publish") || k.includes("deploy")) return { color: "#a855f7", Icon: UploadCloud };
    if (k.includes("delet")) return { color: "#f87171", Icon: Trash2 };
    if (k.includes("updat")) return { color: "#fbbf24", Icon: RefreshCw };
    return { color: "#94a3b8", Icon: Activity };
}

export default function ActivityPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/analytics/activity?limit=100")
            .then((res) => setLogs(res.data.logs || res.data.activity || []))
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
                    <div style={{ width: 50, height: 50, borderRadius: 14, background: "rgba(56,189,248,0.14)", color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Activity size={24} strokeWidth={2.2} />
                    </div>
                    <div>
                        <h1 className="font-display" style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>Activity Log</h1>
                        <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>A full history of actions in your workspace.</p>
                    </div>
                </div>

                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 24 }}>
                    {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {[...Array(6)].map((_, i) => <div key={i} className="shimmer" style={{ height: 64, borderRadius: 14 }} />)}
                        </div>
                    ) : logs.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "60px 0" }}>
                            <Activity size={40} style={{ color: "rgba(var(--fg),0.15)", margin: "0 auto 16px" }} />
                            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-muted)" }}>No activity recorded yet.</p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {logs.map((log) => {
                                const { color, Icon } = actionMeta(log.action);
                                return (
                                    <div key={log._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderRadius: 16, background: "rgba(var(--fg),0.025)", border: "1px solid rgba(var(--fg),0.06)" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                                            <div style={{ width: 40, height: 40, borderRadius: 11, background: `${color}1c`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                <Icon size={17} strokeWidth={2.2} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <p className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", textTransform: "capitalize" }}>{(log.action || "").replace(/_/g, " ").toLowerCase()}</p>
                                                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                                                    by <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{log.userId?.name || "System"}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", textAlign: "right", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                                            <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                                            <span style={{ opacity: 0.7 }}>{new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                        </div>
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
