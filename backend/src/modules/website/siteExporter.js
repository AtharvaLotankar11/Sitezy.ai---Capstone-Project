/**
 * siteExporter.js — turns a website's pages (layoutConfig.sections) into a
 * self-contained static site (HTML + inline CSS) and packs it into a .zip.
 *
 * Reproduces each section from its props: applied colors, fonts, the AI-written
 * copy, and the resolved Unsplash image URLs. No external build step — open
 * index.html in any browser and it works. Zero npm dependencies (tiny store-only
 * ZIP writer below).
 */

// ── tiny HTML helpers ─────────────────────────────────────────────────────────
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const isUrl = (s) => typeof s === "string" && /^https?:\/\//.test(s);

// ── color / contrast (ported from the renderer so text stays readable) ─────────
function hexToRgb(h) {
    h = String(h || "").trim().replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return [17, 17, 17];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function relLum(hex) {
    const a = hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
const isDarkBg = (hex) => relLum(hex) < 0.42;
function readableText(bg, preferred) {
    if (preferred) {
        const lb = relLum(bg), lp = relLum(preferred);
        const ratio = (Math.max(lb, lp) + 0.05) / (Math.min(lb, lp) + 0.05);
        if (ratio >= 3) return preferred;
    }
    return isDarkBg(bg) ? "#ffffff" : "#14181d";
}

const slugify = (s) => String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "page";

// ── per-section style context ──────────────────────────────────────────────────
function ctxOf(props, branding) {
    const font = props.fontFamily || branding?.font || "Inter";
    const bg = props.bgColor || "#ffffff";
    const accent = props.accentColor || branding?.primaryColor || "#6366f1";
    return { font, bg, accent, text: readableText(bg, props.textColor), accentText: readableText(accent, "#ffffff") };
}
const fontStack = (f) => `'${f}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
const wrap = (inner, extra = "") => `<div class="sp-container" style="max-width:1200px;margin:0 auto;padding:0 24px;${extra}">${inner}</div>`;

// resolve a nav/footer link to an exported page file when possible
function linkHref(link, pageLinks) {
    const raw = typeof link === "object" && link ? (link.url || link.label) : link;
    const label = typeof link === "object" && link ? (link.label || link.url) : link;
    const key = String(raw || "").replace(/^[#/]+/, "").trim().toLowerCase();
    const labelKey = String(label || "").trim().toLowerCase();
    const file = pageLinks[key] || pageLinks[labelKey];
    const href = file || (isUrl(raw) ? raw : (key ? `#${key}` : "#"));
    return { href, label: label || raw || "Link" };
}

// ── section renderers ───────────────────────────────────────────────────────────
function renderNavbar(p, b, pageLinks) {
    const c = ctxOf(p, b);
    const brand = p.brand || b?.brandName || "Brand";
    const links = (p.links && p.links.length ? p.links : ["Home", "About", "Services", "Contact"]);
    const nav = pageLinks.__nav || [];
    const fileSet = new Set(nav.map((n) => n.file));
    let resolved = links.map((l) => linkHref(l, pageLinks));
    // Auto-link: if the navbar doesn't already reach every page, use the real page list.
    const matchedFiles = new Set(resolved.map((r) => r.href).filter((h) => fileSet.has(h)));
    if (nav.length > 1 && matchedFiles.size < nav.length) {
        resolved = nav.map((n) => ({ href: n.file, label: n.label }));
    }
    const items = resolved.map(({ href, label }) => `<a href="${esc(href)}" style="color:${c.text};opacity:.82;text-decoration:none;font-size:15px;font-weight:600;">${esc(label)}</a>`).join("");
    return `<header style="position:sticky;top:0;z-index:50;background:${c.bg};border-bottom:1px solid rgba(0,0,0,0.07);font-family:${fontStack(c.font)};backdrop-filter:saturate(1.4) blur(6px);">
  ${wrap(`<div style="display:flex;align-items:center;justify-content:space-between;height:68px;gap:20px;flex-wrap:wrap;">
    <a href="index.html" style="font-weight:800;font-size:21px;color:${c.text};text-decoration:none;letter-spacing:-0.02em;">${esc(brand)}</a>
    <nav class="sp-nav" style="display:flex;gap:26px;align-items:center;">${items}
      <a href="${p.ctaLink ? esc(p.ctaLink) : "#"}" style="background:${c.accent};color:${c.accentText};padding:10px 20px;border-radius:100px;text-decoration:none;font-weight:700;font-size:14px;">${esc(p.ctaText || "Get Started")}</a>
    </nav>
  </div>`)}
</header>`;
}

function renderHero(p, b) {
    const c = ctxOf(p, b);
    const img = isUrl(p.backgroundImage) ? p.backgroundImage : "";
    const onImage = !!img;
    const text = onImage ? "#ffffff" : c.text;
    const sub = onImage ? "rgba(255,255,255,0.88)" : c.text;
    const bg = onImage
        ? `linear-gradient(rgba(8,10,14,0.5),rgba(8,10,14,0.62)), url('${esc(img)}') center/cover no-repeat`
        : c.bg;
    const btns = [];
    if (p.ctaText) btns.push(`<a href="${esc(p.ctaLink || "#")}" style="background:${c.accent};color:${c.accentText};padding:15px 34px;border-radius:${p.buttonStyle === "sharp" ? "8px" : "100px"};text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 10px 30px ${c.accent}40;">${esc(p.ctaText)}</a>`);
    if (p.secondaryCtaText) btns.push(`<a href="${esc(p.secondaryCtaLink || "#")}" style="background:transparent;color:${text};padding:15px 30px;border:1.5px solid ${onImage ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.16)"};border-radius:${p.buttonStyle === "sharp" ? "8px" : "100px"};text-decoration:none;font-weight:600;font-size:15px;">${esc(p.secondaryCtaText)}</a>`);
    const eyebrow = p.eyebrow || p.badge;
    return `<section style="font-family:${fontStack(c.font)};background:${bg};color:${text};padding:140px 24px;text-align:center;">
  ${wrap(`<div style="max-width:820px;margin:0 auto;">
    ${eyebrow ? `<div style="font-size:13px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${onImage ? "rgba(255,255,255,0.85)" : c.accent};margin-bottom:18px;">${esc(eyebrow)}</div>` : ""}
    <h1 style="font-size:clamp(2.6rem,6vw,4.6rem);font-weight:800;line-height:1.05;letter-spacing:-0.03em;margin:0 0 22px;">${esc(p.heading || "Welcome")}</h1>
    ${p.subheading ? `<p style="font-size:1.2rem;line-height:1.65;opacity:.78;color:${sub};max-width:620px;margin:0 auto 34px;">${esc(p.subheading)}</p>` : ""}
    <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">${btns.join("")}</div>
  </div>`)}
</section>`;
}

function renderText(p, b) {
    const c = ctxOf(p, b);
    return `<section style="font-family:${fontStack(c.font)};background:${c.bg};color:${c.text};padding:100px 24px;">
  ${wrap(`<div style="max-width:760px;margin:0 auto;text-align:center;">
    ${p.eyebrow ? `<div style="font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${c.accent};margin-bottom:14px;">${esc(p.eyebrow)}</div>` : ""}
    ${p.heading ? `<h2 style="font-size:clamp(2rem,4vw,3rem);font-weight:800;letter-spacing:-0.02em;margin:0 0 20px;">${esc(p.heading)}</h2>` : ""}
    ${p.description || p.text ? `<p style="font-size:1.1rem;line-height:1.8;opacity:.8;">${esc(p.description || p.text)}</p>` : ""}
  </div>`)}
</section>`;
}

function renderGallery(p, b) {
    const c = ctxOf(p, b);
    const items = (p.items || []).map((raw) => {
        const it = typeof raw === "string" ? { title: raw } : (raw || {});
        const img = isUrl(it.image) ? it.image : "";
        return `<article style="background:${isDarkBg(c.bg) ? "rgba(255,255,255,0.04)" : "#fff"};border:1px solid rgba(0,0,0,0.08);border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
      ${img ? `<div style="aspect-ratio:4/3;overflow:hidden;"><img src="${esc(img)}" alt="${esc(it.title || "")}" style="width:100%;height:100%;object-fit:cover;"></div>` : `<div style="aspect-ratio:4/3;background:linear-gradient(135deg,${c.accent}33,${c.accent}11);"></div>`}
      <div style="padding:20px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;">
          <h3 style="font-size:1.15rem;font-weight:700;margin:0;color:${c.text};">${esc(it.title || "Item")}</h3>
          ${it.price ? `<span style="font-weight:800;color:${c.accent};">${esc(it.price)}</span>` : ""}
        </div>
        ${it.description ? `<p style="font-size:0.95rem;line-height:1.6;opacity:.72;margin:8px 0 0;color:${c.text};">${esc(it.description)}</p>` : ""}
      </div>
    </article>`;
    }).join("");
    return `<section style="font-family:${fontStack(c.font)};background:${c.bg};color:${c.text};padding:100px 24px;">
  ${wrap(`${p.heading ? `<div style="text-align:center;margin-bottom:50px;">
      ${p.eyebrow ? `<div style="font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${c.accent};margin-bottom:12px;">${esc(p.eyebrow)}</div>` : ""}
      <h2 style="font-size:clamp(2rem,4vw,3rem);font-weight:800;letter-spacing:-0.02em;margin:0;">${esc(p.heading)}</h2>
      ${p.subheading ? `<p style="font-size:1.1rem;opacity:.72;max-width:620px;margin:14px auto 0;">${esc(p.subheading)}</p>` : ""}
    </div>` : ""}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px;">${items}</div>`)}
</section>`;
}

function renderCTA(p, b) {
    const c = ctxOf(p, b);
    const bg = p.bgColor || c.accent;
    const text = readableText(bg, p.textColor);
    return `<section style="font-family:${fontStack(c.font)};background:${bg};color:${text};padding:96px 24px;text-align:center;">
  ${wrap(`<div style="max-width:680px;margin:0 auto;">
    <h2 style="font-size:clamp(1.9rem,4vw,2.9rem);font-weight:800;letter-spacing:-0.02em;margin:0 0 16px;">${esc(p.heading || "Ready to get started?")}</h2>
    ${p.subheading ? `<p style="font-size:1.15rem;line-height:1.6;opacity:.85;margin:0 0 30px;">${esc(p.subheading)}</p>` : ""}
    ${p.ctaText ? `<a href="${esc(p.ctaLink || "#")}" style="display:inline-block;background:${isDarkBg(bg) ? "#fff" : "#14181d"};color:${isDarkBg(bg) ? "#14181d" : "#fff"};padding:16px 38px;border-radius:100px;text-decoration:none;font-weight:700;font-size:15px;">${esc(p.ctaText)}</a>` : ""}
  </div>`)}
</section>`;
}

function renderForm(p, b, websiteName) {
    const c = ctxOf(p, b);
    // Normalize fields → {name,label,type,options,required}
    let fields = [];
    if (Array.isArray(p.dynamicFields) && p.dynamicFields.length) fields = p.dynamicFields;
    else if (Array.isArray(p.fields) && p.fields.length && typeof p.fields[0] === "object") fields = p.fields;
    else if (Array.isArray(p.fields) && p.fields.length) {
        fields = p.fields.map((f) => {
            const n = String(f).toLowerCase();
            const type = n.includes("email") ? "email" : (n.includes("message") || n.includes("comment") ? "textarea" : "text");
            return { name: f, label: String(f).charAt(0).toUpperCase() + String(f).slice(1), type };
        });
    } else {
        fields = [{ name: "name", label: "Name", type: "text" }, { name: "email", label: "Email", type: "email" }, { name: "message", label: "Message", type: "textarea" }];
    }
    const inputStyle = `width:100%;padding:13px 16px;border-radius:12px;border:1px solid rgba(0,0,0,0.15);background:${isDarkBg(c.bg) ? "rgba(255,255,255,0.06)" : "#fff"};color:${c.text};font-size:15px;font-family:inherit;`;
    const rendered = fields.map((f) => {
        const label = `<label style="display:block;font-size:13px;font-weight:700;margin-bottom:7px;color:${c.text};opacity:.85;">${esc(f.label || f.name)}${f.required === false ? " (optional)" : ""}</label>`;
        let input;
        const opts = (Array.isArray(f.options) ? f.options : []).map((o) => String(o ?? "")).filter((o) => o.trim() !== "");
        if (f.type === "textarea") input = `<textarea rows="4" placeholder="${esc(f.placeholder || "")}" style="${inputStyle}resize:vertical;"></textarea>`;
        else if (f.type === "select") input = `<select style="${inputStyle}">${opts.map((o) => `<option>${esc(o)}</option>`).join("")}</select>`;
        else if ((f.type === "radio" || f.type === "checkbox") && opts.length) {
            input = `<div style="display:flex;flex-wrap:wrap;gap:14px;padding-top:4px;">${opts.map((o) => `<label style="display:flex;align-items:center;gap:7px;font-size:14px;color:${c.text};cursor:pointer;"><input type="${esc(f.type)}" name="${esc(f.name || f.label)}" value="${esc(o)}" style="accent-color:${c.accent};"> ${esc(o)}</label>`).join("")}</div>`;
        }
        else input = `<input type="${esc(f.type || "text")}" placeholder="${esc(f.placeholder || "")}" style="${inputStyle}">`;
        return `<div style="margin-bottom:16px;">${label}${input}</div>`;
    }).join("");
    return `<section style="font-family:${fontStack(c.font)};background:${c.bg};color:${c.text};padding:100px 24px;">
  ${wrap(`<div style="max-width:560px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:36px;">
      <h2 style="font-size:clamp(1.9rem,4vw,2.7rem);font-weight:800;letter-spacing:-0.02em;margin:0 0 12px;">${esc(p.heading || "Get in touch")}</h2>
      ${p.description ? `<p style="font-size:1.05rem;line-height:1.6;opacity:.74;margin:0;">${esc(p.description)}</p>` : ""}
    </div>
    <form onsubmit="alert('This is an exported static template — connect your own form handler to receive submissions.');return false;">
      ${rendered}
      <button type="submit" style="width:100%;background:${c.accent};color:${c.accentText};padding:15px;border:none;border-radius:12px;font-weight:700;font-size:15px;cursor:pointer;">${esc(p.submitText || "Submit")}</button>
    </form>
  </div>`)}
</section>`;
}

function renderFooter(p, b) {
    const c = ctxOf(p, b);
    const bg = p.bgColor || "#0f172a";
    const text = readableText(bg, p.textColor || "#9ca3af");
    const brand = p.brand || b?.brandName || "";
    return `<footer style="font-family:${fontStack(c.font)};background:${bg};color:${text};padding:56px 24px;">
  ${wrap(`<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
    <span style="font-weight:800;font-size:18px;color:${isDarkBg(bg) ? "#fff" : "#111"};">${esc(brand)}</span>
    <span style="font-size:14px;opacity:.8;">${esc(p.text || `© ${new Date().getFullYear()} All rights reserved.`)}</span>
  </div>`)}
</footer>`;
}

function renderButton(p, b) {
    const c = ctxOf(p, b);
    return `<section style="font-family:${fontStack(c.font)};background:${c.bg};padding:48px 24px;text-align:center;">
  <a href="${esc(p.link || p.ctaLink || "#")}" style="display:inline-block;background:${c.accent};color:${c.accentText};padding:15px 34px;border-radius:100px;text-decoration:none;font-weight:700;font-size:15px;">${esc(p.text || p.ctaText || "Click here")}</a>
</section>`;
}

function renderImage(p, b) {
    const c = ctxOf(p, b);
    const img = isUrl(p.image) ? p.image : (isUrl(p.src) ? p.src : "");
    if (!img) return "";
    return `<section style="background:${c.bg};padding:24px;"><img src="${esc(img)}" alt="${esc(p.alt || "")}" style="display:block;max-width:1100px;margin:0 auto;border-radius:16px;"></section>`;
}

function renderSpacer(p) {
    const h = Number(p.height) || 60;
    return `<div style="height:${h}px;"></div>`;
}

const RENDERERS = {
    Navbar: renderNavbar, Hero: renderHero, Text: renderText, Gallery: renderGallery,
    CTA: renderCTA, ContactForm: renderForm, DynamicForm: renderForm, Footer: renderFooter,
    Button: renderButton, Image: renderImage, Spacer: renderSpacer,
};

// ── page + document assembly ─────────────────────────────────────────────────────
function fontsLink(pages, branding) {
    const set = new Set(["Inter"]);
    if (branding?.font) set.add(branding.font);
    pages.forEach((pg) => (pg.layoutConfig?.sections || []).forEach((s) => { if (s.props?.fontFamily) set.add(s.props.fontFamily); }));
    const fam = [...set].map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700;800`).join("&");
    return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${fam}&display=swap" rel="stylesheet">`;
}

function pageHtml(page, { branding, pageLinks, websiteName, allPages }) {
    const sections = (page.layoutConfig?.sections || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const body = sections.map((s) => (RENDERERS[s.type] ? RENDERERS[s.type](s.props || {}, branding, pageLinks, websiteName) : "")).join("\n");
    const seo = page.seo || {};
    const title = seo.metaTitle || page.title || websiteName;
    const desc = seo.metaDescription || "";
    const jsonLd = seo.jsonLd ? `<script type="application/ld+json">${JSON.stringify(seo.jsonLd)}</script>` : "";
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">` : ""}
${fontsLink(allPages, branding)}
<style>
  *,*::before,*::after{box-sizing:border-box;} html,body{margin:0;padding:0;} img{max-width:100%;height:auto;display:block;}
  a{transition:opacity .2s ease;} a:hover{opacity:.85;}
  @media (max-width:680px){ .sp-nav{gap:14px !important;} h1{font-size:2.2rem !important;} }
</style>
${jsonLd}
</head>
<body>
${body}
</body>
</html>`;
}

/** Build all files for the site (does NOT zip). Returns [{name, data}]. */
export function buildSiteFiles(website, branding, pages) {
    const ordered = pages.slice().sort((a, b) => (b.isHomePage ? 1 : 0) - (a.isHomePage ? 1 : 0));
    // map page slug/title → output filename so nav links resolve across pages
    const fileFor = (pg) => (pg.isHomePage ? "index.html" : `${slugify(pg.slug || pg.title)}.html`);
    const pageLinks = {};
    ordered.forEach((pg) => {
        const file = fileFor(pg);
        pageLinks[slugify(pg.slug || "")] = file;
        pageLinks[String(pg.title || "").trim().toLowerCase()] = file;
        if (pg.isHomePage) { pageLinks["home"] = file; pageLinks[""] = file; }
    });
    // Ordered page nav for the auto-link fallback (home first).
    pageLinks.__nav = ordered.map((pg) => ({ label: pg.title, file: fileFor(pg) }));

    const files = ordered.map((pg) => ({
        name: fileFor(pg),
        data: pageHtml(pg, { branding, pageLinks, websiteName: website.name, allPages: ordered }),
    }));

    files.push({
        name: "README.txt",
        data: `${website.name} — exported static site\n\nOpen index.html in any browser to view your site.\nColors, fonts, copy, and images are all baked in.\n\nNotes:\n- Forms are static placeholders (connect your own handler to receive submissions).\n- Images load from Unsplash's CDN, so keep an internet connection for them to appear.\n\nExported from Sitezy.\n`,
    });
    return files;
}

// ── minimal store-only ZIP writer (no dependencies) ─────────────────────────────
const CRC_TABLE = (() => {
    const t = new Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
})();
function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Pack [{name,data}] into a valid (uncompressed) .zip Buffer. */
export function zipStore(files) {
    const chunks = [], central = [];
    let offset = 0;
    for (const f of files) {
        const name = Buffer.from(f.name, "utf8");
        const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, "utf8");
        const crc = crc32(data);
        const lh = Buffer.alloc(30);
        lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8);
        lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12); lh.writeUInt32LE(crc, 14);
        lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
        lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
        chunks.push(lh, name, data);

        const ch = Buffer.alloc(46);
        ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8);
        ch.writeUInt16LE(0, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14); ch.writeUInt32LE(crc, 16);
        ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28);
        ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36);
        ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
        central.push(ch, name);

        offset += lh.length + name.length + data.length;
    }
    const cd = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
    end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
    return Buffer.concat([...chunks, cd, end]);
}
