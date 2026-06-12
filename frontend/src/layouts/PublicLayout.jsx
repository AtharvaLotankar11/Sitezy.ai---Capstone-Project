import { useState, useEffect, useRef } from "react";
import { Link, Outlet } from "react-router-dom";
import Logo from "../components/Logo.jsx";

/* ─── Shared CSS for the public navbar & footer ──────────────────────────── */
export const PUBLIC_LAYOUT_STYLES = `
  .sp-nav-link {
    font-family: var(--font-display);
    color: rgba(255,255,255,0.62);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    transition: color 0.2s ease;
    letter-spacing: -0.01em;
    position: relative;
  }
  .sp-nav-link::after {
    content: '';
    position: absolute; left: 0; bottom: -4px;
    width: 0; height: 1.5px; border-radius: 2px;
    background: var(--grad-brand);
    transition: width 0.25s cubic-bezier(0.4,0,0.2,1);
  }
  .sp-nav-link:hover { color: rgba(255,255,255,0.98); }
  .sp-nav-link:hover::after { width: 100%; }

  .sp-cta-primary {
    position: relative;
    font-family: var(--font-display);
    background: var(--grad-btn);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.12);
    padding: 10px 20px;
    border-radius: 100px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.25s ease;
    letter-spacing: -0.01em;
    box-shadow: 0 4px 14px rgba(8,90,72,0.35), inset 0 1px 0 rgba(255,255,255,0.14);
    overflow: hidden;
  }
  .sp-cta-primary::before { content:''; position:absolute; inset:0; background:linear-gradient(180deg,rgba(255,255,255,0.10),transparent 50%); pointer-events:none; }
  .sp-cta-primary:hover {
    transform: translateY(-1px) scale(1.02);
    box-shadow: 0 8px 22px rgba(8,90,72,0.45), inset 0 1px 0 rgba(255,255,255,0.18);
  }
  .sp-cta-primary:active { transform: translateY(0) scale(0.99); }

  /* ───── Responsive ───── */
  @media (max-width: 900px) {
    .sp-nav-center { display: none !important; }
    .sp-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
  }
  @media (max-width: 520px) {
    .sp-nav-signin { display: none !important; }
    .sp-footer-grid { grid-template-columns: 1fr 1fr !important; }
  }

  /* Auth split-screen — stack on small screens, hide showcase */
  @media (max-width: 860px) {
    .sz-auth-grid { grid-template-columns: 1fr !important; min-height: 0 !important; }
    .sz-auth-showcase { display: none !important; }
  }
`;

/* ─── Public Navbar ─────────────────────────────────────────────────────── */
export function PublicNavbar({ scrolled }) {
    return (
        <nav style={{
            position: "fixed",
            top: scrolled ? 12 : 18,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            width: "min(1180px, calc(100% - 32px))",
            padding: "0 12px 0 22px",
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--glass-bg-strong)",
            backdropFilter: "blur(28px) saturate(1.8)",
            WebkitBackdropFilter: "blur(28px) saturate(1.8)",
            border: "1px solid var(--glass-border)",
            borderRadius: 100,
            boxShadow: scrolled
                ? "0 16px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)"
                : "0 8px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
            transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
        }}>
            <Link to="/home" style={{ textDecoration: "none" }}>
                <Logo size={32} fontSize={18} />
            </Link>

            {/* Center nav links — hidden on small viewports */}
            <div className="sp-nav-center" style={{ display: "flex", gap: 30, alignItems: "center" }}>
                {["Features", "Pricing", "Docs", "Blog"].map((l) => (
                    <a key={l} href="#" className="sp-nav-link">{l}</a>
                ))}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Link to="/login" className="sp-nav-link sp-nav-signin" style={{ padding: "8px 14px" }}>Sign in</Link>
                <Link to="/register" className="sp-cta-primary">
                    Get Started
                </Link>
            </div>
        </nav>
    );
}

/* ─── Public Footer ─────────────────────────────────────────────────────── */
const FOOTER_COLUMNS = [
    { title: "Product", links: ["Features", "Templates", "AI Builder", "Pricing", "Changelog"] },
    { title: "Resources", links: ["Documentation", "Guides", "Blog", "Community", "Status"] },
    { title: "Company", links: ["About", "Careers", "Contact", "Partners"] },
    { title: "Legal", links: ["Privacy", "Terms", "Security", "Cookies"] },
];

function SocialIcon({ d }) {
    return (
        <a href="#" aria-label="social" style={{
            width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid var(--glass-border)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.6)",
            transition: "all 0.2s ease",
        }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#5eead4"; e.currentTarget.style.borderColor = "rgba(45,212,191,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; e.currentTarget.style.borderColor = "var(--glass-border)"; }}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16 }}><path d={d} /></svg>
        </a>
    );
}

