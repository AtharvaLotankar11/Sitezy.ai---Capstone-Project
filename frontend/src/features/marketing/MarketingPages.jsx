import { Link } from "react-router-dom";

/* Shared styling for the marketing pages (Product / Resources / Company / Legal / Features).
   They render inside PublicLayout (navbar + footer + forced-dark), so this just styles the body. */
const MKT_CSS = `
  .mkt-hero { padding: 150px 6% 56px; text-align: center; position: relative; }
  .mkt-eyebrow { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-accent); display: inline-block; margin-bottom: 14px; }
  .mkt-h1 { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.03em; color: #fff; font-size: clamp(34px, 5vw, 54px); line-height: 1.05; margin: 0 0 18px; }
  .mkt-sub { font-size: 18px; color: rgba(var(--fg),0.6); max-width: 640px; margin: 0 auto; line-height: 1.65; }
  .mkt-sec { padding: 56px 6%; scroll-margin-top: 88px; border-top: 1px solid rgba(var(--fg),0.06); }
  .mkt-wrap { max-width: 1080px; margin: 0 auto; }
  .mkt-h2 { font-family: var(--font-display); font-weight: 600; font-size: clamp(25px, 3.4vw, 36px); color: #fff; letter-spacing: -0.02em; margin: 0 0 14px; }
  .mkt-lead { font-size: 16px; color: rgba(var(--fg),0.6); max-width: 700px; line-height: 1.7; margin: 0 0 28px; }
  .mkt-card { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 16px; padding: 24px; transition: border-color 0.2s ease, transform 0.2s ease; }
  .mkt-card:hover { border-color: rgba(45,212,191,0.35); transform: translateY(-3px); }
  .mkt-grid { display: grid; gap: 18px; }
  .mkt-g3 { grid-template-columns: repeat(3, 1fr); }
  .mkt-g2 { grid-template-columns: repeat(2, 1fr); }
  .mkt-card h3 { font-family: var(--font-display); font-size: 17px; font-weight: 600; color: #fff; margin: 0 0 8px; letter-spacing: -0.01em; }
  .mkt-card p { font-size: 14px; color: rgba(var(--fg),0.6); line-height: 1.65; margin: 0; }
  .mkt-link { color: var(--text-accent); font-weight: 600; text-decoration: none; font-size: 14px; }
  .mkt-pill { display: inline-flex; align-items: center; gap: 8px; padding: 12px 26px; border-radius: 100px; background: var(--grad-btn); color: #fff; font-family: var(--font-display); font-weight: 600; font-size: 15px; text-decoration: none; border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 6px 18px rgba(8,90,72,0.35); }
  .mkt-backend-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 36px; align-items: center; }
  .mkt-backend-perks { display: flex; flex-direction: column; gap: 13px; padding-left: 28px; border-left: 1px solid rgba(45,212,191,0.22); }
  @media (max-width: 860px) {
    .mkt-g3, .mkt-g2 { grid-template-columns: 1fr; }
    .mkt-backend-grid { grid-template-columns: 1fr; gap: 26px; }
    .mkt-backend-perks { padding-left: 0; border-left: none; padding-top: 22px; border-top: 1px solid rgba(45,212,191,0.22); }
  }
`;

function Shell({ children }) {
    return <div><style>{MKT_CSS}</style>{children}</div>;
}

function Hero({ eyebrow, title, sub }) {
    return (
        <div className="mkt-hero">
            <div className="sz-mesh sz-mesh-soft" style={{ opacity: 0.4 }} />
            <div style={{ position: "relative", zIndex: 1 }}>
                <span className="mkt-eyebrow">{eyebrow}</span>
                <h1 className="mkt-h1">{title}</h1>
                {sub && <p className="mkt-sub">{sub}</p>}
            </div>
        </div>
    );
}

function Section({ id, eyebrow, title, lead, children }) {
    return (
        <section id={id} className="mkt-sec">
            <div className="mkt-wrap">
                {eyebrow && <span className="mkt-eyebrow">{eyebrow}</span>}
                <h2 className="mkt-h2">{title}</h2>
                {lead && <p className="mkt-lead">{lead}</p>}
                {children}
            </div>
        </section>
    );
}

const Card = ({ title, children }) => (
    <div className="mkt-card"><h3>{title}</h3><p>{children}</p></div>
);

