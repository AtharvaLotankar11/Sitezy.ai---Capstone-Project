import Logo from "../../components/Logo.jsx";

/**
 * Branded gradient showcase panel used on the left side of the auth split-screen.
 */
export default function AuthShowcase({ eyebrow, title, subtitle, bullets = [] }) {
    return (
        <div className="sz-auth-showcase" style={{
            position: "relative", overflow: "hidden",
            background: "linear-gradient(150deg, #0a1820 0%, #07110f 55%, #060a0c 100%)",
            padding: "48px 44px", display: "flex", flexDirection: "column", justifyContent: "space-between",
            borderRight: "1px solid var(--border-color)",
        }}>
            {/* Mesh + aurora glows */}
            <div className="sz-mesh" style={{ opacity: 0.8 }} />
            <div className="sz-aurora" />
            {/* Grid texture */}
            <div style={{
                position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5,
                backgroundImage:
                    "linear-gradient(rgba(var(--fg),0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--fg),0.04) 1px,transparent 1px)",
                backgroundSize: "40px 40px",
                WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 30% 20%, #000, transparent)",
                maskImage: "radial-gradient(ellipse 90% 70% at 30% 20%, #000, transparent)",
            }} />

            {/* Logo */}
            <div style={{ position: "relative", zIndex: 1 }}>
                <Logo size={40} fontSize={21} />
            </div>

            {/* Copy */}
            <div style={{ position: "relative", zIndex: 1 }}>
                {eyebrow && (
                    <div className="sz-eyebrow" style={{ color: "var(--text-accent)", marginBottom: 16 }}>
                        {eyebrow}
                    </div>
                )}
                <h2 className="font-display" style={{
                    fontSize: 36, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.1,
                    color: "#fff", marginBottom: 16, maxWidth: 360,
                }}>
                    {title}
                </h2>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(var(--fg),0.6)", maxWidth: 340 }}>
                    {subtitle}
                </p>
            </div>

            {/* Feature bullets */}
            <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
                {bullets.map((b, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "rgba(20,184,166,0.16)", border: "1px solid rgba(20,184,166,0.34)",
                            color: "var(--text-accent)",
                        }}>
                            {b.icon}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(var(--fg),0.82)" }}>{b.text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
