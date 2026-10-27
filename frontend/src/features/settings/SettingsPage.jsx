import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getMe, updateTenantBranding } from "../../store/slices/authSlice.js";
import api from "../../services/api.js";
import DashboardLayout from "../../layouts/DashboardLayout.jsx";
import toast from "react-hot-toast";
import {
    Palette, Users, Globe, Plus, Trash2, Shield,
    Save, Crown, Pencil, Code2, CheckCircle2, LayoutTemplate, ChevronDown,
    ExternalLink, Check, X
} from "lucide-react";
import Avatar from "../../components/Avatar.jsx";

const ROLE_COLORS = {
    OWNER: { bg: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "rgba(251,191,36,0.25)" },
    ADMIN: { bg: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "rgba(56,189,248,0.25)" },
    EDITOR: { bg: "rgba(16,185,129,0.12)", color: "#34d399", border: "rgba(16,185,129,0.25)" },
    DEVELOPER: { bg: "rgba(34,211,238,0.12)", color: "#22d3ee", border: "rgba(34,211,238,0.25)" },
};
const ROLE_ICONS = { OWNER: Crown, ADMIN: Shield, EDITOR: Pencil, DEVELOPER: Code2 };

const inputStyle = {
    width: "100%", padding: "14px 18px", borderRadius: 14,
    background: "var(--bg-input)", border: "1px solid var(--border-color)",
    color: "var(--text-primary)", fontSize: 15, outline: "none",
    transition: "all 0.2s ease", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.15)",
};

const iconBtnStyle = {
    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
    background: "var(--bg-input)", border: "1px solid var(--border-color)",
    color: "var(--text-secondary)", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
};

