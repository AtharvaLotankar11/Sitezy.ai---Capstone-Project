import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import api from "../services/api.js";
import { FileText, X, Inbox, Loader2 } from "lucide-react";

// Firestore timestamps can arrive as { _seconds } or an ISO string — render either.
function fmtDate(v) {
    try {
        if (!v) return "";
        if (typeof v === "object" && v._seconds) return new Date(v._seconds * 1000).toLocaleString();
        return new Date(v).toLocaleString();
    } catch { return ""; }
}

// Fetches and lists every form submission (lead data) for a website from Firebase.
// Used by the Projects card and the Analytics page.
export default function FormSubmissionsModal({ websiteId, title = "Form Submissions", onClose }) {
    const [subs, setSubs] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        api.get(`/analytics/website/${websiteId}/submissions`)
            .then(({ data }) => { if (alive) setSubs(data.submissions || []); })
            .catch(() => { if (alive) setSubs([]); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [websiteId]);

    return createPortal(
        <div onClick={onClose} style={{
            position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, background: "rgba(0,0,0,0.74)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        }}>
            <div onClick={(e) => e.stopPropagation()} style={{
                width: "100%", maxWidth: 680, maxHeight: "85vh", display: "flex", flexDirection: "column",
                background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 22,
                boxShadow: "0 24px 60px rgba(0,0,0,0.55)", overflow: "hidden",
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <FileText size={18} style={{ color: "var(--text-accent)", flexShrink: 0 }} />
                        <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {title}{subs ? ` (${subs.length})` : ""}
                        </h3>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, flexShrink: 0 }}><X size={18} /></button>
                </div>
                <div style={{ padding: 18, overflowY: "auto" }}>
                    {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 0" }}>
                            <Loader2 size={26} className="animate-spin" style={{ color: "var(--color-primary)" }} />
                            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Loading submissions…</p>
                        </div>
                    ) : (subs && subs.length > 0) ? (
                        subs.map((s, i) => {
                            const { id, submittedAt, ...fields } = s || {};
                            const entries = Object.entries(fields).filter(([k]) => !k.startsWith("_"));
                            return (
                                <div key={id || i} style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(var(--fg),0.03)", border: "1px solid rgba(var(--fg),0.06)", marginBottom: 12 }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>#{subs.length - i}</span>
                                        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{fmtDate(submittedAt)}</span>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {entries.length === 0
                                            ? <span style={{ fontSize: 13, color: "var(--text-muted)" }}>No fields.</span>
                                            : entries.map(([k, v]) => (
                                                <div key={k} style={{ display: "flex", gap: 12, fontSize: 13 }}>
                                                    <span style={{ color: "var(--text-muted)", textTransform: "capitalize", minWidth: 130, flexShrink: 0 }}>{k.replace(/_/g, " ")}</span>
                                                    <span style={{ color: "var(--text-primary)", wordBreak: "break-word" }}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ textAlign: "center", padding: "48px 0" }}>
                            <Inbox size={36} style={{ color: "rgba(var(--fg),0.15)", margin: "0 auto 14px" }} />
                            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>No form submissions yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
