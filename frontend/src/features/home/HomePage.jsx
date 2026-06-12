import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/* ─────────────────────────── Page styles + responsive ─────────────────── */
const HERO_STYLES = `
  @keyframes planeJourney {
    0%   { transform: translateX(-120px) translateY(0px)   rotate(-8deg); opacity: 0; }
    5%   { opacity: 1; }
    30%  { transform: translateX(28vw)   translateY(-40px) rotate(-4deg); }
    55%  { transform: translateX(52vw)   translateY(20px)  rotate(2deg);  }
    80%  { transform: translateX(78vw)   translateY(-25px) rotate(-6deg); }
    95%  { opacity: 1; }
    100% { transform: translateX(110vw)  translateY(-10px) rotate(-8deg); opacity: 0; }
  }
  @keyframes heroFadeUp { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes badgePop { 0% { opacity: 0; transform: scale(0.8) translateY(8px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes hp-dotGlow { 0%, 100% { box-shadow: 0 0 8px #2dd4bf; } 50% { box-shadow: 0 0 16px #5eead4; } }
  @keyframes hp-caret { 0%,100% { opacity: 1; } 50% { opacity: 0; } }

  .hp-section { padding: 100px 5%; position: relative; }
  .hp-wrap { max-width: 1140px; margin: 0 auto; position: relative; z-index: 1; }

  .hp-h2 { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.035em; color: #fff; line-height: 1.05; font-size: clamp(32px,5vw,54px); }
  .hp-lead { font-size: clamp(15px,1.6vw,18px); color: rgba(255,255,255,0.55); line-height: 1.65; }

  .hp-cta-primary {
    position: relative; font-family: var(--font-display);
    background: var(--grad-btn); color: #fff; border: 1px solid rgba(255,255,255,0.12);
    padding: 15px 30px; border-radius: 100px;
    font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none;
    display: inline-flex; align-items: center; gap: 8px;
    transition: transform 0.25s var(--ease-spring), box-shadow 0.25s ease;
    letter-spacing: -0.01em; box-shadow: 0 5px 16px rgba(8,90,72,0.35), inset 0 1px 0 rgba(255,255,255,0.14); overflow: hidden;
  }
  .hp-cta-primary::before { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,0.10), transparent 50%); pointer-events: none; }
  .hp-cta-primary:hover { transform: translateY(-1px); box-shadow: 0 9px 24px rgba(8,90,72,0.45), inset 0 1px 0 rgba(255,255,255,0.18); }
  .hp-cta-primary:active { transform: translateY(0) scale(0.99); }

  .hp-cta-secondary {
    font-family: var(--font-display);
    background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.92);
    border: 1px solid rgba(255,255,255,0.14); padding: 15px 30px; border-radius: 100px;
    font-size: 15px; font-weight: 500; cursor: pointer; text-decoration: none;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.25s var(--ease-spring); backdrop-filter: blur(14px); letter-spacing: -0.01em;
  }
  .hp-cta-secondary:hover { background: rgba(255,255,255,0.1); border-color: rgba(94,234,212,0.4); transform: translateY(-2px); }

  .hp-card {
    position: relative; overflow: hidden;
    background: var(--glass-bg); border: 1px solid var(--glass-border);
    border-radius: 20px; backdrop-filter: blur(24px) saturate(1.5);
    -webkit-backdrop-filter: blur(24px) saturate(1.5); box-shadow: var(--shadow-glass);
    transition: transform 0.4s var(--ease-spring), border-color 0.4s ease, box-shadow 0.4s ease;
  }
  .hp-card::before {
    content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    background: radial-gradient(340px circle at var(--mx,50%) var(--my,0%), rgba(45,212,191,0.16) 0%, transparent 60%);
    opacity: 0; transition: opacity 0.35s ease;
  }
  .hp-card:hover { transform: translateY(-6px); border-color: rgba(45,212,191,0.42); box-shadow: var(--shadow-elevated); }
  .hp-card:hover::before { opacity: 1; }

  .hp-feature-icon {
    width: 50px; height: 50px; border-radius: 15px;
    background: var(--grad-brand-soft); border: 1px solid var(--border-brand);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 20px; color: #5eead4; flex-shrink: 0; position: relative; z-index: 1;
    transition: transform 0.4s var(--ease-spring);
  }
  .hp-card:hover .hp-feature-icon { transform: scale(1.08) rotate(-4deg); }

  .hp-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; }
  .hp-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
  .hp-grid-templates { display: grid; grid-template-columns: repeat(3,1fr); gap: 18px; }

  /* Template thumb */
  .hp-tpl { border-radius: 16px; overflow: hidden; cursor: pointer; }
  .hp-tpl-thumb { aspect-ratio: 16/11; position: relative; overflow: hidden; }
  .hp-tpl:hover .hp-tpl-thumb > .hp-tpl-shot { transform: scale(1.05); }
  .hp-tpl-shot { position: absolute; inset: 0; transition: transform 0.5s var(--ease-spring); }

  /* FAQ */
  .hp-faq { border: 1px solid var(--glass-border); border-radius: 14px; background: var(--glass-bg); backdrop-filter: blur(20px); overflow: hidden; transition: border-color 0.25s ease; }
  .hp-faq[open] { border-color: rgba(45,212,191,0.35); }
  .hp-faq summary { list-style: none; cursor: pointer; padding: 20px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; font-family: var(--font-display); font-weight: 600; font-size: 16px; color: #fff; }
  .hp-faq summary::-webkit-details-marker { display: none; }
  .hp-faq summary .hp-faq-plus { transition: transform 0.3s ease; color: #5eead4; flex-shrink: 0; }
  .hp-faq[open] summary .hp-faq-plus { transform: rotate(45deg); }
  .hp-faq-body { padding: 0 22px 20px; color: rgba(255,255,255,0.6); font-size: 14.5px; line-height: 1.7; }

  /* ───── Responsive ───── */
  @media (max-width: 980px) {
    .hp-grid-3, .hp-grid-templates { grid-template-columns: repeat(2,1fr); }
  }
  @media (max-width: 760px) {
    .hp-section { padding: 72px 6%; }
    .hp-grid-4 { grid-template-columns: repeat(2,1fr); }
  }
  @media (max-width: 600px) {
    .hp-grid-3, .hp-grid-templates { grid-template-columns: 1fr; }
    .hp-cta-primary, .hp-cta-secondary { width: 100%; justify-content: center; }
  }
`;

