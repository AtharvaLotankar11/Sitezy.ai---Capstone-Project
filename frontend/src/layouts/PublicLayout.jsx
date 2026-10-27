import { useState, useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "../components/Logo.jsx";

/* Smooth-scrolls to a #section when navigating to /page#section (and to top otherwise). */
function ScrollToHash() {
    const { pathname, hash } = useLocation();
    useEffect(() => {
        if (hash) {
            const id = decodeURIComponent(hash.slice(1));
            const t = setTimeout(() => {
                const el = document.getElementById(id);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 80);
            return () => clearTimeout(t);
        }
        window.scrollTo({ top: 0 });
    }, [pathname, hash]);
    return null;
}

/* ─── Shared CSS for the public navbar & footer ──────────────────────────── */
export const PUBLIC_LAYOUT_STYLES = `
  .sp-nav-link {
    font-family: var(--font-display);
    color: rgba(var(--fg),0.62);
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
  .sp-nav-link:hover { color: rgba(var(--fg),0.98); }
  .sp-nav-link:hover::after { width: 100%; }

  .sp-cta-primary {
    position: relative;
    font-family: var(--font-display);
    background: var(--grad-btn);
    color: #fff;
    border: 1px solid rgba(var(--fg),0.12);
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
    box-shadow: 0 4px 14px rgba(8,90,72,0.35), inset 0 1px 0 rgba(var(--fg),0.14);
    overflow: hidden;
  }
  .sp-cta-primary::before { content:''; position:absolute; inset:0; background:linear-gradient(180deg,rgba(var(--fg),0.10),transparent 50%); pointer-events:none; }
  .sp-cta-primary:hover {
    transform: translateY(-1px) scale(1.02);
    box-shadow: 0 8px 22px rgba(8,90,72,0.45), inset 0 1px 0 rgba(var(--fg),0.18);
  }
  .sp-cta-primary:active { transform: translateY(0) scale(0.99); }

  /* Mobile nav burger + dropdown */
  .sp-burger { display: none; width: 38px; height: 38px; border-radius: 100px; align-items: center; justify-content: center;
    background: rgba(var(--fg),0.06); border: 1px solid var(--glass-border); color: rgba(var(--fg),0.9); cursor: pointer; }
  .sp-mobile-menu { display: none; }

  /* ───── Responsive ───── */
  @media (max-width: 900px) {
    .sp-nav-center { display: none !important; }
    .sp-burger { display: flex !important; }
    .sp-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
  }
  @media (max-width: 520px) {
    .sp-nav-signin { display: none !important; }
    .sp-footer-grid { grid-template-columns: 1fr 1fr !important; }
  }
  /* Compact footer on phones — the full 5-column footer is far too tall otherwise */
  @media (max-width: 600px) {
    .sp-footer { padding: 44px 7% 26px !important; }
    .sp-footer-grid { gap: 24px 18px !important; }
    .sp-footer-grid > div:first-child { grid-column: 1 / -1 !important; }
    .sp-footer-bottom { margin-top: 26px !important; padding-top: 18px !important; flex-direction: column; align-items: flex-start !important; gap: 6px !important; }
  }
  /* Tighten the pill on phones so the CTA + burger never overflow off-screen */
  @media (max-width: 440px) {
    .sp-navbar { padding: 0 10px 0 14px !important; }
    .sp-navbar .sp-cta-primary { padding: 9px 13px !important; font-size: 12px !important; }
    .sp-burger { width: 34px !important; height: 34px !important; }
  }

  /* Auth split-screen — stack on small screens, hide showcase */
  @media (max-width: 860px) {
    .sz-auth-grid { grid-template-columns: 1fr !important; min-height: 0 !important; }
    .sz-auth-showcase { display: none !important; }
  }
`;

/* ─── Public Navbar ─────────────────────────────────────────────────────── */
const NAV_LINKS = [["Features", "/features"], ["Pricing", "/product#pricing"], ["Docs", "/resources#documentation"], ["Blog", "/resources#blog"]];

export function PublicNavbar({ scrolled }) {
    const [open, setOpen] = useState(false);
    const { pathname, hash } = useLocation();

    // Close the mobile menu whenever the route changes.
    useEffect(() => { setOpen(false); }, [pathname, hash]);

    return (
        <nav className="sp-navbar" style={{
            position: "fixed",
            top: scrolled ? 12 : 18,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            width: "min(1180px, calc(100% - 24px))",
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
                ? "0 16px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(var(--fg),0.08)"
                : "0 8px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(var(--fg),0.06)",
            transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
        }}>
            <Link to="/home" style={{ textDecoration: "none" }}>
                <Logo size={32} fontSize={18} />
            </Link>

            {/* Center nav links — hidden on small viewports */}
            <div className="sp-nav-center" style={{ display: "flex", gap: 30, alignItems: "center" }}>
                {NAV_LINKS.map(([label, to]) => (
                    <Link key={label} to={to} className="sp-nav-link">{label}</Link>
                ))}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Link to="/login" className="sp-nav-link sp-nav-signin" style={{ padding: "8px 14px" }}>Sign in</Link>
                <Link to="/register" className="sp-cta-primary">
                    Get Started
                </Link>
                <button className="sp-burger" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
                    {open ? <X size={18} /> : <Menu size={18} />}
                </button>
            </div>

            {/* Mobile dropdown — only rendered when open (the .sp-burger media query
                governs visibility of the trigger; this panel just follows that state). */}
            {open && (
                <div style={{
                    position: "absolute", top: "calc(100% + 10px)", left: 0, right: 0,
                    background: "var(--glass-bg-strong)", backdropFilter: "blur(28px) saturate(1.8)",
                    WebkitBackdropFilter: "blur(28px) saturate(1.8)",
                    border: "1px solid var(--glass-border)", borderRadius: 20,
                    boxShadow: "0 16px 50px rgba(0,0,0,0.5)", padding: 10,
                    display: "flex", flexDirection: "column", gap: 2,
                }}>
                    {NAV_LINKS.map(([label, to]) => (
                        <Link key={label} to={to} onClick={() => setOpen(false)} style={{
                            padding: "13px 16px", borderRadius: 12, textDecoration: "none",
                            fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 500,
                            color: "rgba(var(--fg),0.82)",
                        }}>{label}</Link>
                    ))}
                    <Link to="/login" onClick={() => setOpen(false)} style={{
                        padding: "13px 16px", borderRadius: 12, textDecoration: "none",
                        fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 500,
                        color: "rgba(var(--fg),0.82)", borderTop: "1px solid var(--glass-border)", marginTop: 4,
                    }}>Sign in</Link>
                </div>
            )}
        </nav>
    );
}

/* ─── Public Footer ─────────────────────────────────────────────────────── */
const FOOTER_COLUMNS = [
    { title: "Product", links: [["Features", "/product#features"], ["Templates", "/product#templates"], ["AI Builder", "/product#ai-builder"], ["Pricing", "/product#pricing"], ["Changelog", "/product#changelog"]] },
    { title: "Resources", links: [["Documentation", "/resources#documentation"], ["Guides", "/resources#guides"], ["Blog", "/resources#blog"], ["Community", "/resources#community"], ["Status", "/resources#status"]] },
    { title: "Company", links: [["About", "/company#about"], ["Careers", "/company#careers"], ["Contact", "/company#contact"]] },
    { title: "Legal", links: [["Privacy", "/legal#privacy"], ["Terms", "/legal#terms"], ["Security", "/legal#security"], ["Cookies", "/legal#cookies"]] },
];

function SocialIcon({ d }) {
    return (
        <a href="#" aria-label="social" style={{
            width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid var(--glass-border)", background: "rgba(var(--fg),0.03)", color: "rgba(var(--fg),0.6)",
            transition: "all 0.2s ease",
        }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-accent)"; e.currentTarget.style.borderColor = "rgba(45,212,191,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(var(--fg),0.6)"; e.currentTarget.style.borderColor = "var(--glass-border)"; }}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16 }}><path d={d} /></svg>
        </a>
    );
}

export function PublicFooter() {
    return (
        <footer className="sp-footer" style={{ padding: "72px 5% 40px", borderTop: "1px solid rgba(var(--fg),0.06)", background: "var(--bg-surface)", position: "relative", overflow: "hidden" }}>
            <div className="sz-mesh sz-mesh-soft" style={{ opacity: 0.25 }} />
            <div className="sp-footer-grid" style={{ maxWidth: 1140, margin: "0 auto", position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1.6fr repeat(4, 1fr)", gap: 40 }}>
                {/* Brand */}
                <div style={{ maxWidth: 280 }}>
                    <Logo size={34} fontSize={19} />
                    <p style={{ marginTop: 18, fontSize: 14, lineHeight: 1.7, color: "rgba(var(--fg),0.5)" }}>
                        The AI-powered website builder for modern teams. Design, collaborate, and launch — all in one place.
                    </p>
                    <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                        {/* Facebook */}
                        <SocialIcon d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6v1.9H17l-.4 2.9h-2.1v7A10 10 0 0 0 22 12z" />
                        {/* Instagram */}
                        <SocialIcon d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.5-2.6a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z" />
                        {/* Twitter / X */}
                        <SocialIcon d="M18.9 1.2h3.7l-8 9.2 9.5 12.5h-7.5l-5.8-7.7-6.7 7.7H.4l8.6-9.8L0 1.2h7.7l5.3 7 5.9-7zm-1.3 19.7h2L6.5 3.3H4.3l13.3 17.6z" />
                    </div>
                </div>

                {/* Link columns */}
                {FOOTER_COLUMNS.map((col) => (
                    <div key={col.title}>
                        <div className="font-mono" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(var(--fg),0.4)", marginBottom: 16 }}>{col.title}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {col.links.map(([label, to]) => (<Link key={label} to={to} className="sp-nav-link" style={{ fontSize: 14 }}>{label}</Link>))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="sp-footer-bottom" style={{ maxWidth: 1140, margin: "40px auto 0", paddingTop: 24, borderTop: "1px solid rgba(var(--fg),0.06)", position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <span style={{ fontSize: 13, color: "rgba(var(--fg),0.35)" }}>© 2026 Sitezy.ai, Inc. All rights reserved.</span>
                <span className="font-mono" style={{ fontSize: 12, color: "rgba(var(--fg),0.3)" }}>Made with care by the Sitezy team.</span>
            </div>
        </footer>
    );
}

/* ─── PublicLayout wrapper (used via <Outlet />) ─────────────────────────── */
export default function PublicLayout() {
    const [scrolled, setScrolled] = useState(false);
    const glowRef = useRef(null);
    const dotRef = useRef(null);

    // The marketing/auth pages are designed dark — force dark theme while mounted,
    // then restore the user's chosen theme on unmount (so the app honors light mode).
    useEffect(() => {
        const prev = document.documentElement.getAttribute("data-theme") || "dark";
        document.documentElement.setAttribute("data-theme", "dark");
        return () => document.documentElement.setAttribute("data-theme", prev);
    }, []);

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
            <ScrollToHash />
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