export default function SettingsPage() {
    const dispatch = useDispatch();
    const { user, tenant } = useSelector((s) => s.auth);
    const [activeTab, setActiveTab] = useState("branding");
    const [users, setUsers] = useState([]);
    const [domains, setDomains] = useState([]);
    const [branding, setBranding] = useState(tenant?.branding || {});
    const [inviteForm, setInviteForm] = useState({ name: "", email: "", password: "", role: "EDITOR" });
    const [newDomain, setNewDomain] = useState("");
    const [saving, setSaving] = useState(false);
    const [editingDomainId, setEditingDomainId] = useState(null);
    const [editingDomainValue, setEditingDomainValue] = useState("");

    const isOwner = user?.role === "OWNER";
    const isAdmin = ["OWNER", "ADMIN"].includes(user?.role);

    useEffect(() => {
        if (isAdmin) {
            api.get("/auth/users").then((res) => setUsers(res.data.users)).catch(console.error);
            api.get("/domains").then((res) => setDomains(res.data.domains)).catch(console.error);
        }
    }, [isAdmin]);

    const handleSaveBranding = async () => {
        setSaving(true);
        try {
            await api.put("/tenant/branding", branding);
            dispatch(updateTenantBranding(branding));
            if (branding.primaryColor) document.documentElement.style.setProperty("--color-primary", branding.primaryColor);
            if (branding.secondaryColor) document.documentElement.style.setProperty("--color-secondary", branding.secondaryColor);
            toast.success("Branding updated! ✨");
        } catch (err) { toast.error(err.response?.data?.message || "Update failed"); }
        setSaving(false);
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        try {
            await api.post("/auth/invite", inviteForm);
            toast.success(`${inviteForm.name} invited as ${inviteForm.role}`);
            setInviteForm({ name: "", email: "", password: "", role: "EDITOR" });
            const res = await api.get("/auth/users");
            setUsers(res.data.users);
        } catch (err) { toast.error(err.response?.data?.message || "Invite failed"); }
    };

    const handleRemoveUser = async (userId, name) => {
        if (!confirm(`Remove ${name} from workspace?`)) return;
        try {
            await api.delete(`/auth/users/${userId}`);
            setUsers((u) => u.filter((x) => x._id !== userId));
            toast.success("User removed");
        } catch (err) { toast.error(err.response?.data?.message || "Remove failed"); }
    };

    const handleRoleChange = async (userId, role) => {
        try {
            await api.put(`/auth/users/${userId}/role`, { role });
            setUsers((u) => u.map((x) => x._id === userId ? { ...x, role } : x));
            toast.success("Role updated");
        } catch (err) { toast.error(err.response?.data?.message || "Update failed"); }
    };

    const handleAddDomain = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post("/domains", { domain: newDomain });
            setDomains((d) => [...d, res.data.domain]);
            setNewDomain("");
            toast.success("Domain added!");
        } catch (err) { toast.error(err.response?.data?.message || "Failed to add domain"); }
    };

    const handleVerifyDomain = async (domainId) => {
        try {
            await api.post(`/domains/${domainId}/verify`);
            setDomains((d) => d.map((x) => x._id === domainId ? { ...x, verified: true } : x));
            toast.success("Domain verified!");
        } catch (err) { toast.error("Verification failed"); }
    };

    const startEditDomain = (d) => { setEditingDomainId(d._id); setEditingDomainValue(d.domain); };

    const handleRenameDomain = async (domainId) => {
        const val = editingDomainValue.trim().toLowerCase();
        if (!val) return;
        try {
            const res = await api.put(`/domains/${domainId}`, { domain: val });
            setDomains((d) => d.map((x) => x._id === domainId ? res.data.domain : x));
            setEditingDomainId(null);
            toast.success("Domain updated!");
        } catch (err) { toast.error(err.response?.data?.message || "Update failed"); }
    };

    const handleDeleteDomain = async (domainId, name) => {
        if (!confirm(`Remove ${name}? The site will no longer be reachable at this link.`)) return;
        try {
            await api.delete(`/domains/${domainId}`);
            setDomains((d) => d.filter((x) => x._id !== domainId));
            toast.success("Domain removed");
        } catch (err) { toast.error(err.response?.data?.message || "Delete failed"); }
    };

    // Live link for a domain (opens in the same app origin, e.g. http://localhost:5173/site/juices.com)
    const siteLink = (domain) => `/site/${domain}`;

    const tabs = [
        { id: "branding", label: "Workspace Details", icon: Palette },
        ...(isAdmin ? [{ id: "team", label: "Team Members", icon: Users }] : []),
        ...(isOwner ? [{ id: "domains", label: "Custom Domains", icon: Globe }] : []),
    ];

    return (
        <DashboardLayout>
            <style>{`
                @media (max-width: 720px) {
                    .settings-pad { padding: 28px 18px 48px !important; }
                    .settings-invite-form { grid-template-columns: 1fr !important; }
                }
            `}</style>
            <div className="settings-pad" style={{ maxWidth: 1600, margin: "0 auto", padding: "40px 40px 60px" }}>
                {/* Header */}
                <div style={{ marginBottom: 36 }}>
                    <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: 6 }}>Settings</h1>
                    <p style={{ fontSize: 16, color: "var(--text-secondary)" }}>Manage your workspace preferences, team, and domains.</p>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 4, borderBottom: "1px solid rgba(var(--fg),0.08)", marginBottom: 40, paddingBottom: 0 }}>
                    {tabs.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id} onClick={() => setActiveTab(id)}
                            style={{
                                display: "flex", alignItems: "center", gap: 10, padding: "14px 24px",
                                fontSize: 15, fontWeight: 700, position: "relative", cursor: "pointer",
                                color: activeTab === id ? "var(--color-primary)" : "rgba(var(--fg),0.4)",
                                background: "none", border: "none", outline: "none",
                                borderBottom: activeTab === id ? "2px solid var(--color-primary)" : "2px solid transparent",
                                transition: "all 0.15s ease",
                            }}
                        >
                            <Icon size={18} /> {label}
                        </button>
                    ))}
                </div>

                {/* ============ BRANDING TAB ============ */}
                {activeTab === "branding" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 32, maxWidth: 800, margin: "0 auto" }}>
                        {/* Workspace Info Card */}
                        <div style={{
                            background: "var(--bg-card)", border: "1px solid var(--border-color)",
                            borderRadius: 24, padding: 36, display: "flex", flexDirection: "column", justifyContent: "space-between",
                        }}>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
                                    <div style={{ padding: 10, borderRadius: 12, background: "rgba(var(--fg),0.05)", color: "white" }}>
                                        <Palette size={22} strokeWidth={2.5} />
                                    </div>
                                    <h3 style={{ fontWeight: 700, fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Workspace Identity</h3>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                                    {/* Workspace Name (read-only) */}
                                    <div style={{ paddingBottom: 24, borderBottom: "1px solid rgba(var(--fg),0.05)" }}>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.4)", marginBottom: 12 }}>Workspace Name</label>
                                        <div style={{
                                            padding: "14px 18px", borderRadius: 14, background: "var(--bg-input)",
                                            border: "1px solid var(--border-color)", color: "var(--text-primary)",
                                            fontSize: 16, fontWeight: 700,
                                        }}>
                                            {tenant?.name || "My Workspace"}
                                        </div>
                                    </div>

                                    {/* Workspace Slug (read-only) */}
                                    <div style={{ paddingBottom: 24, borderBottom: "1px solid rgba(var(--fg),0.05)" }}>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.4)", marginBottom: 12 }}>Workspace Slug</label>
                                        <div style={{
                                            padding: "14px 18px", borderRadius: 14, background: "var(--bg-input)",
                                            border: "1px solid var(--border-color)", color: "var(--text-secondary)",
                                            fontSize: 15, fontFamily: "'JetBrains Mono', monospace",
                                        }}>
                                            {tenant?.slug || "—"}
                                        </div>
                                    </div>

                                    {/* Info about component-level styling */}
                                    <div style={{
                                        padding: "20px 24px", borderRadius: 16,
                                        background: "rgba(20,184,166,0.06)",
                                        border: "1px solid rgba(20,184,166,0.22)",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                            <LayoutTemplate size={18} style={{ color: "var(--text-accent)" }} />
                                            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-accent)" }}>Per-Component Styling</span>
                                        </div>
                                        <p style={{ fontSize: 13, color: "rgba(var(--fg),0.4)", lineHeight: 1.6 }}>
                                            Colors, fonts, and styling are now configured per-component directly in the <strong style={{ color: "var(--text-primary)" }}>Website Builder</strong>.
                                            Select any section in the builder to customize its background color, text color, accent color, and font.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>


                    </div>
                )}

                {/* ============ TEAM TAB ============ */}
                {activeTab === "team" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                        {/* Invite Card */}
                        {isAdmin && (
                            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 36 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
                                    <div style={{ padding: 10, borderRadius: 12, background: "rgba(20,184,166,0.12)", color: "var(--text-accent)" }}>
                                        <Users size={22} strokeWidth={2.5} />
                                    </div>
                                    <h3 style={{ fontWeight: 700, fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Invite Member</h3>
                                </div>
                                <form onSubmit={handleInvite} className="settings-invite-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 16, alignItems: "end" }}>
                                    <div>
                                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.35)", marginBottom: 8 }}>Full Name</label>
                                        <input value={inviteForm.name} onChange={(e) => setInviteForm((p) => ({ ...p, name: e.target.value }))}
                                            placeholder="John Doe" required style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.35)", marginBottom: 8 }}>Email Address</label>
                                        <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                                            placeholder="john@example.com" required style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.35)", marginBottom: 8 }}>Password</label>
                                        <input type="password" value={inviteForm.password} onChange={(e) => setInviteForm((p) => ({ ...p, password: e.target.value }))}
                                            placeholder="••••••••" required minLength={6} style={inputStyle} />
                                    </div>
                                    <div style={{ display: "flex", gap: 10, height: 50 }}>
                                        <div style={{ position: "relative" }}>
                                            <select value={inviteForm.role} onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value }))}
                                                style={{ ...inputStyle, width: 130, height: "100%", appearance: "none", cursor: "pointer", paddingRight: 36 }}>
                                                <option value="ADMIN">ADMIN</option>
                                                <option value="EDITOR">EDITOR</option>
                                                <option value="DEVELOPER">DEVELOPER</option>
                                            </select>
                                            <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", opacity: 0.4 }}>
                                                <ChevronDown size={14} />
                                            </div>
                                        </div>
                                        <button type="submit" style={{
                                            width: 50, height: 50, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
                                            background: "var(--text-primary)", color: "var(--bg-base)", border: "none", cursor: "pointer", flexShrink: 0,
                                        }}>
                                            <Plus size={20} strokeWidth={3} />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Active Directory */}
                        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 36 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
                                <div style={{ padding: 10, borderRadius: 12, background: "rgba(var(--fg),0.05)", color: "rgba(var(--fg),0.7)" }}>
                                    <Shield size={22} strokeWidth={2.5} />
                                </div>
                                <h3 style={{ fontWeight: 700, fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                                    Active Directory <span style={{ color: "rgba(var(--fg),0.3)", fontSize: 18, marginLeft: 8 }}>({users.length})</span>
                                </h3>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {users.map((u) => {
                                    const RoleIcon = ROLE_ICONS[u.role] || Shield;
                                    const rs = ROLE_COLORS[u.role] || {};
                                    return (
                                        <div key={u._id} style={{
                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                            padding: "16px 20px", borderRadius: 16, background: "rgba(var(--fg),0.02)",
                                            border: "1px solid transparent", transition: "all 0.15s ease",
                                        }}
                                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(var(--fg),0.04)"; e.currentTarget.style.borderColor = "rgba(var(--fg),0.06)"; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(var(--fg),0.02)"; e.currentTarget.style.borderColor = "transparent"; }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                                <Avatar user={u} size={48} />
                                                <div>
                                                    <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{u.name}</p>
                                                    <p style={{ fontSize: 14, color: "rgba(var(--fg),0.4)", marginTop: 2 }}>{u.email}</p>
                                                </div>
                                            </div>

                                            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                                <span style={{
                                                    display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700,
                                                    textTransform: "uppercase", letterSpacing: "0.06em",
                                                    padding: "6px 14px", borderRadius: 100,
                                                    background: rs.bg, color: rs.color, border: `1px solid ${rs.border}`,
                                                }}>
                                                    <RoleIcon size={12} strokeWidth={3} /> {u.role}
                                                </span>

                                                {isOwner && u.role !== "OWNER" && (
                                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                        <div style={{ position: "relative" }}>
                                                            <select value={u.role} onChange={(e) => handleRoleChange(u._id, e.target.value)}
                                                                style={{ fontSize: 13, fontWeight: 700, padding: "10px 32px 10px 14px", borderRadius: 12, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", cursor: "pointer", outline: "none", appearance: "none" }}>
                                                                <option value="ADMIN">ADMIN</option>
                                                                <option value="EDITOR">EDITOR</option>
                                                                <option value="DEVELOPER">DEVELOPER</option>
                                                            </select>
                                                            <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", opacity: 0.4 }}>
                                                                <ChevronDown size={12} />
                                                            </div>
                                                        </div>
                                                        <button onClick={() => handleRemoveUser(u._id, u.name)} style={{
                                                            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                                                            borderRadius: 12, color: "#f87171", cursor: "pointer", padding: 10, display: "flex",
                                                        }}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ============ DOMAINS TAB ============ */}
                {activeTab === "domains" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                        {/* Add Domain */}
                        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 36 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
                                <div style={{ padding: 10, borderRadius: 12, background: "rgba(16,185,129,0.12)", color: "#34d399" }}>
                                    <Globe size={22} strokeWidth={2.5} />
                                </div>
                                <h3 style={{ fontWeight: 700, fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Connectivity</h3>
                            </div>
                            <form onSubmit={handleAddDomain} style={{ display: "flex", gap: 16, alignItems: "end" }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.35)", marginBottom: 8 }}>Connect Custom Domain</label>
                                    <input value={newDomain} onChange={(e) => setNewDomain(e.target.value)}
                                        placeholder="www.yourstartup.com" required style={inputStyle} />
                                </div>
                                <button type="submit" style={{
                                    height: 50, padding: "0 28px", borderRadius: 14,
                                    background: "var(--text-primary)", color: "var(--bg-base)", border: "none",
                                    cursor: "pointer", fontWeight: 700, fontSize: 15, flexShrink: 0,
                                }}>
                                    Add Domain
                                </button>
                            </form>
                        </div>

                        {/* Domains List */}
                        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 36 }}>
                            <h3 style={{ fontWeight: 700, fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 24 }}>Active Domains</h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {domains.map((d) => {
                                    const editing = editingDomainId === d._id;
                                    return (
                                    <div key={d._id} className="domain-row" style={{
                                        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
                                        padding: "16px 20px", borderRadius: 16, background: "rgba(var(--fg),0.02)",
                                        border: "1px solid transparent", transition: "all 0.15s ease",
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(var(--fg),0.04)"; e.currentTarget.style.borderColor = "rgba(var(--fg),0.06)"; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(var(--fg),0.02)"; e.currentTarget.style.borderColor = "transparent"; }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: 1 }}>
                                            <div style={{ padding: 10, borderRadius: 12, flexShrink: 0, background: d.verified ? "rgba(16,185,129,0.08)" : "rgba(var(--fg),0.04)" }}>
                                                <Globe size={20} style={{ color: d.verified ? "#10b981" : "var(--text-muted)" }} />
                                            </div>
                                            {editing ? (
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                                                    <input value={editingDomainValue} autoFocus
                                                        onChange={(e) => setEditingDomainValue(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === "Enter") handleRenameDomain(d._id); if (e.key === "Escape") setEditingDomainId(null); }}
                                                        style={{ ...inputStyle, fontFamily: "monospace", padding: "10px 14px", maxWidth: 320 }} />
                                                    <button onClick={() => handleRenameDomain(d._id)} title="Save" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: "var(--grad-btn)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={16} strokeWidth={2.5} /></button>
                                                    <button onClick={() => setEditingDomainId(null)} title="Cancel" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-color)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
                                                </div>
                                            ) : (
                                                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                                    <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.domain}</span>
                                                    {d.isDefault && (
                                                        <span style={{ background: "rgba(var(--fg),0.08)", fontSize: 10, textTransform: "uppercase", fontWeight: 700, padding: "3px 8px", borderRadius: 100, color: "rgba(var(--fg),0.5)", flexShrink: 0 }}>Primary</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {!editing && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <span style={{
                                                display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700,
                                                textTransform: "uppercase", letterSpacing: "0.06em", padding: "6px 14px", borderRadius: 100,
                                                background: d.verified ? "rgba(16,185,129,0.12)" : "rgba(251,191,36,0.12)",
                                                color: d.verified ? "#10b981" : "#fbbf24",
                                                border: `1px solid ${d.verified ? "rgba(16,185,129,0.25)" : "rgba(251,191,36,0.25)"}`,
                                            }}>
                                                {d.verified && <CheckCircle2 size={13} />}
                                                {d.verified ? "Verified" : "Pending Setup"}
                                            </span>
                                            {!d.verified && !d.isDefault && (
                                                <button onClick={() => handleVerifyDomain(d._id)} style={{ fontSize: 14, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Verify Now</button>
                                            )}
                                            {/* Open the live site at this link */}
                                            <a href={siteLink(d.domain)} target="_blank" rel="noreferrer" title="Open live site" style={iconBtnStyle}>
                                                <ExternalLink size={16} />
                                            </a>
                                            {!d.isDefault && (
                                                <button onClick={() => startEditDomain(d)} title="Rename domain" style={iconBtnStyle}>
                                                    <Pencil size={15} />
                                                </button>
                                            )}
                                            {!d.isDefault && (
                                                <button onClick={() => handleDeleteDomain(d._id, d.domain)} title="Remove domain" style={{ ...iconBtnStyle, color: "#f87171" }}>
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                        )}
                                    </div>
                                    );
                                })}
                                {domains.length === 0 && (
                                    <div style={{ textAlign: "center", padding: "48px 0" }}>
                                        <Globe size={40} style={{ color: "rgba(var(--fg),0.15)", margin: "0 auto 16px" }} />
                                        <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(var(--fg),0.3)" }}>No custom domains configured.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