/* ─────────────────────────── FEATURES ─────────────────────────── */
const FEATURES = [
    ["AI-Powered Builder", "Describe your vision in plain English and Sitezy drafts pixel-perfect pages in seconds — no design skills required."],
    ["Visual Drag & Drop", "A canvas that feels as natural as sketching. Move, resize, and style every element with professional precision."],
    ["One-Click Publishing", "Global CDN, automatic SSL, and custom domains. Your site goes live instantly and stays blazing fast worldwide."],
    ["Real-Time Collaboration", "Co-edit with your team live — shared cursors, instant sync, and full version history so you can roll back anytime."],
    ["DL SEO Engine", "An on-device deep-learning model scores your SEO, then AI rewrites weak content to climb the rankings — automatically."],
    ["Built-in Analytics", "Privacy-first visitor analytics with real-time dashboards. Understand your audience without sacrificing their data."],
];

// Automatic-backend perks (accurate to the platform — images are link-based, not stored uploads).
const BACKEND_PERKS = [
    "A managed database, provisioned instantly",
    "Form submissions captured to a searchable inbox",
    "Hosting, global CDN & SSL on publish",
    "Images by link — pull in any URL or pick from the library",
    "Secure data APIs handled behind the scenes",
];

export function FeaturesPage() {
    return (
        <Shell>
            <Hero eyebrow="Features" title="Everything you need to ship a site" sub="From a one-line prompt to a polished, published website — Sitezy handles design, content, SEO, hosting, and the entire backend in one place. No servers to set up, ever." />
            <Section id="all" eyebrow="The toolkit" title="Powerful by default, simple on the surface">
                {/* Zero-backend highlight — flaunts the automatic backend */}
                <div className="mkt-card mkt-backend" style={{ borderColor: "rgba(45,212,191,0.45)", background: "rgba(20,184,166,0.07)", marginBottom: 22, padding: 30 }}>
                    <div className="mkt-backend-grid">
                        <div>
                            <span className="mkt-eyebrow" style={{ marginBottom: 10 }}>No servers · No setup</span>
                            <h3 style={{ fontSize: 22, marginBottom: 10 }}>Your backend builds itself</h3>
                            <p style={{ margin: 0, maxWidth: 560 }}>
                                You never touch a server, database, or line of backend code. Publish a site and Sitezy automatically
                                provisions everything it needs — then hands you the data right inside your dashboard.
                            </p>
                        </div>
                        <div className="mkt-backend-perks">
                            {BACKEND_PERKS.map((p) => (
                                <span key={p} style={{ fontSize: 13.5, color: "rgba(var(--fg),0.78)", display: "flex", gap: 9, alignItems: "flex-start" }}>
                                    <span style={{ color: "var(--text-accent)", fontWeight: 700, flexShrink: 0 }}>✓</span>{p}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="mkt-grid mkt-g3">
                    {FEATURES.map(([t, d]) => <Card key={t} title={t}>{d}</Card>)}
                </div>
                <div style={{ marginTop: 36, textAlign: "center" }}>
                    <Link to="/register" className="mkt-pill">Start building free →</Link>
                </div>
            </Section>
        </Shell>
    );
}

/* ─────────────────────────── PRODUCT ─────────────────────────── */
const PRICING = [
    { name: "Free", price: "$0", note: "for getting started", cta: "Choose plan", feats: ["1 published site", "AI generations", "Sitezy subdomain + SSL", "Community support"] },
    { name: "Pro", price: "$19", note: "per month", cta: "Start Pro", feats: ["10 sites", "Custom domains", "DL SEO auto-improve", "Remove Sitezy badge"], hot: true },
    { name: "Business", price: "$49", note: "per month", cta: "Start Business", feats: ["Unlimited sites", "Team collaboration", "Native eCommerce", "Priority support"] },
];
const CHANGELOG = [
    ["v2.4 · Jun 2026", "Deep-learning SEO engine with AI auto-improve, plus a GRU-based engagement optimizer."],
    ["v2.3 · May 2026", "Light mode across the platform and a redesigned template gallery with live previews."],
    ["v2.2 · Apr 2026", "Auto-configure with AI — pick template, colors, tone, and audience from a single prompt."],
    ["v2.1 · Mar 2026", "Real-time collaboration with shared cursors and per-page version history."],
];

export function ProductPage() {
    return (
        <Shell>
            <Hero eyebrow="Product" title="One platform, from idea to launch" sub="Sitezy combines an AI drafter, a pro visual editor, native hosting, and a deep-learning SEO engine — so anyone can build and grow a real website." />

            <Section id="features" eyebrow="Features" title="Build faster with AI + a real editor"
                lead="Describe what you want, get a complete first draft, then refine every pixel on a drag-and-drop canvas.">
                <div className="mkt-grid mkt-g3">
                    {FEATURES.slice(0, 3).map(([t, d]) => <Card key={t} title={t}>{d}</Card>)}
                </div>
                <p style={{ marginTop: 18 }}><Link to="/features" className="mkt-link">Explore all features →</Link></p>
            </Section>

            <Section id="templates" eyebrow="Templates" title="Start from a stunning, real template"
                lead="Professionally designed starting points for restaurants, fitness, fashion, corporate, and more — preview them live, then make every pixel yours.">
                <div className="mkt-grid mkt-g3">
                    <Card title="Industry-ready">Curated templates across restaurant, fitness, fashion, corporate, SaaS, and beauty.</Card>
                    <Card title="Fully customizable">Swap colors, fonts, sections, and content with AI or by hand — light or dark mode.</Card>
                    <Card title="Live preview">See exactly how a template looks before you pick it, right from the homepage.</Card>
                </div>
            </Section>

            <Section id="ai-builder" eyebrow="AI Builder" title="From a sentence to a website"
                lead="Our AI Playground turns a plain-English brief into a structured, on-brand multi-section site — with real copy and images — in seconds.">
                <div className="mkt-grid mkt-g2">
                    <Card title="Smart layout recommender">An ML model suggests the right sections for your business type and goal.</Card>
                    <Card title="Content + images">Our AI writes the copy; relevant imagery is filled in automatically.</Card>
                </div>
            </Section>

            <Section id="pricing" eyebrow="Pricing" title="Simple pricing that grows with you"
                lead="Start free, upgrade when you need more sites, custom domains, or team features. No credit card to begin.">
                <div className="mkt-grid mkt-g3">
                    {PRICING.map((p) => (
                        <div key={p.name} className="mkt-card" style={{ borderColor: p.hot ? "rgba(45,212,191,0.5)" : undefined, background: p.hot ? "rgba(20,184,166,0.08)" : undefined }}>
                            <h3>{p.name}</h3>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "6px 0 4px" }}>
                                <span className="font-display" style={{ fontSize: 32, fontWeight: 700, color: "#fff" }}>{p.price}</span>
                                <span style={{ fontSize: 13, color: "rgba(var(--fg),0.5)" }}>{p.note}</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "16px 0 20px" }}>
                                {p.feats.map((f) => <span key={f} style={{ fontSize: 13.5, color: "rgba(var(--fg),0.7)", display: "flex", gap: 8 }}><span style={{ color: "var(--text-accent)" }}>✓</span>{f}</span>)}
                            </div>
                            <Link to="/register" className="mkt-pill" style={{ width: "100%", justifyContent: "center", boxShadow: "none", padding: "11px 0", ...(p.hot ? {} : { background: "rgba(var(--fg),0.06)", border: "1px solid var(--glass-border)" }) }}>{p.cta}</Link>
                        </div>
                    ))}
                </div>
            </Section>

            <Section id="changelog" eyebrow="Changelog" title="What's new" lead="We ship continuously. Recent highlights:">
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {CHANGELOG.map(([v, d]) => (
                        <div key={v} style={{ display: "flex", gap: 18, padding: "14px 0", borderBottom: "1px solid rgba(var(--fg),0.06)" }}>
                            <span className="font-mono" style={{ fontSize: 12.5, color: "var(--text-accent)", minWidth: 130, flexShrink: 0 }}>{v}</span>
                            <span style={{ fontSize: 14.5, color: "rgba(var(--fg),0.7)", lineHeight: 1.6 }}>{d}</span>
                        </div>
                    ))}
                </div>
            </Section>
        </Shell>
    );
}

