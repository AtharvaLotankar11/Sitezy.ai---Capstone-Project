// Platform light/dark theme. Sets `data-theme` on <html>; index.css tokens flip
// (including the --fg foreground channel that re-tints every rgba(var(--fg),a) overlay).
const KEY = "sitezy-theme";

export function getTheme() {
    try { return localStorage.getItem(KEY) || "dark"; } catch { return "dark"; }
}

export function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
}

export function setTheme(theme) {
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
    applyTheme(theme);
    window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

export function toggleTheme() {
    const next = getTheme() === "light" ? "dark" : "light";
    setTheme(next);
    return next;
}

// Call once at startup (before/at render) so there's no flash.
// Honors a ?theme=light|dark URL override (handy for shareable links).
export function initTheme() {
    try {
        const q = new URLSearchParams(window.location.search).get("theme");
        if (q === "light" || q === "dark") { setTheme(q); return; }
    } catch { /* ignore */ }
    applyTheme(getTheme());
}