/* ─── Paper Aeroplane (proper origami dart) ─── */
function PaperPlane() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
            style={{ width: 46, height: 46, filter: "drop-shadow(0 4px 10px rgba(45,212,191,0.55))" }}>
            <defs>
                <linearGradient id="planeTop" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#a5f3eb" /><stop offset="100%" stopColor="#2dd4bf" />
                </linearGradient>
                <linearGradient id="planeBot" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" /><stop offset="100%" stopColor="#0e7490" />
                </linearGradient>
            </defs>
            {/* far wing (darker) */}
            <path d="M21.5 3 L11.6 21.2 a0.5 0.5 0 0 1 -0.94 -0.1 L8.7 13.3 Z" fill="url(#planeBot)" />
            {/* near wing (lighter) */}
            <path d="M21.5 3 L2.6 10.9 a0.5 0.5 0 0 0 -0.04 0.93 L8.7 13.3 Z" fill="url(#planeTop)" />
            {/* center crease */}
            <path d="M21.5 3 L8.7 13.3" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
        </svg>
    );
}

/* icons */
const I = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 22, height: 22 }} {...p} />;
const MagicIcon = () => <I><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" strokeLinecap="round" strokeLinejoin="round" /></I>;
const BrushIcon = () => <I><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L3 14.67V21h6.33l10.06-10.06a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" /><line x1="16" y1="5" x2="19" y2="8" strokeLinecap="round" /></I>;
const GlobeIcon = () => <I><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></I>;
const BoltIcon = () => <I><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" /></I>;
const ShieldIcon = () => <I><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" /></I>;
const ChartIcon = () => <I><line x1="18" y1="20" x2="18" y2="10" strokeLinecap="round" /><line x1="12" y1="20" x2="12" y2="4" strokeLinecap="round" /><line x1="6" y1="20" x2="6" y2="14" strokeLinecap="round" /><line x1="2" y1="20" x2="22" y2="20" strokeLinecap="round" /></I>;
const Plus = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="hp-faq-plus" style={{ width: 18, height: 18 }}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>;
const Arrow = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>;

