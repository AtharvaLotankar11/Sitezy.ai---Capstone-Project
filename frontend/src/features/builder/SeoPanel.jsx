import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateSections } from "../../store/slices/builderSlice.js";
import api from "../../services/api.js";
import toast from "react-hot-toast";
import {
    Gauge, Sparkles, Loader2, X, Check, RotateCcw, TrendingUp, ShieldCheck,
    ArrowRight, AlertTriangle, ChevronDown, ChevronRight,
} from "lucide-react";

const STATUS_COLOR = { good: "#34d399", warn: "#fbbf24", bad: "#f87171" };
const SEV_COLOR = { high: "#f87171", medium: "#fbbf24", low: "#94a3b8" };

function scoreColor(s) {
    return s >= 75 ? "#34d399" : s >= 50 ? "#fbbf24" : "#f87171";
}

function Gauge100({ value, label }) {
    const c = scoreColor(value);
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
                width: 76, height: 76, borderRadius: "50%", flexShrink: 0,
                background: `conic-gradient(${c} ${value * 3.6}deg, rgba(var(--fg),0.08) 0deg)`,
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                    <span className="font-display" style={{ fontSize: 22, fontWeight: 700, color: c, lineHeight: 1 }}>{Math.round(value)}</span>
                    <span style={{ fontSize: 9, color: "var(--text-muted)" }}>/100</span>
                </div>
            </div>
            {label && <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</div>}
        </div>
    );
}

function Section({ icon, title, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ borderBottom: "1px solid var(--border-color)" }}>
            <button onClick={() => setOpen(!open)} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px", background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)",
            }}>
                <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 800, letterSpacing: "-0.01em" }}>
                    {icon} {title}
                </span>
                {open ? <ChevronDown size={15} style={{ opacity: 0.5 }} /> : <ChevronRight size={15} style={{ opacity: 0.5 }} />}
            </button>
            {open && <div style={{ padding: "0 18px 18px" }}>{children}</div>}
        </div>
    );
}

const btn = (bg, color, border) => ({
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
    padding: "11px", borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: "pointer",
    background: bg, color, border: border || "none", fontFamily: "var(--font-display)",
});

