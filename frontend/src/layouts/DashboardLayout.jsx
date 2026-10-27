import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout, updateProfile } from "../store/slices/authSlice.js";
import {
    LayoutDashboard, Globe, Wand2, Settings, LogOut,
    Menu, X, Zap, CreditCard, Crown, Sparkles, Rocket,
    ChevronDown, UserPen, Check, Loader2
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api.js";
import Logo from "../components/Logo.jsx";
import Avatar from "../components/Avatar.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import HelpAssistant from "../components/HelpAssistant.jsx";
import { AVATAR_KEYS, avatarSrc } from "../utils/avatars.js";

// AI Playground & Settings intentionally live on the Projects page header (not here).
const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Projects", icon: Globe, path: "/websites" },
    { label: "Subscription", icon: CreditCard, path: "/subscription" },
];

const menuRowStyle = {
    display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "10px 12px", borderRadius: 10,
    background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
    fontSize: 14, fontWeight: 500, fontFamily: "var(--font-display)", color: "var(--text-primary)",
    transition: "background 0.15s ease",
};

// Edit-profile modal: rename + pick one of the four illustrated avatars.
function EditProfileModal({ user, onClose }) {
    const dispatch = useDispatch();
    const [name, setName] = useState(user?.name || "");
    const [avatar, setAvatar] = useState(user?.avatar || AVATAR_KEYS[0]);
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (name.trim().length < 2) { toast.error("Name must be at least 2 characters"); return; }
        setSaving(true);
        const res = await dispatch(updateProfile({ name: name.trim(), avatar }));
        setSaving(false);
        if (updateProfile.fulfilled.match(res)) { toast.success("Profile updated"); onClose(); }
        else toast.error(res.payload || "Update failed");
    };

    return createPortal(
        <div onClick={onClose} style={{
            position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, background: "rgba(0,0,0,0.74)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        }}>
            <div onClick={(e) => e.stopPropagation()} style={{
                width: "100%", maxWidth: 440, padding: "26px 28px", borderRadius: 22,
                background: "var(--bg-card)", border: "1px solid rgba(var(--fg),0.12)", boxShadow: "0 24px 60px rgba(0,0,0,0.55)", position: "relative",
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                    <h2 className="font-display" style={{ fontSize: 21, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Edit Profile</h2>
                    <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
                </div>

                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.4)", marginBottom: 8 }}>Display Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus style={{
                    width: "100%", padding: "13px 16px", borderRadius: 13, background: "var(--bg-input)",
                    border: "1px solid var(--border-color)", color: "var(--text-primary)", fontSize: 15, outline: "none", marginBottom: 22,
                }} />

                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.4)", marginBottom: 12 }}>Choose Avatar</label>
                <div style={{ display: "flex", gap: 14, marginBottom: 26 }}>
                    {AVATAR_KEYS.map((key) => {
                        const active = avatar === key;
                        return (
                            <button key={key} onClick={() => setAvatar(key)} style={{
                                position: "relative", width: 62, height: 62, borderRadius: "50%", cursor: "pointer", padding: 0,
                                background: "var(--bg-input)", overflow: "hidden",
                                border: active ? "2px solid var(--color-primary)" : "2px solid var(--border-color)",
                                boxShadow: active ? "0 0 0 4px rgba(20,184,166,0.18)" : "none", transition: "all 0.15s ease",
                            }}>
                                <img src={avatarSrc(key)} alt={key} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                {active && (
                                    <span style={{ position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: "50%", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--bg-card)" }}>
                                        <Check size={11} color="#fff" strokeWidth={3.5} />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={onClose} className="sz-btn-soft" style={{ flex: 1, padding: 12, borderRadius: 12, color: "var(--text-primary)", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)" }}>Cancel</button>
                    <button onClick={save} disabled={saving} className="saas-button" style={{ flex: 2, padding: 12, fontSize: 14, opacity: saving ? 0.7 : 1 }}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} strokeWidth={2.5} /> Save Changes</>}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default function DashboardLayout({ children }) {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user, tenant } = useSelector((s) => s.auth);
    const [planType, setPlanType] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);

    useEffect(() => {
        const fetchPlan = async () => {
            try {
                const res = await api.get("/payment/subscription");
                setPlanType(res.data.data?.subscription?.planType || "FREE");
            } catch {
                setPlanType("FREE");
            }
        };
        if (user) fetchPlan();

        window.addEventListener("planUpdated", fetchPlan);
        return () => window.removeEventListener("planUpdated", fetchPlan);
    }, [user]);

    const handleLogout = () => {
        dispatch(logout());
        toast.success("Logged out successfully");
        navigate("/login");
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-base)" }}>
            <style>{`
              .dl-burger { display: none; }
              @media (max-width: 980px) { .dl-chip { display: none !important; } }
              @media (max-width: 880px) {
                .dl-header { padding: 0 16px !important; }
                .dl-nav { display: none !important; }
                .dl-burger { display: flex !important; }
              }
              @media (max-width: 560px) { .dl-username { display: none !important; } }
            `}</style>
            {/* Top Navigation */}
            <header className="dl-header" style={{
                height: 68,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 40px",
                background: "var(--glass-bg-strong)",
                backdropFilter: "blur(20px) saturate(1.6)",
                WebkitBackdropFilter: "blur(20px) saturate(1.6)",
                borderBottom: "1px solid var(--border-color)",
                position: "sticky",
                top: 0,
                zIndex: 50,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
                    {/* Logo & Tenant */}
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <Link to="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                            <Logo size={32} fontSize={18} wordColor="var(--text-primary)" />
                        </Link>

                        {tenant && (
                            <>
                                <div className="dl-chip" style={{ width: 1, height: 24, background: "var(--border-color)" }} />
                                <div className="dl-chip" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8, background: "rgba(var(--fg),0.03)", border: "1px solid var(--border-color)" }}>
                                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-primary)" }} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{tenant.name}</span>
                                </div>
                            </>
                        )}

                        {planType && (
                            <Link to="/subscription" className="dl-chip" style={{ textDecoration: "none" }}>
                                <div style={{
                                    display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 100,
                                    background: planType === "PRO" ? "rgba(56, 189, 248, 0.15)" :
                                        planType === "ENTERPRISE" ? "rgba(251, 191, 36, 0.15)" :
                                            planType === "BASIC" ? "rgba(20, 184, 166, 0.15)" : "rgba(var(--fg),0.05)",
                                    border: `1px solid ${planType === "PRO" ? "rgba(56, 189, 248, 0.32)" :
                                        planType === "ENTERPRISE" ? "rgba(251, 191, 36, 0.32)" :
                                            planType === "BASIC" ? "rgba(20, 184, 166, 0.32)" : "var(--border-color)"}`,
                                    color: planType === "PRO" ? "#38bdf8" :
                                        planType === "ENTERPRISE" ? "#fbbf24" :
                                            planType === "BASIC" ? "var(--text-accent)" : "var(--text-secondary)",
                                    fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                                }}>
                                    {planType === "PRO" ? <Crown size={12} /> : planType === "ENTERPRISE" ? <Rocket size={12} /> : <Sparkles size={12} />}
                                    {planType}
                                </div>
                            </Link>
                        )}
                    </div>

                    {/* Nav Links */}
                    <nav className="dl-nav" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {navItems.map(({ label, path }) => {
                            const active = location.pathname.startsWith(path);
                            return (
                                <Link key={path} to={path} style={{
                                    padding: "8px 16px",
                                    borderRadius: 100,
                                    textDecoration: "none",
                                    fontFamily: "var(--font-display)",
                                    fontSize: 14,
                                    fontWeight: active ? 600 : 500,
                                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                                    background: active ? "rgba(var(--fg),0.08)" : "transparent",
                                    border: active ? "1px solid rgba(var(--fg),0.14)" : "1px solid transparent",
                                    transition: "all 0.15s ease",
                                }}
                                    onMouseEnter={e => { if (!active) e.currentTarget.style.color = "var(--text-primary)"; }}
                                    onMouseLeave={e => { if (!active) e.currentTarget.style.color = "var(--text-secondary)"; }}>
                                    {label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Right: User Menu */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button className="dl-burger" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu" style={{
                        width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center",
                        background: "rgba(var(--fg),0.05)", border: "1px solid var(--border-color)", color: "var(--text-primary)", cursor: "pointer",
                    }}>
                        {menuOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>

                    {/* Avatar → profile dropdown (theme toggle, edit profile, logout) */}
                    <div style={{ position: "relative" }}>
                        <button onClick={() => setProfileOpen((v) => !v)} style={{
                            display: "flex", alignItems: "center", gap: 9, padding: "5px 10px 5px 5px", borderRadius: 100,
                            background: profileOpen ? "rgba(var(--fg),0.06)" : "transparent", border: "1px solid", borderColor: profileOpen ? "var(--border-color)" : "transparent",
                            cursor: "pointer", transition: "all 0.15s ease",
                        }}>
                            <Avatar user={user} size={34} />
                            <div className="dl-username" style={{ textAlign: "left", display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.1 }}>{user?.name}</span>
                                <span style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{user?.role}</span>
                            </div>
                            <ChevronDown size={15} style={{ color: "var(--text-muted)", transform: profileOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} />
                        </button>

                        {profileOpen && (
                            <>
                                <div onClick={() => setProfileOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
                                <div style={{
                                    position: "absolute", top: "calc(100% + 10px)", right: 0, width: 270, zIndex: 61,
                                    background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 16,
                                    boxShadow: "0 20px 50px rgba(0,0,0,0.45)", overflow: "hidden",
                                    backdropFilter: "blur(28px) saturate(1.6)", WebkitBackdropFilter: "blur(28px) saturate(1.6)",
                                }}>
                                    {/* Identity */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 14px", borderBottom: "1px solid var(--border-color)" }}>
                                        <Avatar user={user} size={44} />
                                        <div style={{ minWidth: 0 }}>
                                            <p className="font-display" style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</p>
                                            <p style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</p>
                                        </div>
                                    </div>

                                    <div style={{ padding: 8 }}>
                                        <button onClick={() => { setProfileOpen(false); setEditOpen(true); }} style={menuRowStyle}
                                            onMouseEnter={e => e.currentTarget.style.background = "rgba(var(--fg),0.06)"}
                                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                            <UserPen size={16} /> <span>Edit Profile</span>
                                        </button>
                                        {/* Theme row */}
                                        <div style={{ ...menuRowStyle, cursor: "default", justifyContent: "space-between" }}>
                                            <span style={{ display: "flex", alignItems: "center", gap: 11 }}>
                                                <Sparkles size={16} /> Appearance
                                                <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 6px", borderRadius: 100, background: "rgba(192,132,252,0.15)", color: "var(--accent-violet)", border: "1px solid rgba(192,132,252,0.3)" }}>beta</span>
                                            </span>
                                            <ThemeToggle size={15} />
                                        </div>
                                    </div>

                                    <div style={{ padding: 8, borderTop: "1px solid var(--border-color)" }}>
                                        <button onClick={handleLogout} style={{ ...menuRowStyle, color: "#f87171" }}
                                            onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}
                                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                            <LogOut size={16} /> <span>Log out</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {editOpen && <EditProfileModal user={user} onClose={() => setEditOpen(false)} />}

            <HelpAssistant
                position="bottom-right"
                context="dashboard / projects / AI playground / settings"
                topics={[
                    "How do I build a website?",
                    "What do Tone, Audience and Theme Mode mean?",
                    "What are Required Blocks?",
                    "How do I add a custom domain?",
                    "How do I publish my site and pick a domain?",
                    "Where do I see my form submissions?",
                ]}
            />

            {/* Mobile nav dropdown */}
            {menuOpen && (
                <div className="dl-burger" style={{ position: "sticky", top: 68, zIndex: 49, background: "var(--bg-card)", backdropFilter: "blur(30px) saturate(1.8)", WebkitBackdropFilter: "blur(30px) saturate(1.8)", borderBottom: "1px solid var(--border-color)", boxShadow: "0 16px 36px rgba(0,0,0,0.4)", padding: "8px 16px 12px", flexDirection: "column", gap: 4 }}>
                    {navItems.map(({ label, path }) => {
                        const active = location.pathname.startsWith(path);
                        return (
                            <Link key={path} to={path} onClick={() => setMenuOpen(false)} style={{
                                padding: "12px 14px", borderRadius: 10, textDecoration: "none", fontFamily: "var(--font-display)",
                                fontSize: 15, fontWeight: active ? 600 : 500,
                                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                                background: active ? "rgba(var(--fg),0.08)" : "transparent",
                            }}>{label}</Link>
                        );
                    })}
                </div>
            )}

            {/* Main Content Area */}
            <main style={{ flex: 1, overflowY: "auto", background: "var(--bg-base)", position: "relative" }}>
                <div className="sz-mesh sz-mesh-soft" style={{ position: "fixed", opacity: 0.5, zIndex: 0 }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                    {children}
                </div>
            </main>
        </div>
    );
}
