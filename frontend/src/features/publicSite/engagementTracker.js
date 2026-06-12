/**
 * engagementTracker.js — lightweight visitor-behaviour tracker for published sites.
 *
 * Captures per-section dwell time (IntersectionObserver), scroll depth, CTA clicks, and
 * form start/submit, then batches a session via navigator.sendBeacon on tab hide/unload.
 * The data feeds later retraining of the GRU engagement model. Sections are discovered
 * via [data-sp-sec] / [data-sp-type] attributes the renderer adds.
 */
export function initEngagementTracker({ websiteId, pageId }) {
    if (!websiteId || typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
        return () => {};
    }
    const sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const sections = new Map(); // id -> {sectionType, tSpent, scrollDepth, ctaClick, formStart, formDone, _enter}
    let maxScroll = 0;
    let converted = false;
    let sent = false;

    const ensure = (el) => {
        const id = el.getAttribute("data-sp-sec");
        if (!sections.has(id)) {
            sections.set(id, {
                sectionType: el.getAttribute("data-sp-type") || "",
                tSpent: 0, scrollDepth: 0, ctaClick: false, formStart: false, formDone: false, _enter: null,
            });
        }
        return id;
    };

    const io = new IntersectionObserver((entries) => {
        const now = performance.now();
        entries.forEach((e) => {
            const id = e.target.getAttribute("data-sp-sec");
            const rec = sections.get(id);
            if (!rec) return;
            if (e.isIntersecting && rec._enter == null) rec._enter = now;
            else if (!e.isIntersecting && rec._enter != null) {
                rec.tSpent += (now - rec._enter) / 1000;
                rec._enter = null;
            }
        });
    }, { threshold: 0.4 });

    const observeAll = () => {
        document.querySelectorAll("[data-sp-sec]").forEach((el) => { ensure(el); io.observe(el); });
    };
    observeAll();
    const retry = setTimeout(observeAll, 1800); // content/images load async

    const onScroll = () => {
        const h = document.documentElement;
        const depth = (h.scrollTop + window.innerHeight) / Math.max(1, h.scrollHeight);
        maxScroll = Math.max(maxScroll, Math.min(1, depth));
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const CTA_RE = /(get|start|buy|book|sign|reserve|order|contact|subscribe|try|download|shop|join|learn more|view|explore|demo)/i;
    const onClick = (ev) => {
        const t = ev.target.closest && ev.target.closest("a,button");
        if (!t) return;
        const secEl = t.closest("[data-sp-sec]");
        const rec = secEl && sections.get(secEl.getAttribute("data-sp-sec"));
        if (rec && CTA_RE.test(t.textContent || "")) rec.ctaClick = true;
    };
    document.addEventListener("click", onClick, true);

    const onFocus = (ev) => {
        const f = ev.target;
        if (!f || !/^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName || "")) return;
        const secEl = f.closest && f.closest("[data-sp-sec]");
        const rec = secEl && sections.get(secEl.getAttribute("data-sp-sec"));
        if (rec) rec.formStart = true;
    };
    document.addEventListener("focusin", onFocus, true);

    const onSubmit = (ev) => {
        const secEl = ev.target && ev.target.closest && ev.target.closest("[data-sp-sec]");
        const rec = secEl && sections.get(secEl.getAttribute("data-sp-sec"));
        if (rec) rec.formDone = true;
        converted = true;
    };
    document.addEventListener("submit", onSubmit, true);

    const flush = () => {
        if (sent) return;
        const now = performance.now();
        const events = [];
        sections.forEach((rec, id) => {
            if (rec._enter != null) { rec.tSpent += (now - rec._enter) / 1000; rec._enter = null; }
            if (rec.tSpent > 0.2 || rec.ctaClick || rec.formStart) {
                events.push({
                    sectionId: id, sectionType: rec.sectionType,
                    tSpent: Math.round(rec.tSpent * 10) / 10,
                    scrollDepth: Math.round(maxScroll * 100) / 100,
                    ctaClick: rec.ctaClick, formStart: rec.formStart, formDone: rec.formDone,
                });
            }
        });
        if (!events.length) return;
        sent = true;
        try {
            const payload = JSON.stringify({ websiteId, pageId, sessionId, events, converted });
            const url = "/api/public/analytics/engagement";
            if (navigator.sendBeacon) {
                navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
            } else {
                fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
            }
        } catch { /* never throw from a tracker */ }
    };

    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);

    return () => {
        clearTimeout(retry);
        io.disconnect();
        window.removeEventListener("scroll", onScroll);
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("focusin", onFocus, true);
        document.removeEventListener("submit", onSubmit, true);
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("pagehide", flush);
    };
}