/* ─────────────────────────── RESOURCES ─────────────────────────── */
export function ResourcesPage() {
    return (
        <Shell>
            <Hero eyebrow="Resources" title="Everything to help you build & grow" sub="Docs, guides, a community, and product updates — all in one place." />

            <Section id="documentation" eyebrow="Documentation" title="Docs & API reference"
                lead="Step-by-step references for the builder, AI generation, publishing, custom domains, and the form backend.">
                <div className="mkt-grid mkt-g3">
                    <Card title="Getting started">Create your first project, generate with AI, and publish in minutes.</Card>
                    <Card title="Builder & sections">Every section type, its variants, and how to customize props.</Card>
                    <Card title="Deploy & domains">Subdomains, SSL, and mapping a custom domain to your site.</Card>
                </div>
            </Section>

            <Section id="guides" eyebrow="Guides" title="Hands-on guides"
                lead="Practical walkthroughs to get the most out of Sitezy.">
                <div className="mkt-grid mkt-g2">
                    <Card title="Writing great AI prompts">How to describe your concept so the AI nails the first draft.</Card>
                    <Card title="Improving your SEO score">Use the DL SEO engine and auto-improve to climb the rankings.</Card>
                    <Card title="Designing for conversion">Apply engagement suggestions to lift your conversion rate.</Card>
                    <Card title="Launching a store">Set up products, payments, and orders with native eCommerce.</Card>
                </div>
            </Section>

            <Section id="blog" eyebrow="Blog" title="From the blog"
                lead="Product news, design tips, and stories from builders.">
                <div className="mkt-grid mkt-g3">
                    <Card title="Build a site in 5 minutes">A start-to-finish walkthrough using the AI Playground.</Card>
                    <Card title="The state of AI web design">Where AI-assisted website building is headed in 2026.</Card>
                    <Card title="10 templates, infinite brands">How style-based templates fit any business.</Card>
                </div>
            </Section>

            <Section id="community" eyebrow="Community" title="Join the community"
                lead="Share what you're building, get feedback, and learn from other creators.">
                <div className="mkt-grid mkt-g2">
                    <Card title="Discord">Chat with builders, get help, and join weekly build-alongs.</Card>
                    <Card title="Showcase">Submit your site and get featured on our gallery.</Card>
                </div>
            </Section>

            <Section id="status" eyebrow="Status" title="System status">
                <div className="mkt-card" style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 420 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>All systems operational</span>
                </div>
                <p style={{ marginTop: 12, fontSize: 13.5, color: "rgba(var(--fg),0.5)" }}>Builder · AI engine · Publishing · CDN — all running normally.</p>
            </Section>
        </Shell>
    );
}