export default function SeoPanel({ websiteId, pageId, open, onClose }) {
    const dispatch = useDispatch();
    const currentPage = useSelector((s) => s.builder.currentPage);
    const [keyword, setKeyword] = useState("");
    const [fixing, setFixing] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [seo, setSeo] = useState(null);
    const [improving, setImproving] = useState(false);
    const [improve, setImprove] = useState(null);
    const [applying, setApplying] = useState(false);
    const [metaGen, setMetaGen] = useState(false);
    const [engLoading, setEngLoading] = useState(false);
    const [eng, setEng] = useState(null);
    const [dLoading, setDLoading] = useState(false);
    const [design, setDesign] = useState(null);

    if (!open) return null;

    const body = () => ({ websiteId, pageId, keyword: keyword.trim() });
    const handleErr = (e) => toast.error(e.response?.data?.message || "Request failed");

    const analyze = async () => {
        setAnalyzing(true); setImprove(null);
        try {
            const r = await api.post("/ai/seo/score", body());
            setSeo(r.data);
        } catch (e) { handleErr(e); } finally { setAnalyzing(false); }
    };

    const autoImprove = async () => {
        setImproving(true);
        try {
            const r = await api.post("/ai/seo/auto-improve", { ...body(), threshold: 80, maxIters: 3 });
            setImprove(r.data);
            if (!r.data.improved) toast("No changes needed — already strong, or nothing to safely rewrite.", { icon: "✨" });
        } catch (e) { handleErr(e); } finally { setImproving(false); }
    };

    const generateMeta = async () => {
        setMetaGen(true);
        try {
            const r = await api.post("/ai/seo/generate-meta", body());
            setSeo({ score: r.data.score, factors: r.data.factors, keyword: r.data.keyword });
            setImprove(null);
            toast.success("Meta description & structured data generated ✓");
        } catch (e) { handleErr(e); } finally { setMetaGen(false); }
    };

    const applyImprove = async () => {
        if (!improve?.proposedSections) return;
        setApplying(true);
        const res = await dispatch(updateSections({ websiteId, pageId, sections: improve.proposedSections }));
        setApplying(false);
        if (updateSections.fulfilled.match(res)) {
            toast.success("Applied to your page ✓");
            setSeo({ score: improve.after.score, factors: improve.after.factors, weakest: null });
            setImprove(null);
        } else {
            toast.error("Failed to apply changes");
        }
    };

    const getEngagement = async () => {
        setEngLoading(true);
        try { const r = await api.post("/ai/engagement/suggest", { websiteId, pageId }); setEng(r.data); }
        catch (e) { handleErr(e); } finally { setEngLoading(false); }
    };

    const scanDesign = async () => {
        setDLoading(true);
        try { const r = await api.post("/ai/design/health", { websiteId, pageId }); setDesign(r.data); }
        catch (e) { handleErr(e); } finally { setDLoading(false); }
    };

    const persist = async (sections, msg) => {
        setFixing(true);
        const res = await dispatch(updateSections({ websiteId, pageId, sections }));
        setFixing(false);
        if (updateSections.fulfilled.match(res)) { toast.success(msg); return true; }
        toast.error("Failed to apply"); return false;
    };

    // Design auto-fix — apply per-section prop fixes (e.g. contrast) from the scan
    const applyDesignFixes = async () => {
        const secs = JSON.parse(JSON.stringify(currentPage?.layoutConfig?.sections || []));
        const byId = new Map(secs.map((s) => [s.id, s]));
        let count = 0;
        (design.fixes || []).forEach((f) => { const s = byId.get(f.sectionId); if (s) { s.props = { ...s.props, [f.prop]: f.value }; count++; } });
        if (!count) return toast("Nothing to auto-fix here.", { icon: "✨" });
        if (await persist(secs, `Auto-fixed ${count} issue${count > 1 ? "s" : ""} ✓`)) setDesign(null);
    };

    // Engagement auto-fix — reorder a section (move CTA up / move section down)
    const applyMove = async (from, to) => {
        const secs = JSON.parse(JSON.stringify(currentPage?.layoutConfig?.sections || []));
        if (from < 0 || from >= secs.length || to < 0 || to >= secs.length) return toast.error("Layout changed — re-run suggestions.");
        const [it] = secs.splice(from, 1);
        secs.splice(to, 0, it);
        secs.forEach((s, i) => { s.order = i; });
        if (await persist(secs, "Layout updated ✓")) setEng(null);
    };

    const weakFactors = (seo?.factors || []).filter((f) => f.status !== "good").slice(0, 6);
    const goodCount = (seo?.factors || []).filter((f) => f.status === "good").length;

    return (
        <div style={{
            width: 360, minWidth: 360, flexShrink: 0, background: "var(--bg-surface)",
            borderLeft: "1px solid var(--border-color)", display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
            {/* Header */}
            <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Gauge size={15} style={{ color: "var(--text-accent)" }} />
                    <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>SEO &amp; Insights</h3>
                </div>
                <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(var(--fg),0.4)", padding: 4 }}><X size={16} /></button>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
                {/* ── SEO ── */}
                <Section icon={<Gauge size={14} style={{ color: "var(--text-accent)" }} />} title="SEO Score">
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Target keyword (optional)"
                            style={{ flex: 1, padding: "9px 12px", borderRadius: 10, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
                    </div>
                    <button onClick={analyze} disabled={analyzing} style={btn("var(--bg-input)", "var(--text-accent)", "1px solid rgba(20,184,166,0.3)")}>
                        {analyzing ? <><Loader2 size={14} className="animate-spin" /> Analyzing…</> : <><Gauge size={14} /> Analyze Page</>}
                    </button>

                    {seo && (
                        <div style={{ marginTop: 16 }}>
                            <Gauge100 value={seo.score} label={`${goodCount} of ${seo.factors?.length || 0} checks passing`} />
                            {seo.keyword && (
                                <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-muted)" }}>
                                    {seo.keywordDerived ? "Auto-detected keyword: " : "Target keyword: "}
                                    <span style={{ color: "var(--text-accent)", fontWeight: 700 }}>{seo.keyword}</span>
                                </div>
                            )}
                            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                                {weakFactors.length === 0 && <p style={{ fontSize: 12.5, color: "#34d399" }}>All checks look good. 🎉</p>}
                                {weakFactors.map((f) => (
                                    <div key={f.key} style={{ display: "flex", gap: 9, padding: "9px 11px", borderRadius: 10, background: "rgba(var(--fg),0.03)", border: "1px solid rgba(var(--fg),0.05)" }}>
                                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLOR[f.status], marginTop: 5, flexShrink: 0 }} />
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>{f.label}</div>
                                            <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.45, marginTop: 2 }}>{f.hint}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {!improve && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                                    <button onClick={autoImprove} disabled={improving} className="saas-button" style={btn("var(--grad-btn)", "#fff")}>
                                        {improving ? <><Loader2 size={14} className="animate-spin" /> AI rewriting…</> : <><Sparkles size={14} /> Auto-Improve with AI</>}
                                    </button>
                                    <button onClick={generateMeta} disabled={metaGen} style={btn("var(--bg-input)", "var(--text-accent)", "1px solid rgba(20,184,166,0.3)")}>
                                        {metaGen ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <><Check size={14} /> Generate meta &amp; schema</>}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Auto-improve preview */}
                    {improve && (
                        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.2)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor(improve.before.score), fontFamily: "var(--font-display)" }}>{Math.round(improve.before.score)}</span>
                                <ArrowRight size={15} style={{ color: "var(--text-muted)" }} />
                                <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor(improve.after.score), fontFamily: "var(--font-display)" }}>{Math.round(improve.after.score)}</span>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>AI-assisted</span>
                            </div>
                            {!improve.improved && (
                                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Your page already looks good — no further safe improvements were found.</p>
                            )}
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto" }}>
                                {(improve.steps || []).map((step, si) => (
                                    step.meta ? (
                                        <div key={`m${si}`} style={{ display: "flex", gap: 8, padding: "9px 10px", borderRadius: 9, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)" }}>
                                            <Check size={14} style={{ color: "#34d399", marginTop: 1, flexShrink: 0 }} />
                                            <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45 }}>{step.label}</span>
                                        </div>
                                    ) : (step.changes || []).map((c, i) => (
                                        <div key={`${si}-${i}`} style={{ padding: "8px 10px", borderRadius: 9, background: "rgba(0,0,0,0.2)" }}>
                                            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 4 }}>{c.type} · {c.propKey}</div>
                                            <div style={{ fontSize: 11.5, color: "#f87171", textDecoration: "line-through", opacity: 0.7, lineHeight: 1.4 }}>{c.before}</div>
                                            <div style={{ fontSize: 12, color: "#34d399", lineHeight: 1.45, marginTop: 3 }}>{c.after}</div>
                                        </div>
                                    ))
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                                <button onClick={applyImprove} disabled={applying} style={btn("#0d9488", "#fff")}>
                                    {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Apply
                                </button>
                                <button onClick={() => setImprove(null)} style={{ ...btn("var(--bg-input)", "var(--text-secondary)", "1px solid var(--border-color)"), width: "auto", padding: "11px 14px" }}>
                                    <RotateCcw size={14} /> Discard
                                </button>
                            </div>
                        </div>
                    )}
                </Section>

                {/* ── Engagement ── */}
                <Section icon={<TrendingUp size={14} style={{ color: "#a855f7" }} />} title="Engagement" defaultOpen={false}>
                    <button onClick={getEngagement} disabled={engLoading} style={btn("var(--bg-input)", "var(--accent-violet)", "1px solid rgba(168,85,247,0.3)")}>
                        {engLoading ? <><Loader2 size={14} className="animate-spin" /> Predicting…</> : <><TrendingUp size={14} /> Get Suggestions</>}
                    </button>
                    {eng && (
                        <div style={{ marginTop: 14 }}>
                            {typeof eng.engagementScore === "number" && <Gauge100 value={eng.engagementScore} label="Engagement Readiness" />}

                            {/* What's working */}
                            {(eng.strengths || []).length > 0 && (
                                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                                    {eng.strengths.map((s, i) => (
                                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                            <Check size={13} style={{ color: "#34d399", marginTop: 2, flexShrink: 0 }} />
                                            <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45 }}>{s}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Opportunities — applyable model suggestions first, then rubric insights */}
                            <div style={{ marginTop: 12 }}>
                                {(eng.suggestions || []).length === 0 && (eng.opportunities || []).length === 0 ? (
                                    <p style={{ fontSize: 12.5, color: "#34d399" }}>Layout looks well-optimized for conversion. 🎉</p>
                                ) : (
                                    <>
                                        {(eng.suggestions || []).map((s, i) => (
                                            <div key={`s${i}`} style={{ padding: "9px 11px", borderRadius: 10, background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.16)", marginBottom: 8 }}>
                                                <div style={{ display: "flex", gap: 8 }}>
                                                    <TrendingUp size={13} style={{ color: "var(--accent-violet)", marginTop: 2, flexShrink: 0 }} />
                                                    <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45 }}>{s.label}</span>
                                                </div>
                                                {s.action === "move" && (
                                                    <button onClick={() => applyMove(s.from, s.to)} disabled={fixing} style={{ ...btn("#a855f7", "#fff"), marginTop: 9, padding: "8px" }}>
                                                        {fixing ? <Loader2 size={13} className="animate-spin" /> : <><Check size={13} /> Apply this fix{s.delta ? ` (+${Math.round(s.delta * 100)}%)` : ""}</>}
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {(eng.suggestions || []).length === 0 && (eng.opportunities || []).map((o, i) => (
                                            <div key={`o${i}`} style={{ padding: "9px 11px", borderRadius: 10, background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.16)", marginBottom: 8, display: "flex", gap: 8 }}>
                                                <TrendingUp size={13} style={{ color: "var(--accent-violet)", marginTop: 2, flexShrink: 0 }} />
                                                <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45 }}>{o}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>

                            {typeof eng.predictedConversion === "number" && (
                                <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", borderTop: "1px solid var(--border-color)", paddingTop: 10 }}>
                                    Estimated Conversion Potential: <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>{Math.round(eng.predictedConversion * 100)}%</span>
                                </div>
                            )}
                        </div>
                    )}
                </Section>

                {/* ── Design Health ── */}
                <Section icon={<ShieldCheck size={14} style={{ color: "#38bdf8" }} />} title="Design Health" defaultOpen={false}>
                    <button onClick={scanDesign} disabled={dLoading} style={btn("var(--bg-input)", "var(--accent-sky)", "1px solid rgba(56,189,248,0.3)")}>
                        {dLoading ? <><Loader2 size={14} className="animate-spin" /> Scanning…</> : <><ShieldCheck size={14} /> Scan Design</>}
                    </button>
                    {design && (
                        <div style={{ marginTop: 14 }}>
                            <Gauge100 value={design.healthScore} label="Design Health" />
                            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                                {(design.flaws || []).length === 0
                                    ? <p style={{ fontSize: 12.5, color: "#34d399" }}>No design flaws detected. 🎉</p>
                                    : (design.flaws || []).map((f, i) => (
                                        <div key={i} style={{ display: "flex", gap: 9, padding: "9px 11px", borderRadius: 10, background: "rgba(var(--fg),0.03)", border: "1px solid rgba(var(--fg),0.05)" }}>
                                            <AlertTriangle size={13} style={{ color: SEV_COLOR[f.severity], marginTop: 2, flexShrink: 0 }} />
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>{f.label}</div>
                                                <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.45, marginTop: 2 }}>{f.hint}</div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                            {(design.fixes || []).length > 0 && (
                                <button onClick={applyDesignFixes} disabled={fixing} style={{ ...btn("#0d9488", "#fff"), marginTop: 12 }}>
                                    {fixing ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} /> Auto-fix {design.fixes.length} issue{design.fixes.length > 1 ? "s" : ""}</>}
                                </button>
                            )}
                        </div>
                    )}
                </Section>

                <div style={{ padding: "14px 18px", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    AI-powered insights to help your site rank higher and convert more visitors.
                </div>
            </div>
        </div>
    );
}
