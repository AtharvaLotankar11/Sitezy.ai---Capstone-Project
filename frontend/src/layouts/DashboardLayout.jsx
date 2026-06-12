import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../store/slices/authSlice.js";
import {
    LayoutDashboard, Globe, Wand2, Settings, LogOut,
    Menu, X, Zap, CreditCard, Crown, Sparkles, Rocket
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api.js";
import Logo from "../components/Logo.jsx";

const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Projects", icon: Globe, path: "/websites" },
    { label: "AI Playground", icon: Wand2, path: "/ai" },
    { label: "Subscription", icon: CreditCard, path: "/subscription" },
    { label: "Settings", icon: Settings, path: "/settings" },
];

export default function DashboardLayout({ children }) {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user, tenant } = useSelector((s) => s.auth);
    const [planType, setPlanType] = useState(null);

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
            {/* Top Navigation */}
            <header style={{
                height: 68,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 40px",
                background: "rgba(11,11,16,0.8)",
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
                                <div style={{ width: 1, height: 24, background: "var(--border-color)" }} />
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)" }}>
                                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-primary)" }} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{tenant.name}</span>
                                </div>
                            </>
                        )}

                        {planType && (
                            <Link to="/subscription" style={{ textDecoration: "none" }}>
                                <div style={{
                                    display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 100,
                                    background: planType === "PRO" ? "rgba(56, 189, 248, 0.15)" :
                                        planType === "ENTERPRISE" ? "rgba(251, 191, 36, 0.15)" :
                                            planType === "BASIC" ? "rgba(20, 184, 166, 0.15)" : "rgba(255,255,255,0.05)",
                                    border: `1px solid ${planType === "PRO" ? "rgba(56, 189, 248, 0.32)" :
                                        planType === "ENTERPRISE" ? "rgba(251, 191, 36, 0.32)" :
                                            planType === "BASIC" ? "rgba(20, 184, 166, 0.32)" : "var(--border-color)"}`,
                                    color: planType === "PRO" ? "#38bdf8" :
                                        planType === "ENTERPRISE" ? "#fbbf24" :
                                            planType === "BASIC" ? "#5eead4" : "var(--text-secondary)",
                                    fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                                }}>
                                    {planType === "PRO" ? <Crown size={12} /> : planType === "ENTERPRISE" ? <Rocket size={12} /> : <Sparkles size={12} />}
                                    {planType}
                                </div>
                            </Link>
                        )}
                    </div>

                    {/* Nav Links */}
                    <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                                    color: active ? "#fff" : "var(--text-secondary)",
                                    background: active ? "rgba(255,255,255,0.08)" : "transparent",
                                    border: active ? "1px solid rgba(255,255,255,0.14)" : "1px solid transparent",
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
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{user?.name}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{user?.role}</span>
                        </div>
                        <div style={{
                            width: 36, height: 36, borderRadius: "50%",
                            background: "#0d9488",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontSize: 14, fontWeight: 700,
                            border: "1px solid rgba(255,255,255,0.12)",
                        }}>
                            {user?.name?.[0]?.toUpperCase()}
                        </div>
                    </div>

                    <button onClick={handleLogout} title="Logout" style={{
                        padding: 8, borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                        cursor: "pointer", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s ease"
                    }} onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.15)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}>
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

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