const FEATURES = [
    { icon: <MagicIcon />, color: "#5eead4", title: "AI-Powered Builder", desc: "Describe your vision in plain English. Sitezy.ai drafts pixel-perfect pages in seconds — no design skills required." },
    { icon: <BrushIcon />, color: "#7dd3fc", title: "Visual Drag & Drop", desc: "A canvas that feels as natural as sketching. Move, resize, and style every element with professional precision." },
    { icon: <GlobeIcon />, color: "#6ee7b7", title: "One-Click Publishing", desc: "Global CDN, automatic SSL, and custom domains. Your site goes live instantly and stays blazing fast worldwide." },
    { icon: <BoltIcon />, color: "#38bdf8", title: "Real-Time Collaboration", desc: "Co-edit with your team live — shared cursors, instant sync, and full version history so you can roll back anytime." },
    { icon: <ShieldIcon />, color: "#2dd4bf", title: "Multi-Tenant Security", desc: "Strict logical isolation, role-based access, and granular permissions keep every workspace's data self-contained." },
    { icon: <ChartIcon />, color: "#bef264", title: "Built-in Analytics", desc: "Privacy-first visitor analytics with real-time dashboards. Understand your audience without sacrificing their data." },
];

const STEPS = [
    { n: "01", title: "Describe your idea", desc: "Type a prompt — “a portfolio for a product designer” — and watch the AI generate a full multi-section layout." },
    { n: "02", title: "Customize visually", desc: "Fine-tune everything on a drag-and-drop canvas. Swap sections, edit copy, restyle, and add pages instantly." },
    { n: "03", title: "Publish to the world", desc: "Ship in one click to a global edge network with SSL. Map a custom domain whenever you’re ready." },
];

const TEMPLATES = [
    { name: "Studio Portfolio", tag: "Portfolio", kind: "portfolio", g: "linear-gradient(135deg,#0ea5e9,#2563eb)" },
    { name: "SaaS Launch", tag: "Startup", kind: "saas", g: "linear-gradient(135deg,#14b8a6,#10b981)" },
    { name: "Storefront", tag: "E-commerce", kind: "ecommerce", g: "linear-gradient(135deg,#a3e635,#22c55e)" },
    { name: "Bistro", tag: "Restaurant", kind: "restaurant", g: "linear-gradient(135deg,#fbbf24,#f97316)" },
    { name: "Agency One", tag: "Agency", kind: "agency", g: "linear-gradient(135deg,#38bdf8,#06b6d4)" },
    { name: "The Journal", tag: "Blog", kind: "blog", g: "linear-gradient(135deg,#34d399,#0ea5e9)" },
];

const TESTIMONIALS = [
    { quote: "We replaced three tools with Sitezy. Our marketing team now ships landing pages in an afternoon instead of a sprint.", name: "Maya Chen", role: "Head of Growth, Northwind", c: "#06b6d4" },
    { quote: "The AI draft is genuinely a starting point we keep — not throwaway. It understands structure, not just words.", name: "Diego Alvarez", role: "Founder, Vertex Labs", c: "#10b981" },
    { quote: "Real-time collaboration plus version history means design and content finally work in the same room.", name: "Priya Nair", role: "Design Lead, Lumen", c: "#38bdf8" },
];

const FAQS = [
    { q: "Do I need to know how to code?", a: "Not at all. Describe what you want and the AI builds it; refine visually with drag-and-drop. Developers can go deeper when they want to." },
    { q: "Can I use my own domain?", a: "Yes. Every site gets a free subdomain with SSL, and you can map a custom domain at any time from your workspace settings." },
    { q: "How does team collaboration work?", a: "Invite teammates with role-based permissions. Everyone edits live with shared cursors, and full version history lets you roll back instantly." },
    { q: "Is there a free plan?", a: "Yes — start free with no credit card. Upgrade only when you need more sites, pages, AI generations, or custom domains." },
];

