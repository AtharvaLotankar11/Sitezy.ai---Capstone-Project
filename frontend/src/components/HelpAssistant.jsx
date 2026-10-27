import { useState } from "react";
import { createPortal } from "react-dom";
import api from "../services/api.js";
import { HelpCircle, X, Send, Loader2, ArrowLeft, Sparkles, MessageCircleQuestion } from "lucide-react";

// Render light markdown — **bold** + line breaks — so help answers read cleanly
// instead of showing raw ** asterisks.
function renderRich(text) {
    return String(text || "").split("\n").map((line, i) => (
        <span key={i} style={{ display: "block", minHeight: line.trim() ? undefined : "0.6em" }}>
            {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
                part.startsWith("**") && part.endsWith("**")
                    ? <strong key={j} style={{ color: "var(--text-primary)", fontWeight: 700 }}>{part.slice(2, -2)}</strong>
                    : part
            )}
        </span>
    ));
}

// Floating AI help assistant. Suggests common questions and answers any "how do I…/
// what is…" question with step-by-step guidance (POST /ai/help). Reused on the
// dashboard (bottom-right) and in the builder (bottom-left).
export default function HelpAssistant({ position = "bottom-right", context = "app", topics = [] }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [loading, setLoading] = useState(false);
    const [answer, setAnswer] = useState(null); // { question, text }

    const ask = async (question) => {
        const text = (question ?? q).trim();
        if (!text || loading) return;
        setLoading(true);
        setAnswer({ question: text, text: "" });
        setQ("");
        try {
            const { data } = await api.post("/ai/help", { question: text, context });
            setAnswer({ question: text, text: data.answer || "Sorry, I couldn't find an answer for that." });
        } catch {
            setAnswer({ question: text, text: "Help is unavailable right now — please try again in a moment." });
        } finally {
            setLoading(false);
        }
    };

    const sideStyle = position === "bottom-left" ? { left: 24 } : { right: 24 };

    return createPortal(
        <>
            <button
                onClick={() => setOpen((o) => !o)}
                title="Help & guide"
                style={{
                    position: "fixed", bottom: 24, ...sideStyle, zIndex: 1200,
                    width: 52, height: 52, borderRadius: "50%", cursor: "pointer",
                    border: "1px solid rgba(var(--fg),0.14)", background: "var(--grad-btn)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 8px 24px rgba(8,90,72,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
                }}
            >
                {open ? <X size={20} /> : <HelpCircle size={24} strokeWidth={2.2} />}
            </button>

            {open && (
                <div style={{
                    position: "fixed", bottom: 88, ...sideStyle, zIndex: 1200,
                    width: 372, maxWidth: "calc(100vw - 32px)", maxHeight: "72vh",
                    display: "flex", flexDirection: "column",
                    background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 18,
                    boxShadow: "0 24px 60px rgba(0,0,0,0.55)", overflow: "hidden",
                    backdropFilter: "blur(28px) saturate(1.6)", WebkitBackdropFilter: "blur(28px) saturate(1.6)",
                }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <Sparkles size={16} style={{ color: "var(--text-accent)" }} />
                            <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Help &amp; Guide</span>
                        </div>
                        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={17} /></button>
                    </div>

                    {/* Body */}
                    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                        {answer ? (
                            <>
                                <button onClick={() => setAnswer(null)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, marginBottom: 12, padding: 0 }}>
                                    <ArrowLeft size={14} /> Back to topics
                                </button>
                                <div style={{ display: "flex", gap: 9, marginBottom: 12 }}>
                                    <MessageCircleQuestion size={16} style={{ color: "var(--text-accent)", flexShrink: 0, marginTop: 2 }} />
                                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>{answer.question}</span>
                                </div>
                                <div style={{ background: "rgba(var(--fg),0.03)", border: "1px solid rgba(var(--fg),0.06)", borderRadius: 12, padding: "14px 16px" }}>
                                    {loading ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--text-secondary)", fontSize: 13 }}>
                                            <Loader2 size={15} className="animate-spin" /> Thinking…
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--text-secondary)" }}>{renderRich(answer.text)}</div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: 14 }}>
                                    Hi! I can help you find your way around. Pick a topic or ask anything below.
                                </p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {topics.map((t) => (
                                        <button key={t} onClick={() => ask(t)} style={{
                                            display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
                                            padding: "11px 13px", borderRadius: 11, cursor: "pointer",
                                            background: "rgba(var(--fg),0.03)", border: "1px solid var(--border-color)",
                                            color: "var(--text-primary)", fontSize: 13, fontWeight: 500, fontFamily: "var(--font-display)",
                                            transition: "all 0.15s ease",
                                        }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(20,184,166,0.08)"; e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(var(--fg),0.03)"; e.currentTarget.style.borderColor = "var(--border-color)"; }}>
                                            <HelpCircle size={14} style={{ color: "var(--text-accent)", flexShrink: 0 }} /> {t}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Ask box */}
                    <div style={{ padding: 12, borderTop: "1px solid var(--border-color)", flexShrink: 0, display: "flex", gap: 8 }}>
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
                            placeholder="Ask anything…"
                            style={{ flex: 1, padding: "11px 14px", borderRadius: 12, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", fontSize: 13.5, outline: "none" }}
                        />
                        <button onClick={() => ask()} disabled={loading || !q.trim()} style={{
                            width: 42, flexShrink: 0, borderRadius: 12, border: "none", cursor: (loading || !q.trim()) ? "not-allowed" : "pointer",
                            background: "var(--grad-btn)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                            opacity: (loading || !q.trim()) ? 0.6 : 1,
                        }}>
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                    </div>
                </div>
            )}
        </>,
        document.body
    );
}
