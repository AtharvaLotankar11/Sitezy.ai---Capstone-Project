import logoSrc from "./sitezy_logo.png";

/**
 * Sitezy brand logo — the glowing hex-gem mark (sitezy_logo.png) paired with a
 * Space Grotesk wordmark. The source PNG sits on a dark backdrop, so we composite
 * it with `mix-blend-mode: screen` to drop the background and keep only the glow,
 * which reads cleanly on any dark surface.
 *
 * Props:
 *  - size       : mark size in px (default 34)
 *  - showWord   : render the wordmark text (default true)
 *  - wordColor  : color of "sitezy" (default #fff)
 *  - fontSize   : wordmark font size (default 19)
 */
export default function Logo({ size = 34, showWord = true, wordColor = "#fff", fontSize = 19 }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="sz-logo-chip">
                <img
                    src={logoSrc}
                    alt="Sitezy"
                    width={size}
                    height={size}
                    style={{
                        width: size, height: size, flexShrink: 0,
                        objectFit: "contain",
                        mixBlendMode: "screen",
                        filter: "drop-shadow(0 2px 8px rgba(45,212,191,0.35))",
                    }}
                />
            </span>
            {showWord && (
                <span
                    className="font-display"
                    style={{ fontWeight: 600, fontSize, letterSpacing: "-0.04em", color: wordColor, lineHeight: 1 }}
                >
                    sitezy<span className="gradient-text" style={{ fontWeight: 700 }}>.ai</span>
                </span>
            )}
        </div>
    );
}
