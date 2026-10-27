import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { register } from "../../store/slices/authSlice.js";
import toast from "react-hot-toast";
import { Eye, EyeOff, ArrowRight, Rocket, Sparkles, Globe, ShieldCheck } from "lucide-react";
import AuthShowcase from "./AuthShowcase.jsx";

export default function RegisterPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, error } = useSelector((s) => s.auth);

    const [formData, setFormData] = useState({
        tenantName: "", tenantSlug: "", name: "", email: "", password: "",
    });
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => {
        let val = e.target.value;
        if (e.target.name === "tenantName") {
            setFormData((p) => ({
                ...p,
                tenantName: val,
                tenantSlug: val.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20),
            }));
            return;
        }
        setFormData((p) => ({ ...p, [e.target.name]: val }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await dispatch(register(formData));
        if (register.fulfilled.match(result)) {
            toast.success("Workspace created! Welcome to Sitezy.ai 🚀");
            navigate("/dashboard");
        } else {
            toast.error(result.payload || "Registration failed");
        }
    };

    const labelStyle = {
        display: "block", marginBottom: 8, fontSize: 12.5, fontWeight: 600,
        letterSpacing: "0.01em", color: "var(--text-secondary)", fontFamily: "var(--font-display)",
    };

    return (
        <div style={{
            minHeight: "calc(100vh - 68px)", display: "flex", alignItems: "center", justifyContent: "center",
            padding: "108px 20px 60px", background: "var(--bg-base)", position: "relative", overflow: "hidden",
        }}>
            <div className="sz-mesh sz-mesh-soft" style={{ opacity: 0.6 }} />
            <div className="animate-fade-in sz-auth-grid" style={{
                width: "100%", maxWidth: 1020, display: "grid", position: "relative", zIndex: 1,
                gridTemplateColumns: "1fr 1.05fr", borderRadius: 26, overflow: "hidden",
                border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-elevated)",
                background: "var(--glass-bg-strong)", backdropFilter: "blur(30px) saturate(1.6)",
                WebkitBackdropFilter: "blur(30px) saturate(1.6)", minHeight: 640,
            }}>
                {/* ── Left: branded showcase ── */}
                <AuthShowcase
                    eyebrow="Get started free"
                    title="Launch your first site in minutes."
                    subtitle="Spin up a workspace, describe your idea, and let AI build the first draft for you."
                    bullets={[
                        { icon: <Sparkles size={15} />, text: "No credit card required" },
                        { icon: <Globe size={15} />, text: "Free subdomain + SSL included" },
                        { icon: <ShieldCheck size={15} />, text: "Your data, fully isolated" },
                    ]}
                />

                {/* ── Right: form ── */}
                <div style={{ padding: "44px 48px 40px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div className="sz-badge" style={{ alignSelf: "flex-start", marginBottom: 20 }}>
                        <Rocket size={13} /> Create workspace
                    </div>

                    <h2 className="font-display" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 6 }}>
                        Create your account
                    </h2>
                    <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 26 }}>
                        Your AI-powered website builder is one step away.
                    </p>

                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            <div>
                                <label style={labelStyle}>Workspace name</label>
                                <input
                                    className="saas-input"
                                    name="tenantName" value={formData.tenantName} onChange={handleChange}
                                    placeholder="Acme Corp" required style={{ width: "100%" }}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Workspace ID</label>
                                <input
                                    className="saas-input"
                                    name="tenantSlug" value={formData.tenantSlug} onChange={handleChange}
                                    placeholder="acmecorp" required maxLength={20}
                                    style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={labelStyle}>Full name</label>
                            <input
                                className="saas-input"
                                name="name" value={formData.name} onChange={handleChange}
                                placeholder="John Doe" required style={{ width: "100%" }}
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>Email address</label>
                            <input
                                className="saas-input"
                                name="email" type="email" value={formData.email} onChange={handleChange}
                                placeholder="john@acmecorp.com" required style={{ width: "100%" }}
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>Password</label>
                            <div style={{ position: "relative" }}>
                                <input
                                    className="saas-input"
                                    name="password" type={showPassword ? "text" : "password"}
                                    value={formData.password} onChange={handleChange}
                                    placeholder="Min 6 characters" required
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

                        {error && (
                            <div style={{
                                padding: "11px 14px", borderRadius: 8,
                                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                                color: "#f87171", fontSize: 13, fontWeight: 500,
                            }}>
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="saas-button" style={{
                            width: "100%", padding: "13px 0", fontSize: 14.5, marginTop: 4,
                        }}>
                            {loading ? (
                                <span className="animate-spin" style={{
                                    width: 16, height: 16, border: "2px solid rgba(var(--fg),0.35)",
                                    borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                                }} />
                            ) : (
                                <>Create workspace <ArrowRight size={16} /></>
                            )}
                        </button>
                    </form>

                    <p style={{ textAlign: "center", marginTop: 22, fontSize: 14, color: "var(--text-muted)" }}>
                        Already have a workspace?{" "}
                        <Link to="/login" style={{ color: "var(--text-accent)", textDecoration: "none", fontWeight: 600 }}>
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
