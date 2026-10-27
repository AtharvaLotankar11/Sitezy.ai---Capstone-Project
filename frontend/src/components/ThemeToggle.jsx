import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { getTheme, toggleTheme } from "../theme.js";

// Light/dark switch for the platform chrome. Persists to localStorage and flips the
// CSS token theme on <html>.
export default function ThemeToggle({ size = 16 }) {
    const [theme, setThemeState] = useState(getTheme());
    const onClick = () => setThemeState(toggleTheme());
    const isLight = theme === "light";
    return (
        <button
            onClick={onClick}
            title={isLight ? "Switch to dark mode" : "Switch to light mode"}
            aria-label="Toggle color theme"
            style={{
                width: 36, height: 36, borderRadius: 10, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(var(--fg),0.05)", border: "1px solid var(--border-color)",
                color: "var(--text-secondary)", transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(var(--fg),0.1)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(var(--fg),0.05)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
        >
            {isLight ? <Moon size={size} /> : <Sun size={size} />}
        </button>
    );
}
