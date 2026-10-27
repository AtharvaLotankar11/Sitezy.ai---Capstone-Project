import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { login } from "../../store/slices/authSlice.js";
import toast from "react-hot-toast";
import { Eye, EyeOff, ArrowRight, Sparkles, Wand2, MousePointerClick, Rocket } from "lucide-react";
import AuthShowcase from "./AuthShowcase.jsx";

export default function LoginPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading } = useSelector((s) => s.auth);

    const [formData, setFormData] = useState({ email: "", tenantSlug: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await dispatch(login(formData));
        if (login.fulfilled.match(result)) {
            toast.success(`Welcome back, ${result.payload.user.name}! 👋`);
            navigate("/dashboard");
        } else {
            toast.error(result.payload || "Login failed");
        }
    };

    const labelStyle = {
        display: "block", marginBottom: 9, fontSize: 12.5, fontWeight: 600,
        letterSpacing: "0.01em", color: "var(--text-secondary)", fontFamily: "var(--font-display)",
    };

    return (
        <div style={{
            minHeight: "calc(100vh - 68px)", display: "flex", alignItems: "center", justifyContent: "center",
            padding: "108px 20px 60px", background: "var(--bg-base)", position: "relative", overflow: "hidden",
        }}>
            <div className="sz-mesh sz-mesh-soft" style={{ opacity: 0.6 }} />
            <div className="animate-fade-in sz-auth-grid" style={{
                width: "100%", maxWidth: 980, display: "grid", position: "relative", zIndex: 1,
                gridTemplateColumns: "1.05fr 1fr", borderRadius: 26, overflow: "hidden",
                border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-elevated)",
                background: "var(--glass-bg-strong)", backdropFilter: "blur(30px) saturate(1.6)",
                WebkitBackdropFilter: "blur(30px) saturate(1.6)", minHeight: 600,
            }}>
                {/* ── Left: branded showcase ── */}
                <AuthShowcase
                    eyebrow="Welcome back"
                    title="Pick up right where you left off."
                    subtitle="Your projects, deployments, and AI drafts are waiting in your workspace."
                    bullets={[
                        { icon: <Wand2 size={15} />, text: "AI drafts pages in seconds" },
                        { icon: <MousePointerClick size={15} />, text: "Visual drag-and-drop builder" },
                        { icon: <Rocket size={15} />, text: "One-click global publishing" },
                    ]}
                />

                {/* ── Right: form ── */}
                <div style={{ padding: "48px 48px 44px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div className="sz-badge" style={{ alignSelf: "flex-start", marginBottom: 22 }}>
                        <Sparkles size={13} /> Workspace login
                    </div>

                    <h2 className="font-display" style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 8 }}>
                        Sign in
                    </h2>
                    <p style={{ fontSize: 14.5, color: "var(--text-secondary)", marginBottom: 30 }}>
                        Continue to your Sitezy.ai dashboard.
                    </p>

                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        <div>
                            <label style={labelStyle}>Workspace ID</label>
                            <input
                                className="saas-input"
                                name="tenantSlug" value={formData.tenantSlug} onChange={handleChange}
                                placeholder="acme" required
                                style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>Email address</label>
                            <input
                                className="saas-input"
                                name="email" type="email" value={formData.email} onChange={handleChange}
                                placeholder="you@company.com" required style={{ width: "100%" }}
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>Password</label>
                            <div style={{ position: "relative" }}>
                                <input
                                    className="saas-input"
                                    name="password" type={showPassword ? "text" : "password"}
                                    value={formData.password} onChange={handleChange}
                                    placeholder="Your password" required
                                    style={{ width: "100%", paddingRight: 52 }}
                                />
                                <button
                                    type="button" onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                                        color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer",
                                        padding: 4, display: "flex",
                                    }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="saas-button" style={{
                            width: "100%", padding: "13px 0", fontSize: 14.5, marginTop: 6,
                        }}>
                            {loading ? (
                                <span className="animate-spin" style={{
                                    width: 16, height: 16, border: "2px solid rgba(var(--fg),0.35)",
                                    borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                                }} />
                            ) : (
                                <>Sign in <ArrowRight size={16} /></>
                            )}
                        </button>
                    </form>

                    <p style={{ textAlign: "center", marginTop: 26, fontSize: 14, color: "var(--text-muted)" }}>
                        New to Sitezy.ai?{" "}
                        <Link to="/register" style={{ color: "var(--text-accent)", textDecoration: "none", fontWeight: 600 }}>
                            Create a workspace
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
