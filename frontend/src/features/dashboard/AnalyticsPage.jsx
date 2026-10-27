import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
    ArrowLeft, Activity, Users, FileText,
    TrendingUp, Sparkles, AlertCircle, Loader2, BarChart2, Inbox
} from "lucide-react";
import api from "../../services/api.js";
import DashboardLayout from "../../layouts/DashboardLayout.jsx";
import FormSubmissionsModal from "../../components/FormSubmissionsModal.jsx";

export default function AnalyticsPage() {
    const { websiteId } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [showSubs, setShowSubs] = useState(false);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                setLoading(true);
                const { data } = await api.get(`/analytics/website/${websiteId}`);
                if (data.success) {
                    setAnalytics(data.data);
                } else {
                    setError(data.message || "Failed to load analytics");
                }
            } catch (err) {
                console.error("Analytics fetch error:", err);
                setError(err.response?.data?.message || "Failed to connect to server");
            } finally {
                setLoading(false);
            }
        };

        if (websiteId) fetchAnalytics();
    }, [websiteId]);

    return (
        <DashboardLayout>
            <style>{`@media (max-width: 720px){ .an-pad{ padding: 24px 18px 48px !important; } .an-pad h1{ font-size: 26px !important; } }`}</style>
            <div className="an-pad" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 40px 60px" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
                    <Link to="/websites" style={{
                        padding: 10, borderRadius: 12, background: "rgba(var(--fg),0.05)",
                        color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                            <h1 className="font-display" style={{ fontSize: 34, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
                                {analytics?.businessName ? `${analytics.businessName} Analytics` : "Project Analytics"}
                            </h1>
                            <span style={{
                                padding: "4px 10px", borderRadius: 100, background: "rgba(20,184,166,0.15)",
                                color: "var(--text-accent)", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, border: "1px solid rgba(20,184,166,0.28)"
                            }}>
                                <Sparkles size={12} /> AI Powered
                            </span>
                        </div>
                        <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>
                            Live metrics and AI-generated insights from your dynamic forms.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div style={{ minHeight: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
                        <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-primary)" }} />
                        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Analyzing data with AI...</p>
                    </div>
                ) : error ? (
                    <div style={{ padding: 32, background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 24, display: "flex", alignItems: "center", gap: 16, color: "#f87171" }}>
                        <AlertCircle size={28} />
                        <div>
                            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Error loading analytics</h3>
                            <p style={{ fontSize: 14, opacity: 0.8 }}>{error}</p>
                        </div>
                    </div>
                ) : analytics && (
                    <>
                        {/* Top Stats */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginBottom: 40 }}>
                            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 24, display: "flex", alignItems: "center", gap: 20 }}>
                                <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(16, 185, 129, 0.1)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Activity size={28} />
                                </div>
                                <div>
                                    <p style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 700, marginBottom: 4 }}>Live Visitors</p>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                        <h2 style={{ fontSize: 36, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{analytics.liveUsers}</h2>
                                        <span style={{ display: "flex", alignItems: "center", gap: 4, width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 24, display: "flex", alignItems: "center", gap: 20 }}>
                                <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Users size={28} />
                                </div>
                                <div>
                                    <p style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 700, marginBottom: 4 }}>Total Visitors</p>
                                    <h2 style={{ fontSize: 36, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{analytics.totalVisitors}</h2>
                                </div>
                            </div>

                            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 24, display: "flex", alignItems: "center", gap: 20 }}>
                                <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(56,189,248,0.12)", color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <FileText size={28} />
                                </div>
                                <div>
                                    <p style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 700, marginBottom: 4 }}>Form Submissions</p>
                                    <h2 style={{ fontSize: 36, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{analytics.submissionsCount}</h2>
                                </div>
                            </div>
                        </div>

                        {/* Owner-only: view every raw form submission (lead data) */}
                        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
                            <button onClick={() => setShowSubs(true)} style={{
                                display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 100,
                                background: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)",
                                fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)", cursor: "pointer",
                            }}>
                                <Inbox size={16} /> View all submissions
                            </button>
                        </div>

                        {/* AI Insights Section */}
                        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 32, padding: 40, position: "relative", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: 0, right: 0, width: "100%", height: "100%", background: "radial-gradient(circle at top right, rgba(20,184,166,0.1), transparent 50%)", pointerEvents: "none" }} />

                            <div style={{ position: "relative", zIndex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(20,184,166,0.15)", color: "var(--text-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <TrendingUp size={24} />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>Dynamic Business Insights</h2>
                                        <p style={{ fontSize: 14, color: "var(--color-primary)", fontWeight: 600 }}>Analyzed directly from user forms</p>
                                    </div>
                                </div>
                                
                                <p style={{ fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 40, maxWidth: 800 }}>
                                    {analytics.summary}
                                </p>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
                                    {analytics.insights && analytics.insights.map((insight, idx) => (
                                        <div key={idx} style={{ background: "rgba(var(--fg),0.03)", border: "1px solid rgba(var(--fg),0.06)", borderRadius: 20, padding: 24 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                                                <h4 style={{ fontSize: 14, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{insight.label}</h4>
                                                <BarChart2 size={18} style={{ color: "var(--color-primary)", opacity: 0.7 }} />
                                            </div>
                                            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>{insight.value}</div>
                                            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>{insight.insightText}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* All form submissions (owner/admin) */}
            {showSubs && (
                <FormSubmissionsModal
                    websiteId={websiteId}
                    title={`${analytics?.businessName || "Project"} — Submissions`}
                    onClose={() => setShowSubs(false)}
                />
            )}
        </DashboardLayout>
    );
}