/* ─────────────────────────── COMPANY ─────────────────────────── */
export function CompanyPage() {
    return (
        <Shell>
            <Hero eyebrow="Company" title="Building the easiest way to get online" sub="Sitezy is on a mission to let anyone turn an idea into a real website — no code, no friction." />

            <Section id="about" eyebrow="About" title="A small team with a big idea"
                lead="Sitezy was designed and built by a small team of four — engineers and designers who believe building for the web should feel effortless.">
                <div className="mkt-grid mkt-g2">
                    <Card title="Our mission">Put a professional-grade web studio in everyone's hands, powered by AI and great design.</Card>
                    <Card title="How we work">Ship fast, listen to creators, and obsess over the details that make a site feel premium.</Card>
                </div>
                <p style={{ marginTop: 18, fontSize: 14, color: "rgba(var(--fg),0.55)" }}>
                    From a one-line prompt to a live, SEO-optimized site — the whole platform was built by four people who wanted that experience to exist.
                </p>
            </Section>

            <Section id="careers" eyebrow="Careers" title="Work with us"
                lead="We're a tiny, ambitious team and we love meeting people who care about craft. If that's you, we'd love to hear from you.">
                <div className="mkt-card" style={{ maxWidth: 540 }}>
                    <h3>Get in touch</h3>
                    <p style={{ marginBottom: 14 }}>Tell us what you'd love to work on and share your portfolio or projects.</p>
                    <a href="mailto:careers.sitezyai@gmail.com" className="mkt-pill">✉ careers.sitezyai@gmail.com</a>
                </div>
            </Section>

            <Section id="contact" eyebrow="Contact" title="Say hello"
                lead="Questions, partnerships, or feedback — reach out and we'll get back to you.">
                <div className="mkt-grid mkt-g2">
                    <Card title="General">hello@sitezy.ai</Card>
                    <Card title="Careers">careers.sitezyai@gmail.com</Card>
                </div>
            </Section>
        </Shell>
    );
}

/* ─────────────────────────── LEGAL ─────────────────────────── */
export function LegalPage() {
    return (
        <Shell>
            <Hero eyebrow="Legal" title="Legal & policies" sub="The terms and policies that govern your use of Sitezy. Plain-language summaries below." />

            <Section id="privacy" eyebrow="Privacy" title="Privacy Policy"
                lead="We collect only what we need to run the service — your account details and the content you create. We never sell your data.">
                <Card title="What we store">Account info, your projects, and privacy-first, aggregate analytics for your published sites.</Card>
            </Section>
            <Section id="terms" eyebrow="Terms" title="Terms of Service"
                lead="By using Sitezy you agree to use the platform lawfully and own the content you publish. We provide the tools; you own your sites.">
                <Card title="Your content">You retain full ownership of everything you create and publish with Sitezy.</Card>
            </Section>
            <Section id="security" eyebrow="Security" title="Security"
                lead="Encrypted in transit (TLS) and at rest, role-based access, and strict multi-tenant isolation keep every workspace's data self-contained.">
                <Card title="Our practices">Automatic SSL, scoped permissions, and least-privilege access across the platform.</Card>
            </Section>
            <Section id="cookies" eyebrow="Cookies" title="Cookie Policy"
                lead="We use essential cookies to keep you signed in and a minimal set for product analytics. You're in control of optional cookies.">
                <Card title="Essential only by default">No third-party advertising trackers — ever.</Card>
            </Section>
        </Shell>
    );
}