/* spotlight pointer tracker */
const trackSpot = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
};

/* ── Realistic per-category mini website previews ── */
const Bar = ({ w = "100%", h = 6, c = "rgba(255,255,255,0.14)", r = 3, ...rest }) =>
    <div style={{ width: w, height: h, borderRadius: r, background: c, ...rest }} />;

const tile = "rgba(255,255,255,0.05)";
const tileBorder = "1px solid rgba(255,255,255,0.06)";

function MiniNav({ g, right }) {
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: 4, background: g }} />
                <Bar w={28} h={5} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {[16, 16, 16].map((w, i) => <Bar key={i} w={w} h={4} c="rgba(255,255,255,0.1)" />)}
                {right}
            </div>
        </div>
    );
}

function TemplatePreview({ kind, g }) {
    const page = { position: "absolute", inset: 0, background: "linear-gradient(180deg,#0b1115,#080d10)", padding: "11px 13px", display: "flex", flexDirection: "column", gap: 9, overflow: "hidden" };

    if (kind === "portfolio") {
        return (
            <div className="hp-tpl-shot" style={page}>
                <MiniNav g={g} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: g, flexShrink: 0 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <Bar w={92} h={9} c="rgba(255,255,255,0.85)" />
                        <Bar w={64} h={5} c="rgba(255,255,255,0.3)" />
                    </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 2, flex: 1 }}>
                    {[0.9, 0.5, 0.7, 0.6, 0.85, 0.5].map((o, i) => (
                        <div key={i} style={{ borderRadius: 6, background: g, opacity: o }} />
                    ))}
                </div>
            </div>
        );
    }

    if (kind === "saas") {
        return (
            <div className="hp-tpl-shot" style={page}>
                <MiniNav g={g} right={<div style={{ width: 26, height: 12, borderRadius: 100, background: g }} />} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 8 }}>
                    <Bar w="64%" h={10} c="rgba(255,255,255,0.85)" />
                    <Bar w="46%" h={6} c="rgba(255,255,255,0.28)" />
                    <div style={{ width: 52, height: 16, borderRadius: 100, background: g, marginTop: 4 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: "auto" }}>
                    {[0, 1, 2].map(i => (
                        <div key={i} style={{ background: tile, border: tileBorder, borderRadius: 6, padding: 7, display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ width: 12, height: 12, borderRadius: 4, background: g, opacity: 0.85 }} />
                            <Bar w="90%" h={4} /><Bar w="60%" h={4} c="rgba(255,255,255,0.08)" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (kind === "ecommerce") {
        return (
            <div className="hp-tpl-shot" style={page}>
                <MiniNav g={g} right={<div style={{ width: 12, height: 12, borderRadius: 4, background: "rgba(255,255,255,0.18)" }} />} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, flex: 1, marginTop: 2 }}>
                    {[0, 1].map(i => (
                        <div key={i} style={{ background: tile, border: tileBorder, borderRadius: 7, padding: 6, display: "flex", flexDirection: "column", gap: 5 }}>
                            <div style={{ flex: 1, borderRadius: 5, background: g, opacity: i % 2 ? 0.7 : 0.92, minHeight: 30 }} />
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <Bar w={30} h={5} />
                                <div style={{ width: 16, height: 9, borderRadius: 3, background: "#fbbf24" }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (kind === "restaurant") {
        return (
            <div className="hp-tpl-shot" style={page}>
                <div style={{ position: "relative", height: 56, borderRadius: 8, background: g, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent,rgba(0,0,0,0.45))" }} />
                    <Bar w="55%" h={9} c="rgba(255,255,255,0.92)" r={4} position="relative" zIndex={1} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 4 }}>
                    {[0, 1, 2].map(i => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <Bar w={`${70 - i * 8}%`} h={6} />
                            <Bar w={20} h={6} c="rgba(251,191,36,0.8)" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (kind === "agency") {
        return (
            <div className="hp-tpl-shot" style={page}>
                <MiniNav g={g} />
                <div style={{ display: "flex", gap: 10, flex: 1, marginTop: 4, alignItems: "center" }}>
                    <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: 7 }}>
                        <Bar w="95%" h={11} c="rgba(255,255,255,0.9)" />
                        <Bar w="70%" h={11} c={g} />
                        <Bar w="85%" h={5} c="rgba(255,255,255,0.25)" />
                        <div style={{ width: 44, height: 14, borderRadius: 100, background: "rgba(255,255,255,0.14)", marginTop: 4 }} />
                    </div>
                    <div style={{ flex: 1, alignSelf: "stretch", borderRadius: 8, background: g, opacity: 0.9 }} />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                    {[0, 1, 2].map(i => <div key={i} style={{ flex: 1, height: 14, borderRadius: 100, background: tile, border: tileBorder }} />)}
                </div>
            </div>
        );
    }

    // blog
    return (
        <div className="hp-tpl-shot" style={page}>
            <MiniNav g={g} />
            <Bar w="50%" h={9} c="rgba(255,255,255,0.85)" marginTop={2} />
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 2 }}>
                {[0, 1, 2].map(i => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ width: 38, height: 26, borderRadius: 6, background: g, opacity: 0.85 - i * 0.12, flexShrink: 0 }} />
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                            <Bar w="80%" h={5} /><Bar w="55%" h={4} c="rgba(255,255,255,0.08)" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── Product mockup ─── */
function BuilderMockup() {
    const sections = [
        { type: "Navbar", color: "#38bdf8" }, { type: "Hero", color: "#2dd4bf" },
        { type: "Gallery", color: "#a3e635" }, { type: "CTA", color: "#fbbf24" }, { type: "Footer", color: "#64748b" },
    ];
    return (
        <div className="glass-strong" style={{ position: "relative", borderRadius: 20, overflow: "hidden", boxShadow: "0 50px 130px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                <div style={{ display: "flex", gap: 7 }}>{["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (<span key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />))}</div>
                <div className="font-mono" style={{ flex: 1, maxWidth: 320, margin: "0 auto", padding: "5px 14px", borderRadius: 7, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "rgba(255,255,255,0.45)", textAlign: "center" }}>app.sitezy.ai/builder</div>
                <div style={{ width: 52 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 168px", minHeight: 340 }}>
                <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="sz-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Layers</div>
                    {sections.map((s, i) => (
                        <div key={s.type} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, background: i === 1 ? "rgba(45,212,191,0.16)" : "rgba(255,255,255,0.03)", border: `1px solid ${i === 1 ? "rgba(45,212,191,0.4)" : "rgba(255,255,255,0.05)"}` }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: i === 1 ? "#99f6e4" : "rgba(255,255,255,0.55)" }}>{s.type}</span>
                        </div>
                    ))}
                </div>
                <div style={{ padding: 18, background: "radial-gradient(ellipse at 50% 0%, rgba(45,212,191,0.08), transparent 70%)" }}>
                    <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#091012" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <div style={{ width: 46, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.25)" }} />
                            <div style={{ display: "flex", gap: 8 }}>{[24, 24, 24].map((w, i) => <div key={i} style={{ width: w, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.12)" }} />)}</div>
                        </div>
                        <div style={{ position: "relative", padding: "30px 18px", textAlign: "center", outline: "2px solid #2dd4bf", outlineOffset: -2 }}>
                            <div className="font-mono" style={{ position: "absolute", top: 6, left: 6, fontSize: 8, fontWeight: 600, color: "#03201c", background: "#2dd4bf", padding: "2px 6px", borderRadius: 5 }}>HERO</div>
                            <div style={{ width: "62%", height: 14, borderRadius: 6, margin: "0 auto 10px", background: "var(--grad-text)" }} />
                            <div style={{ width: "44%", height: 8, borderRadius: 4, margin: "0 auto 6px", background: "rgba(255,255,255,0.18)" }} />
                            <div style={{ width: "38%", height: 8, borderRadius: 4, margin: "0 auto 16px", background: "rgba(255,255,255,0.12)" }} />
                            <div style={{ width: 96, height: 26, borderRadius: 100, margin: "0 auto", background: "var(--grad-brand)", boxShadow: "0 6px 18px rgba(13,148,136,0.5)" }} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: 14 }}>{[0, 1, 2].map((i) => <div key={i} style={{ height: 44, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.05)" }} />)}</div>
                    </div>
                </div>
                <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="sz-eyebrow" style={{ fontSize: 9 }}>Inspector</div>
                    {["Heading", "Subheading", "CTA label"].map((l) => (<div key={l}><div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)", marginBottom: 5 }}>{l}</div><div style={{ height: 24, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} /></div>))}
                    <div><div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Accent</div><div style={{ display: "flex", gap: 7 }}>{["#2dd4bf", "#38bdf8", "#a3e635", "#fbbf24"].map((c) => (<span key={c} style={{ width: 18, height: 18, borderRadius: 6, background: c, border: c === "#2dd4bf" ? "2px solid #fff" : "1px solid rgba(255,255,255,0.15)" }} />))}</div></div>
                    <div style={{ marginTop: "auto", height: 30, borderRadius: 100, background: "var(--grad-brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>Publish</div>
                </div>
            </div>
        </div>
    );
}

/* ─── Section heading helper ─── */
function SectionHead({ badge, title, accent, lead }) {
    return (
        <div style={{ textAlign: "center", marginBottom: 56, maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
            <div className="sz-badge" style={{ marginBottom: 20 }}>{badge}</div>
            <h2 className="hp-h2" style={{ marginBottom: 16 }}>{title}{accent && <><br /><span className="serif-accent gradient-text" style={{ fontSize: "1.06em" }}>{accent}</span></>}</h2>
            {lead && <p className="hp-lead">{lead}</p>}
        </div>
    );
}

const PROMPT_EXAMPLES = [
    "a studio portfolio",
    "a SaaS landing page",
    "an online clothing store",
    "a cozy restaurant website",
    "a photographer's gallery",
    "a personal travel blog",
];

/* ─── HomePage ─── */
export default function HomePage() {
    const [planeKey, setPlaneKey] = useState(0);
    const [promptVal, setPromptVal] = useState("");
    const [typed, setTyped] = useState("");
    const timerRef = useRef(null);

    useEffect(() => {
        const cycle = () => { setPlaneKey((k) => k + 1); timerRef.current = setTimeout(cycle, 6500); };
        timerRef.current = setTimeout(cycle, 700);
        return () => clearTimeout(timerRef.current);
    }, []);

    /* Typewriter placeholder — types & erases example prompts in a loop */
    useEffect(() => {
        if (promptVal) return; // pause while the user is typing
        let i = 0, ch = 0, dir = 1, t;
        const tick = () => {
            const full = PROMPT_EXAMPLES[i];
            ch += dir;
            setTyped(full.slice(0, ch));
            if (dir === 1 && ch === full.length) { dir = -1; t = setTimeout(tick, 1500); return; }
            if (dir === -1 && ch === 0) { dir = 1; i = (i + 1) % PROMPT_EXAMPLES.length; t = setTimeout(tick, 350); return; }
            t = setTimeout(tick, dir === 1 ? 60 : 28);
        };
        t = setTimeout(tick, 500);
        return () => clearTimeout(t);
    }, [promptVal]);

    return (
        <>
            <style>{HERO_STYLES}</style>
            <div style={{ color: "white", background: "var(--bg-base)", position: "relative", overflowX: "hidden" }}>

                {/* ══════ HERO ══════ */}
                <section style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", paddingTop: 130, paddingBottom: 70, minHeight: "92vh" }}>
                    <div className="sz-mesh" style={{ opacity: 0.9 }} />
                    <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.035) 1px,transparent 1px)", backgroundSize: "72px 72px", pointerEvents: "none", WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 32%, #000 30%, transparent 100%)", maskImage: "radial-gradient(ellipse 70% 60% at 50% 32%, #000 30%, transparent 100%)" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "45%", background: "linear-gradient(to top,var(--bg-base),transparent)", pointerEvents: "none" }} />

                    <div key={planeKey} style={{ position: "absolute", top: "16%", left: 0, animation: "planeJourney 5s cubic-bezier(0.25,0.46,0.45,0.94) forwards", pointerEvents: "none", zIndex: 10 }}><PaperPlane /></div>

                    <div style={{ position: "relative", zIndex: 5, textAlign: "center", maxWidth: 900, padding: "0 24px" }}>
                        <h1 className="font-display" style={{ fontSize: "clamp(33px,7.5vw,86px)", fontWeight: 600, lineHeight: 1.03, letterSpacing: "-0.035em", marginBottom: 24, animation: "heroFadeUp 0.7s cubic-bezier(0.4,0,0.2,1) 0.3s both" }}>
                            <span style={{ color: "#fff" }}>Build websites</span><br />
                            <span style={{ color: "#fff" }}>at the </span>
                            <span className="serif-accent gradient-text" style={{ fontSize: "1.1em" }}>speed of thought.</span>
                        </h1>

                        <p style={{ fontSize: "clamp(16px,2vw,20px)", lineHeight: 1.65, color: "rgba(255,255,255,0.62)", maxWidth: 600, margin: "0 auto 34px", animation: "heroFadeUp 0.7s cubic-bezier(0.4,0,0.2,1) 0.45s both" }}>
                            Describe your idea and let AI design the first draft — then refine it on a pro drag-and-drop canvas and publish in one click.
                        </p>

                        {/* AI prompt bar */}
                        <form onSubmit={(e) => e.preventDefault()} style={{ animation: "heroFadeUp 0.7s cubic-bezier(0.4,0,0.2,1) 0.6s both" }}>
                            <div className="glass-strong" style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 600, margin: "0 auto", padding: "8px 8px 8px 18px", borderRadius: 100 }}>
                                <MagicIcon />
                                <input
                                    aria-label="Describe your website"
                                    value={promptVal}
                                    onChange={(e) => setPromptVal(e.target.value)}
                                    placeholder={`Describe your website…  e.g. ${typed}▏`}
                                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 15, fontFamily: "var(--font-display)", minWidth: 0 }}
                                />
                                <Link to="/register" className="hp-cta-primary" style={{ padding: "12px 22px", flexShrink: 0 }}>Generate <Arrow /></Link>
                            </div>
                            <div style={{ marginTop: 14, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                                Free to start · No credit card required
                            </div>
                        </form>
                    </div>

                    <div style={{ position: "relative", zIndex: 5, width: "100%", maxWidth: 980, padding: "0 24px", marginTop: 60, animation: "heroFadeUp 0.9s cubic-bezier(0.4,0,0.2,1) 0.9s both" }}>
                        <BuilderMockup />
                    </div>
                </section>

                {/* ══════ HOW IT WORKS ══════ */}
                <section className="hp-section">
                    <div className="hp-wrap">
                        <SectionHead badge="How it works" title="From prompt to published in" accent="three simple steps." lead="No templates to wrestle, no code to write. Just describe, refine, and ship." />
                        <div className="hp-grid-3">
                            {STEPS.map((s) => (
                                <div key={s.n} className="hp-card" onMouseMove={trackSpot} style={{ padding: 30 }}>
                                    <div className="font-display gradient-text" style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.04em", marginBottom: 14, position: "relative", zIndex: 1 }}>{s.n}</div>
                                    <h3 className="font-display" style={{ fontSize: 19, fontWeight: 600, color: "#fff", marginBottom: 10, letterSpacing: "-0.02em", position: "relative", zIndex: 1 }}>{s.title}</h3>
                                    <p style={{ fontSize: 14.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, position: "relative", zIndex: 1 }}>{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ══════ TEMPLATES ══════ */}
                <section className="hp-section" style={{ paddingTop: 20 }}>
                    <div className="sz-mesh sz-mesh-soft" style={{ opacity: 0.35 }} />
                    <div className="hp-wrap">
                        <SectionHead badge="Templates" title="Start from a" accent="stunning template." lead="Launch faster with professionally designed starting points — then make every pixel yours." />
                        <div className="hp-grid-templates">
                            {TEMPLATES.map((t) => (
                                <div key={t.name} className="hp-tpl hp-card" onMouseMove={trackSpot}>
                                    <div className="hp-tpl-thumb"><TemplatePreview kind={t.kind} g={t.g} /></div>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", position: "relative", zIndex: 1 }}>
                                        <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{t.name}</span>
                                        <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5eead4", padding: "4px 9px", borderRadius: 100, background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.28)" }}>{t.tag}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ══════ FEATURES ══════ */}
                <section id="features" className="hp-section">
                    <div className="hp-wrap">
                        <SectionHead badge="Everything you need" title="The complete platform for" accent="modern web teams." lead="From first sketch to global launch — every tool you need lives in one beautifully designed workspace." />
                        <div className="hp-grid-3">
                            {FEATURES.map(({ icon, title, desc, color }) => (
                                <div key={title} className="hp-card" onMouseMove={trackSpot} style={{ padding: 30 }}>
                                    <div className="hp-feature-icon" style={{ color, background: `${color}1f`, borderColor: `${color}55` }}>{icon}</div>
                                    <h3 className="font-display" style={{ fontSize: 18, fontWeight: 600, color, marginBottom: 10, letterSpacing: "-0.02em", position: "relative", zIndex: 1 }}>{title}</h3>
                                    <p style={{ fontSize: 14, color: "rgba(255,255,255,0.52)", lineHeight: 1.7, position: "relative", zIndex: 1 }}>{desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ══════ TESTIMONIALS ══════ */}
                <section className="hp-section">
                    <div className="sz-mesh sz-mesh-soft" style={{ opacity: 0.35 }} />
                    <div className="hp-wrap">
                        <SectionHead badge="Loved by builders" title="Teams ship more with" accent="Sitezy.ai." />
                        <div className="hp-grid-3">
                            {TESTIMONIALS.map((t) => (
                                <div key={t.name} className="hp-card" onMouseMove={trackSpot} style={{ padding: 30, display: "flex", flexDirection: "column", gap: 20 }}>
                                    <div style={{ display: "flex", gap: 3, position: "relative", zIndex: 1 }}>
                                        {[...Array(5)].map((_, i) => <svg key={i} viewBox="0 0 24 24" fill="#fbbf24" style={{ width: 16, height: 16 }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>)}
                                    </div>
                                    <p style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.8)", position: "relative", zIndex: 1 }}>“{t.quote}”</p>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "auto", position: "relative", zIndex: 1 }}>
                                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${t.c}, #10b981)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 15 }}>{t.name[0]}</div>
                                        <div>
                                            <div className="font-display" style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{t.name}</div>
                                            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)" }}>{t.role}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ══════ FAQ ══════ */}
                <section className="hp-section">
                    <div className="hp-wrap" style={{ maxWidth: 820 }}>
                        <SectionHead badge="FAQ" title="Questions, answered." />
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {FAQS.map((f) => (
                                <details key={f.q} className="hp-faq">
                                    <summary>{f.q}<Plus /></summary>
                                    <div className="hp-faq-body">{f.a}</div>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ══════ CTA BANNER ══════ */}
                <section className="hp-section" style={{ paddingTop: 20 }}>
                    <div className="glass-strong hp-wrap" style={{ borderRadius: 30, padding: "76px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                        <div className="sz-mesh" style={{ opacity: 0.55 }} />
                        <div style={{ position: "relative", zIndex: 1 }}>
                            <h2 className="hp-h2" style={{ marginBottom: 18 }}>Ready to ship something<br /><span className="serif-accent gradient-text" style={{ fontSize: "1.06em" }}>extraordinary?</span></h2>
                            <p className="hp-lead" style={{ marginBottom: 36, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>Join 50,000+ teams who chose Sitezy.ai to build, launch, and scale their online presence.</p>
                            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                                <Link to="/register" className="hp-cta-primary">Start for free — no card needed <Arrow /></Link>
                                <Link to="/login" className="hp-cta-secondary">Sign in to your account</Link>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}