export function PublicFooter() {
    return (
        <footer style={{ padding: "72px 5% 40px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "var(--bg-surface)", position: "relative", overflow: "hidden" }}>
            <div className="sz-mesh sz-mesh-soft" style={{ opacity: 0.25 }} />
            <div className="sp-footer-grid" style={{ maxWidth: 1140, margin: "0 auto", position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1.6fr repeat(4, 1fr)", gap: 40 }}>
                {/* Brand */}
                <div style={{ maxWidth: 280 }}>
                    <Logo size={34} fontSize={19} />
                    <p style={{ marginTop: 18, fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.5)" }}>
                        The AI-powered website builder for modern teams. Design, collaborate, and launch — all in one place.
                    </p>
                    <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                        <SocialIcon d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6v1.9H17l-.4 2.9h-2.1v7A10 10 0 0 0 22 12z" />
                        <SocialIcon d="M18.9 1.2h3.7l-8 9.2 9.5 12.5h-7.5l-5.8-7.7-6.7 7.7H.4l8.6-9.8L0 1.2h7.7l5.3 7 5.9-7zm-1.3 19.7h2L6.5 3.3H4.3l13.3 17.6z" />
                        <SocialIcon d="M12 2C6.5 2 2 6.6 2 12.2c0 4.5 2.9 8.3 6.8 9.6.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.4-3.4-1.4-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.7.3-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .3.3.7.9.7 1.9v2.8c0 .3.2.6.7.5 3.9-1.3 6.8-5.1 6.8-9.6C22 6.6 17.5 2 12 2z" />
                        <SocialIcon d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.3 18.3H5.7V9.7h2.6v8.6zM7 8.6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm11.3 9.7h-2.6v-4.2c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.2v4.3h-2.6V9.7h2.5v1.2h.1c.3-.6 1.2-1.4 2.5-1.4 2.7 0 3.2 1.8 3.2 4.1v4.7z" />
                    </div>
                </div>

                {/* Link columns */}
                {FOOTER_COLUMNS.map((col) => (
                    <div key={col.title}>
                        <div className="font-mono" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>{col.title}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {col.links.map((l) => (<a key={l} href="#" className="sp-nav-link" style={{ fontSize: 14 }}>{l}</a>))}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ maxWidth: 1140, margin: "40px auto 0", paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>© 2026 Sitezy.ai, Inc. All rights reserved.</span>
                <span className="font-mono" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} /> All systems operational
                </span>
            </div>
        </footer>
    );
}

/* ─── PublicLayout wrapper (used via <Outlet />) ─────────────────────────── */
export default function PublicLayout() {
    const [scrolled, setScrolled] = useState(false);
    const glowRef = useRef(null);
    const dotRef = useRef(null);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    /* Cursor follower — additive glow + reactive dot (desktop / fine pointers only) */
    useEffect(() => {
        const fine = window.matchMedia("(pointer: fine)").matches;
        if (!fine) return;

        const glow = glowRef.current;
        const dot = dotRef.current;
        let gx = window.innerWidth / 2, gy = window.innerHeight / 2;
        let tx = gx, ty = gy;
        let raf;

        const move = (e) => {
            tx = e.clientX; ty = e.clientY;
            if (dot) {
                dot.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%)`;
                dot.classList.add("is-active");
                const interactive = e.target.closest?.("a, button, [data-cursor='hot']");
                dot.classList.toggle("is-hot", !!interactive);
            }
            if (glow) glow.classList.add("is-active");
        };
        const tick = () => {
            gx += (tx - gx) * 0.14;
            gy += (ty - gy) * 0.14;
            if (glow) glow.style.transform = `translate3d(${gx}px, ${gy}px, 0) translate(-50%, -50%)`;
            raf = requestAnimationFrame(tick);
        };
        const leave = () => { dot?.classList.remove("is-active"); glow?.classList.remove("is-active"); };

        window.addEventListener("mousemove", move, { passive: true });
        document.addEventListener("mouseleave", leave);
        raf = requestAnimationFrame(tick);
        return () => {
            window.removeEventListener("mousemove", move);
            document.removeEventListener("mouseleave", leave);
            cancelAnimationFrame(raf);
        };
    }, []);

    return (
        <>
            <style>{PUBLIC_LAYOUT_STYLES}</style>
            <div ref={glowRef} className="sz-cursor-glow" aria-hidden="true" />
            <div ref={dotRef} className="sz-cursor-dot" aria-hidden="true" />
            <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", flexDirection: "column" }}>
                <PublicNavbar scrolled={scrolled} />
                {/* main fills remaining space */}
                <main style={{ flex: 1 }}>
                    <Outlet />
                </main>
                <PublicFooter />
            </div>
        </>
    );
}
