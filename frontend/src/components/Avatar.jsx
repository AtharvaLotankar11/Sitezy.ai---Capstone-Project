import { avatarSrc } from "../utils/avatars.js";

// Shows the user's assigned illustrated avatar, falling back to their initial
// when no avatar key is present (e.g. legacy users created before avatars existed).
export default function Avatar({ user, size = 36, style = {}, fontWeight = 700 }) {
    const src = avatarSrc(user?.avatar);
    const base = {
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        border: "1px solid rgba(var(--fg),0.12)", ...style,
    };
    if (src) {
        return <img src={src} alt={user?.name || "User"} style={{ ...base, objectFit: "cover", display: "block", background: "var(--bg-input)" }} />;
    }
    return (
        <div style={{
            ...base, background: "#0d9488", display: "flex", alignItems: "center",
            justifyContent: "center", color: "#fff", fontWeight, fontSize: Math.round(size * 0.42),
        }}>
            {(user?.name?.[0] || "?").toUpperCase()}
        </div>
    );
}
