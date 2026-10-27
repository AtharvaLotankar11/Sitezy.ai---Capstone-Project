import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { fetchWebsites, createWebsite, updateWebsite, deleteWebsite, publishWebsite } from "../../store/slices/websiteSlice.js";
import DashboardLayout from "../../layouts/DashboardLayout.jsx";
import toast from "react-hot-toast";
import {
    Plus, Pencil, Trash2, Rocket, ExternalLink,
    CheckCircle, Clock, X, Loader2, Link as LinkIcon, FolderDot,
    LayoutTemplate, Zap, ArrowRight, BarChart2, SquarePen, Check, Wand2, Settings, Inbox, Code2
} from "lucide-react";
import { TEMPLATES } from "../../utils/templates.js";
import api from "../../services/api.js";
import { exportSiteZip } from "../../utils/exportSite.jsx";
import PublishModal from "../builder/PublishModal.jsx";
import FormSubmissionsModal from "../../components/FormSubmissionsModal.jsx";

const inputStyle = {
    width: "100%", padding: "14px 18px", borderRadius: 14,
    background: "var(--bg-input)", border: "1px solid var(--border-color)",
    color: "var(--text-primary)", fontSize: 15, outline: "none",
    transition: "all 0.2s ease", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.15)",
};

// ─── Project card preview banner ────────────────────────────────────────────────
// Gives every project a distinct, colorful header (a mini wireframe over a tinted
// gradient) so the grid reads like the template gallery — not a wall of black + green.
const CARD_THEMES = [
    { a: "#38bdf8", b: "#0ea5e9" }, // sky
    { a: "#fbbf24", b: "#f59e0b" }, // amber
    { a: "#818cf8", b: "#6366f1" }, // indigo
    { a: "#34d399", b: "#10b981" }, // emerald
    { a: "var(--accent-violet)", b: "#a855f7" }, // violet
    { a: "#22d3ee", b: "#06b6d4" }, // cyan
    { a: "#fb923c", b: "#ea580c" }, // orange
    { a: "#f472b6", b: "#ec4899" }, // pink
    { a: "#f87171", b: "#ef4444" }, // red
    { a: "#a3e635", b: "#84cc16" }, // lime
];
function cardHash(s) { let h = 0; for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

const CardThumb = ({ site }) => {
    const h = cardHash(site?._id || site?.name || "x");
    const { a, b } = CARD_THEMES[h % CARD_THEMES.length];
    const variant = h % 3;
    const bar = (w, c, ht = 8) => ({ height: ht, width: w, borderRadius: 4, background: c });
    return (
        <div style={{ height: 122, position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${a}30 0%, var(--thumb-base) 62%)`, borderBottom: "1px solid var(--glass-border)" }}>
            <div style={{ position: "absolute", top: -38, right: -28, width: 156, height: 156, borderRadius: "50%", background: a, opacity: 0.3, filter: "blur(42px)", pointerEvents: "none" }} />
            {/* faux browser dots */}
            <div style={{ position: "absolute", top: 14, left: 16, display: "flex", gap: 6 }}>
                {[0, 1, 2].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(var(--fg),0.32)" }} />)}
            </div>
            {/* mini wireframe — varies by hash so cards don't all look identical */}
            <div style={{ position: "absolute", left: 18, right: 18, top: 42 }}>
                {variant === 0 && (
                    <>
                        <div style={{ ...bar("48%", "rgba(var(--fg),0.5)", 9), marginBottom: 11 }} />
                        <div style={{ display: "flex", gap: 8 }}>
                            <div style={{ height: 32, flex: 1, borderRadius: 8, background: `linear-gradient(135deg, ${a}, ${b})` }} />
                            <div style={{ height: 32, flex: 1, borderRadius: 8, background: "rgba(var(--fg),0.1)" }} />
                            <div style={{ height: 32, flex: 1, borderRadius: 8, background: "rgba(var(--fg),0.06)" }} />
                        </div>
                    </>
                )}
                {variant === 1 && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                        <div style={bar("62%", "rgba(var(--fg),0.5)", 9)} />
                        <div style={bar("42%", "rgba(var(--fg),0.2)", 6)} />
                        <div style={{ height: 16, width: 70, borderRadius: 8, background: `linear-gradient(135deg, ${a}, ${b})`, marginTop: 5 }} />
                    </div>
                )}
                {variant === 2 && (
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, paddingTop: 3 }}>
                            <div style={bar("85%", "rgba(var(--fg),0.5)", 8)} />
                            <div style={bar("60%", `linear-gradient(90deg, ${a}, ${b})`, 7)} />
                            <div style={bar("48%", "rgba(var(--fg),0.14)", 6)} />
                        </div>
                        <div style={{ width: 58, height: 48, borderRadius: 9, background: `linear-gradient(135deg, ${a}, ${b})`, flexShrink: 0 }} />
                    </div>
                )}
            </div>
        </div>
    );
};


const UpgradeModal = ({ message, onClose }) => {
    const navigate = useNavigate();

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)",
        }}>
            <div style={{
                width: "100%", maxWidth: 460, padding: "32px", borderRadius: 24,
                background: "var(--bg-card)", border: "1px solid rgba(var(--fg),0.1)",
                boxShadow: "0 24px 48px rgba(0,0,0,0.5)", position: "relative",
            }}>
                <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, padding: 6, borderRadius: "50%", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                    <X size={18} />
                </button>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(245, 158, 11, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                    <Zap size={28} style={{ color: "#f59e0b" }} strokeWidth={2.5} />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 12 }}>Plan Limit Reached</h2>
                <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 32 }}>
                    {message || "You've reached the maximum number of active projects allowed on your current plan. Upgrade to build more sites without limits."}
                </p>
                <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={onClose} className="sz-btn-soft" style={{
                        flex: 1, padding: "14px", borderRadius: 14, color: "var(--text-primary)", fontSize: 15, fontWeight: 600, fontFamily: "var(--font-display)",
                    }}>Cancel</button>
                    <button onClick={() => navigate("/subscription")} className="saas-button" style={{
                        flex: 1.5, padding: "14px", borderRadius: 14, fontSize: 15,
                    }}>
                        Upgrade Plan <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const CreateWebsiteModal = ({ onClose, onCreate }) => {
    const [data, setData] = useState({ name: "", description: "", template: TEMPLATES[0].sections, theme: TEMPLATES[0].themeSelected });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        await onCreate(data);
        setLoading(false);
        onClose();
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)",
        }}>
            <div style={{
                width: "100%", maxWidth: 480, padding: "24px 28px", borderRadius: 20,
                background: "var(--bg-card)", border: "1px solid rgba(var(--fg),0.1)",
                boxShadow: "0 24px 48px rgba(0,0,0,0.5)", position: "relative",
            }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                            <div style={{ padding: 8, borderRadius: 10, background: "rgba(var(--fg),0.05)", color: "rgba(var(--fg),0.8)" }}>
                                <FolderDot size={20} strokeWidth={2.5} />
                            </div>
                            <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>New Project</h2>
                        </div>
                        <p style={{ fontSize: 13, color: "rgba(var(--fg),0.4)", paddingLeft: 42 }}>Create a new website project</p>
                    </div>
                    <button onClick={onClose} style={{ padding: 6, borderRadius: "50%", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.4)", marginBottom: 6 }}>Project Name *</label>
                        <input value={data.name} onChange={(e) => setData((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. My Awesome Startup" required autoFocus style={{ ...inputStyle, padding: "12px 16px" }} />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.4)", marginBottom: 6 }}>Description</label>
                        <textarea value={data.description} onChange={(e) => setData((p) => ({ ...p, description: e.target.value }))} placeholder="What is this website about?" rows={2} style={{ ...inputStyle, resize: "none", padding: "12px 16px" }} />
                    </div>

                    <div style={{ marginBottom: 24, display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12, background: "rgba(20,184,166,0.07)", border: "1px solid rgba(20,184,166,0.22)" }}>
                        <Zap size={15} style={{ color: "var(--text-accent)", marginTop: 1, flexShrink: 0 }} strokeWidth={2.5} />
                        <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                            You'll pick a template and generate content with AI in the <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>AI Playground</strong> right after creating your project.
                        </span>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <button type="button" onClick={onClose} className="sz-btn-soft" style={{
                            flex: 1, padding: 12, borderRadius: 12, color: "var(--text-primary)", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)",
                        }}>Cancel</button>
                        <button type="submit" disabled={loading} className="saas-button" style={{
                            flex: 2, padding: 12, fontSize: 14, opacity: loading ? 0.7 : 1,
                        }}>
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} strokeWidth={2.5} /> Create Project</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Rename a project / edit its description.
const EditDetailsModal = ({ site, onClose, onSave }) => {
    const [name, setName] = useState(site.name || "");
    const [description, setDescription] = useState(site.description || "");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (name.trim().length < 1) return;
        setLoading(true);
        await onSave(site._id, { name: name.trim(), description: description.trim() });
        setLoading(false);
        onClose();
    };

    return (
        <div onClick={onClose} style={{
            position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        }}>
            <div onClick={(e) => e.stopPropagation()} style={{
                width: "100%", maxWidth: 480, padding: "24px 28px", borderRadius: 20,
                background: "var(--bg-card)", border: "1px solid rgba(var(--fg),0.1)",
                boxShadow: "0 24px 48px rgba(0,0,0,0.5)", position: "relative",
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ padding: 8, borderRadius: 10, background: "rgba(var(--fg),0.05)", color: "rgba(var(--fg),0.8)" }}>
                            <SquarePen size={20} strokeWidth={2.5} />
                        </div>
                        <h2 className="font-display" style={{ fontSize: 21, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Edit Project Details</h2>
                    </div>
                    <button onClick={onClose} style={{ padding: 6, borderRadius: "50%", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
                </div>
                <form onSubmit={submit}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.4)", marginBottom: 6 }}>Project Name</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus style={{ ...inputStyle, padding: "12px 16px" }} />
                    </div>
                    <div style={{ marginBottom: 22 }}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.4)", marginBottom: 6 }}>Description</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this website about?" rows={3} style={{ ...inputStyle, resize: "none", padding: "12px 16px" }} />
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <button type="button" onClick={onClose} className="sz-btn-soft" style={{ flex: 1, padding: 12, borderRadius: 12, color: "var(--text-primary)", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)" }}>Cancel</button>
                        <button type="submit" disabled={loading} className="saas-button" style={{ flex: 2, padding: 12, fontSize: 14, opacity: loading ? 0.7 : 1 }}>
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} strokeWidth={2.5} /> Save Changes</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function WebsitesPage() {
    const dispatch = useDispatch();
    const { websites, loading } = useSelector((s) => s.website);
    const { user, tenant } = useSelector((s) => s.auth);
    const [showCreate, setShowCreate] = useState(false);
    const [publishingSiteId, setPublishingSiteId] = useState(null);
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [upgradeMessage, setUpgradeMessage] = useState("");
    const [editSite, setEditSite] = useState(null);
    const [submissionsSite, setSubmissionsSite] = useState(null);
    const [exportingId, setExportingId] = useState(null);

    const handleExport = async (site) => {
        setExportingId(site._id);
        const t = toast.loading("Packaging your site…");
        try {
            // Pull the live pages and render them with the SAME components as the preview,
            // so the download is an exact copy of what you see in the editor.
            const { data } = await api.get(`/builder/websites/${site._id}/pages`);
            const pages = data.pages || [];
            if (!pages.length) { toast.error("This project has no pages to export yet.", { id: t }); return; }
            exportSiteZip(site, tenant?.branding || {}, pages);
            toast.success("Code exported — an exact copy of your site ✓", { id: t });
        } catch {
            toast.error("Export failed.", { id: t });
        } finally {
            setExportingId(null);
        }
    };

    const canCreate = ["OWNER", "ADMIN"].includes(user?.role);
    const canViewSubmissions = ["OWNER", "ADMIN"].includes(user?.role);
    const canPublish = ["OWNER", "ADMIN"].includes(user?.role);
    const canDelete = ["OWNER", "ADMIN"].includes(user?.role);
    const canEdit = ["OWNER", "ADMIN", "EDITOR"].includes(user?.role);

    const handleUpdateDetails = async (id, data) => {
        const res = await dispatch(updateWebsite({ id, data }));
        if (updateWebsite.fulfilled.match(res)) toast.success("Project updated");
        else toast.error(res.payload || "Update failed");
    };

    useEffect(() => { dispatch(fetchWebsites()); }, [dispatch]);

    const handleCreate = async (data) => {
        const res = await dispatch(createWebsite(data));
        if (createWebsite.fulfilled.match(res)) {
            toast.success("Project created! 🎉");
            setShowCreate(false);
        } else {
            const errorMsg = res.payload || "Failed to create project";
            if (errorMsg.toLowerCase().includes("limit") || errorMsg.toLowerCase().includes("upgrade")) {
                setUpgradeMessage(errorMsg);
                setShowUpgrade(true);
                setShowCreate(false); // Close the creation modal
            } else {
                toast.error(errorMsg);
            }
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
        const res = await dispatch(deleteWebsite(id));
        if (deleteWebsite.fulfilled.match(res)) toast.success("Project deleted");
        else toast.error("Delete failed");
    };

    const handlePublishClick = (id) => {
        setPublishingSiteId(id);
    };

    return (
        <DashboardLayout>
            <style>{`
                .wp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 26px; }
                @media (max-width: 1180px){ .wp-grid { grid-template-columns: repeat(2, 1fr); } }
                @media (max-width: 720px){ .wp-pad{ padding: 28px 18px 48px !important; } .wp-pad h1{ font-size: 30px !important; } }
                @media (max-width: 680px){ .wp-grid { grid-template-columns: 1fr; } }
            `}</style>
            <div className="wp-pad" style={{ maxWidth: 1600, margin: "0 auto", padding: "40px 40px 60px" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 20, marginBottom: 40 }}>
                    <div>
                        <h1 className="font-display" style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 6 }}>Projects</h1>
                        <p style={{ fontSize: 16, color: "var(--text-secondary)" }}>
                            You have <span style={{ fontWeight: 700, color: "var(--text-accent)" }}>{websites.length}</span> active project{websites.length !== 1 ? "s" : ""} in this workspace.
                        </p>
                    </div>
                    {/* Primary workspace actions — AI Playground + Settings live here now (not the navbar) */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <Link to="/ai" className="sz-btn-soft" style={{
                            display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 100,
                            textDecoration: "none", color: "var(--text-primary)", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)",
                        }}>
                            <Wand2 size={16} /> AI Playground
                        </Link>
                        <Link to="/settings" className="sz-btn-soft" style={{
                            display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 100,
                            textDecoration: "none", color: "var(--text-primary)", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)",
                        }}>
                            <Settings size={16} /> Settings
                        </Link>
                        {canCreate && (
                            <button onClick={() => setShowCreate(true)} className="saas-button" style={{ padding: "13px 26px", fontSize: 15 }}>
                                <Plus size={18} strokeWidth={2.5} /> New Project
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="wp-grid">
                        {[...Array(3)].map((_, i) => <div key={i} className="shimmer" style={{ height: 320, borderRadius: 24 }} />)}
                    </div>
                ) : websites.length === 0 ? (
                    <div style={{
                        background: "var(--bg-card)", border: "1px dashed rgba(var(--fg),0.15)",
                        borderRadius: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        padding: "80px 20px", textAlign: "center",
                    }}>
                        <div style={{ padding: 24, borderRadius: "50%", background: "rgba(var(--fg),0.04)", marginBottom: 24 }}>
                            <FolderDot size={56} strokeWidth={1.5} style={{ color: "rgba(var(--fg),0.15)" }} />
                        </div>
                        <h3 className="font-display" style={{ fontSize: 24, fontWeight: 600, marginBottom: 12, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>No Projects Found</h3>
                        <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 360, lineHeight: 1.6, marginBottom: 32 }}>
                            Your workspace is empty. Create your first project to start building your website.
                        </p>
                        {canCreate && (
                            <button onClick={() => setShowCreate(true)} className="saas-button" style={{ padding: "15px 30px", fontSize: 16 }}>
                                <Plus size={20} strokeWidth={3} /> Create Project
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="wp-grid">
                        {websites.map((site) => {
                            const isLive = site.status === "published";
                            return (
                            <div key={site._id} className="glass-card" style={{
                                borderRadius: 22, padding: 0, display: "flex", flexDirection: "column",
                                transition: "transform 0.35s var(--ease-spring), border-color 0.35s ease, box-shadow 0.35s ease", position: "relative", overflow: "hidden",
                            }}
                                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.borderColor = "rgba(45,212,191,0.4)"; e.currentTarget.style.boxShadow = "var(--shadow-elevated)"; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "var(--glass-border)"; e.currentTarget.style.boxShadow = "var(--shadow-glass)"; }}
                            >
                                {/* Preview banner */}
                                <CardThumb site={site} />
                                {/* Status + open overlaid on banner */}
                                <div style={{ position: "absolute", top: 13, right: 13, display: "flex", alignItems: "center", gap: 8, zIndex: 2 }}>
                                    <span style={{
                                        fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
                                        padding: "5px 11px", borderRadius: 100, fontWeight: 700,
                                        display: "flex", alignItems: "center", gap: 5,
                                        background: isLive ? "rgba(6,18,14,0.7)" : "rgba(6,14,22,0.7)",
                                        backdropFilter: "blur(8px)",
                                        color: isLive ? "#34d399" : "var(--accent-sky)",
                                        border: `1px solid ${isLive ? "rgba(16,185,129,0.4)" : "rgba(56,189,248,0.4)"}`,
                                    }}>
                                        {isLive ? <CheckCircle size={10} strokeWidth={3} /> : <Clock size={10} strokeWidth={3} />}
                                        {isLive ? "Live" : "Draft"}
                                    </span>
                                    {isLive && (
                                        <a href={`/site/${site.defaultDomain || site.slug || tenant?.slug}`} target="_blank" rel="noreferrer" title="Open live site"
                                            style={{ width: 30, height: 30, borderRadius: "50%", color: "#fff", background: "rgba(6,12,20,0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(var(--fg),0.18)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                                            <ExternalLink size={13} />
                                        </a>
                                    )}
                                </div>

                                {/* Body */}
                                <div style={{ flex: 1, padding: "20px 22px 0", display: "flex", flexDirection: "column", position: "relative" }}>
                                    {/* Title + Export code */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                                        <h3 className="font-display" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                                            {site.name}
                                        </h3>
                                        <button onClick={() => handleExport(site)} disabled={exportingId === site._id} title="Export the working frontend code (.zip)" className="sz-btn-soft" style={{
                                            display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 100, flexShrink: 0,
                                            cursor: exportingId === site._id ? "wait" : "pointer", color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)",
                                        }}>
                                            {exportingId === site._id ? <Loader2 size={13} className="animate-spin" /> : <Code2 size={13} strokeWidth={2.5} />} Export
                                        </button>
                                    </div>
                                    <p style={{ fontSize: 13.5, color: site.description ? "var(--text-secondary)" : "var(--text-muted)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontStyle: site.description ? "normal" : "italic", opacity: site.description ? 1 : 0.6 }}>
                                        {site.description || "No description provided."}
                                    </p>

                                    {/* push footer down so card bottoms align */}
                                    <div style={{ flex: 1, minHeight: 18 }} />

                                    {/* Footer meta */}
                                    <div style={{ paddingTop: 16, borderTop: "1px solid var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                        <span className="font-mono" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--text-muted)", minWidth: 0 }}>
                                            <LinkIcon size={12} style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{site.defaultDomain || `${site.slug || "draft"}.sitezy.ai`}</span>
                                        </span>
                                        <span title={`Created by ${site.createdBy?.name || "You"}`} style={{ display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                                            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(var(--fg),0.08)", border: "1px solid var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>
                                                {(site.createdBy?.name || "Y")[0].toUpperCase()}
                                            </div>
                                            <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{site.createdBy?.name || "You"}</span>
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "18px 22px 22px", flexWrap: "wrap" }}>
                                    <Link to={`/websites/${site._id}/builder`} className="sz-btn-soft" style={{
                                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                                        height: 42, borderRadius: 100, textDecoration: "none", whiteSpace: "nowrap",
                                        color: "var(--text-primary)", fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-display)",
                                    }}>
                                        <Pencil size={14} strokeWidth={2.5} /> Edit
                                    </Link>
                                    {canPublish && (
                                        <button onClick={() => handlePublishClick(site._id)} className="sz-btn-emerald" style={{
                                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                                            height: 42, borderRadius: 100, cursor: "pointer", whiteSpace: "nowrap", padding: 0,
                                            color: "#fff", fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-display)",
                                        }}>
                                            <Rocket size={14} strokeWidth={2.5} /> {isLive ? "Update" : "Deploy"}
                                        </button>
                                    )}
                                    {canEdit && (
                                        <button onClick={() => setEditSite(site)} title="Rename / edit details" className="sz-btn-soft" style={{
                                            width: 42, height: 42, borderRadius: "50%", cursor: "pointer", padding: 0,
                                            color: "var(--text-secondary)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                        }}>
                                            <SquarePen size={15} strokeWidth={2.5} />
                                        </button>
                                    )}
                                    {canViewSubmissions && (
                                        <button onClick={() => setSubmissionsSite(site)} title="Form submissions" className="sz-btn-soft" style={{
                                            width: 42, height: 42, borderRadius: "50%", cursor: "pointer", padding: 0,
                                            color: "var(--text-secondary)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                        }}>
                                            <Inbox size={15} strokeWidth={2.5} />
                                        </button>
                                    )}
                                    <Link to={`/websites/${site._id}/analytics`} title="Analytics" className="sz-btn-soft sz-btn-icon-amber" style={{
                                        width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                                        color: "var(--text-secondary)", flexShrink: 0, padding: 0,
                                    }}>
                                        <BarChart2 size={15} strokeWidth={2.5} />
                                    </Link>
                                    {canDelete && (
                                        <button onClick={() => handleDelete(site._id, site.name)} title="Delete" className="sz-btn-soft sz-btn-icon-red" style={{
                                            width: 42, height: 42, borderRadius: "50%", cursor: "pointer", padding: 0,
                                            color: "var(--text-secondary)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                        }}>
                                            <Trash2 size={15} strokeWidth={2.5} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showCreate && <CreateWebsiteModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
            {editSite && <EditDetailsModal site={editSite} onClose={() => setEditSite(null)} onSave={handleUpdateDetails} />}
            {submissionsSite && <FormSubmissionsModal websiteId={submissionsSite._id} title={`${submissionsSite.name} — Submissions`} onClose={() => setSubmissionsSite(null)} />}
            {publishingSiteId && <PublishModal websiteId={publishingSiteId} onClose={() => setPublishingSiteId(null)} />}
            {showUpgrade && <UpgradeModal message={upgradeMessage} onClose={() => setShowUpgrade(false)} />}
        </DashboardLayout>
    );
}
