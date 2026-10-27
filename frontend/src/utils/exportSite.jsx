// Exact static export — renders each page through the SAME React section components
// used by the live preview (renderToStaticMarkup), so the download matches the editor
// pixel-for-pixel (variant layouts, colors, fonts, copy, Unsplash images, SEO meta).
// Zips entirely in the browser (no dependencies).
import { renderToStaticMarkup } from "react-dom/server";
import { SECTION_MAP, globalResponsiveCss, resolvePageLink } from "../features/publicSite/PublicSiteRenderer.jsx";

const slugify = (s) => String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "page";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fileFor = (pg) => (pg.isHomePage ? "index.html" : `${slugify(pg.slug || pg.title)}.html`);

// Build the nav links the preview would show, but point each at the exported file.
function navLinksForExport(links, pages) {
    const ordered = [...pages].sort((a, b) => (b.isHomePage ? 1 : 0) - (a.isHomePage ? 1 : 0));
    const matched = new Set((links || []).map((l) => resolvePageLink(l, pages)).filter(Boolean).map((p) => String(p._id)));
    if (!links || matched.size < pages.length) {
        return ordered.map((p) => ({ label: p.title, url: fileFor(p) }));
    }
    return links.map((l) => {
        const m = resolvePageLink(l, pages);
        const isObj = l && typeof l === "object";
        return { label: isObj ? l.label : l, url: m ? fileFor(m) : (isObj ? l.url : "#") };
    });
}

function fontsLink(pages, branding) {
    const set = new Set(["Inter"]);
    if (branding?.font) set.add(branding.font);
    pages.forEach((pg) => (pg.layoutConfig?.sections || []).forEach((s) => { if (s.props?.fontFamily) set.add(s.props.fontFamily); }));
    const fam = [...set].map((f) => `family=${f.replace(/ /g, "+")}:wght@300;400;500;600;700;800;900`).join("&");
    return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${fam}&display=swap" rel="stylesheet">`;
}

function pageHtml(page, { branding, pages }) {
    const sections = (page.layoutConfig?.sections || [])
        .slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((s) => ({ ...s, props: { ...(s.props || {}) } }));

    // Rewrite navbar/footer links to the exported page files (static, no SPA router).
    for (const s of sections) {
        if (s.type === "Navbar") s.props.links = navLinksForExport(s.props.links, pages);
        if (s.type === "Footer" && Array.isArray(s.props.links)) s.props.links = navLinksForExport(s.props.links, pages);
    }

    const body = sections.map((s) => {
        const Comp = SECTION_MAP[s.type];
        if (!Comp) return "";
        try {
            // No onPageChange → the navbar renders plain <a href="page.html"> links.
            return renderToStaticMarkup(
                <Comp props={s.props || {}} branding={branding} allPages={pages} currentPage={page} websiteId={page.websiteId} />
            );
        } catch (e) {
            console.warn(`[export] section ${s.type} failed to render:`, e?.message);
            return "";
        }
    }).join("\n");

    const seo = page.seo || {};
    const title = seo.metaTitle || page.title || "";
    const desc = seo.metaDescription || "";
    const jsonLd = seo.jsonLd ? `<script type="application/ld+json">${JSON.stringify(seo.jsonLd)}</script>` : "";
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">` : ""}
${fontsLink(pages, branding)}
<style>${globalResponsiveCss}
  html,body{margin:0;padding:0;}
</style>
${jsonLd}
</head>
<body>
${body}
</body>
</html>`;
}

// ── browser ZIP (store/no-compression) — mirrors the backend writer, byte-compatible ──
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
})();
function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}
function zipSync(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    for (const f of files) {
        const name = enc.encode(f.name);
        const data = enc.encode(f.data);
        const crc = crc32(data);
        const lh = new Uint8Array(30); const lv = new DataView(lh.buffer);
        lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0, true); lv.setUint16(8, 0, true);
        lv.setUint16(10, 0, true); lv.setUint16(12, 0, true); lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
        lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true);
        parts.push(lh, name, data);
        const ch = new Uint8Array(46); const cv = new DataView(ch.buffer);
        cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0, true); cv.setUint16(10, 0, true);
        cv.setUint16(12, 0, true); cv.setUint16(14, 0, true); cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
        cv.setUint16(28, name.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, offset, true);
        central.push(ch, name);
        offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((n, a) => n + a.length, 0);
    const end = new Uint8Array(22); const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);
    const all = [...parts, ...central, end];
    const total = all.reduce((n, a) => n + a.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    for (const a of all) { out.set(a, p); p += a.length; }
    return out;
}

/** Render every page exactly like the preview, zip in-browser, and trigger a download. */
export function exportSiteZip(website, branding, pages) {
    const ordered = [...pages].sort((a, b) => (b.isHomePage ? 1 : 0) - (a.isHomePage ? 1 : 0));
    const files = ordered.map((pg) => ({ name: fileFor(pg), data: pageHtml(pg, { branding: branding || {}, pages: ordered }) }));
    files.push({
        name: "README.txt",
        data: `${website.name} — exported static site\n\nOpen index.html in any browser to view your site.\nThis is an exact copy of your live preview: colors, fonts, copy, layouts, and images are all baked in.\n\nNotes:\n- Forms are static (connect your own handler to receive submissions).\n- Images load from Unsplash's CDN, so keep an internet connection for them to appear.\n\nExported from Sitezy.\n`,
    });
    const bytes = zipSync(files);
    const blob = new Blob([bytes], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(website.slug || website.name || "site")}-site.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}
