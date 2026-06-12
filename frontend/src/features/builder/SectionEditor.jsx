import { ChevronDown, Loader2 } from "lucide-react";
import api from "../../services/api.js";
import { useState } from "react";

/**
 * SectionEditor
 * Renders an inline form to edit props of a given section type.
 * Includes per-component color and font customization.
 */

const FONT_OPTIONS = ["Montserrat", "Google Sans", "Inter", "Roboto", "Outfit", "Playfair Display", "Poppins", "DM Sans"];

export default function SectionEditor({ section, onChange, pages = [] }) {
    const { type, props } = section;
    const [uploading, setUploading] = useState(false);

    const inputStyle = {
        width: "100%", padding: "8px 10px", borderRadius: "6px",
        background: "var(--bg-card)", border: "1px solid var(--border-color)",
        color: "var(--text-primary)", fontSize: "13px", outline: "none",
        marginTop: "4px",
    };

    const labelStyle = {
        fontSize: "11px", fontWeight: "600", color: "var(--text-muted)",
        textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginTop: "10px",
    };

    const handleChange = (key, value) => onChange({ [key]: value });

    const handleArrayChange = (key, index, value) => {
        const arr = [...(props[key] || [])];
        arr[index] = value;
        onChange({ [key]: arr });
    };

    const handleAddArrayItem = (key) => onChange({ [key]: [...(props[key] || []), "New Item"] });
    const handleRemoveArrayItem = (key, index) => {
        const arr = [...(props[key] || [])];
        arr.splice(index, 1);
        onChange({ [key]: arr });
    };

    const renderField = (label, key, type = "text", placeholder = "") => (
        <div key={key}>
            <label style={labelStyle}>{label}</label>
            {type === "textarea" ? (
                <textarea
                    value={props[key] || ""} rows={3}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={placeholder}
                    style={{ ...inputStyle, resize: "none" }}
                />
            ) : (
                <input
                    type={type} value={props[key] || ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={placeholder} style={inputStyle}
                />
            )}
        </div>
    );

    const renderArrayField = (label, key) => (
        <div key={key}>
            <label style={labelStyle}>{label}</label>
            {(props[key] || []).map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <input
                        value={item} onChange={(e) => handleArrayChange(key, i, e.target.value)}
                        style={{ ...inputStyle, marginTop: 0, flex: 1 }}
                    />
                    <button
                        onClick={() => handleRemoveArrayItem(key, i)}
                        style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", color: "#f87171", cursor: "pointer", padding: "0 8px", fontSize: "14px" }}
                    >×</button>
                </div>
            ))}
            <button
                onClick={() => handleAddArrayItem(key)}
                style={{ marginTop: "6px", fontSize: "12px", color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
                + Add item
            </button>
        </div>
    );

    const renderNavLinksField = (label, key) => (
        <div key={key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={labelStyle}>{label}</label>
                <button
                    onClick={() => {
                        if (pages && pages.length > 0) {
                            const newLinks = pages.map(p => ({
                                label: p.title,
                                url: `/${p.slug === 'home' ? '' : p.slug}`
                            }));
                            onChange({ [key]: newLinks });
                        }
                    }}
                    title="Overwrite links with your currently created pages"
                    style={{ background: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.3)", borderRadius: "4px", color: "#5eead4", fontSize: "10px", padding: "4px 8px", cursor: "pointer", fontWeight: 700 }}
                >
                    Auto-Fill Pages
                </button>
            </div>
            {(props[key] || []).map((item, i) => {
                const isObj = typeof item === 'object' && item !== null;
                const linkLabel = isObj ? item.label : item;
                const linkUrl = isObj ? item.url : `#${linkLabel.toLowerCase().replace(/\s/g, "-")}`;

                const updateItem = (field, val) => {
                    const arr = [...(props[key] || [])];
                    if (!isObj) arr[i] = { label: arr[i], url: linkUrl };
                    arr[i] = { ...arr[i], [field]: val };
                    onChange({ [key]: arr });
                };

                return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8, padding: 8, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 8 }}>
                        <div style={{ display: "flex", gap: 4 }}>
                            <input value={linkLabel} onChange={e => updateItem('label', e.target.value)} style={{ ...inputStyle, marginTop: 0, flex: 1 }} placeholder="Link Name" />
                            <button onClick={() => {
                                const arr = [...(props[key] || [])];
                                arr.splice(i, 1);
                                onChange({ [key]: arr });
                            }} style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", cursor: "pointer", padding: "0 8px", fontSize: "14px", border: "none", borderRadius: 4 }}>×</button>
                        </div>
                        <input value={linkUrl} onChange={e => updateItem('url', e.target.value)} style={{ ...inputStyle, marginTop: 0 }} placeholder="URL (e.g. /about or #section)" />
                    </div>
                );
            })}
            <button
                onClick={() => {
                    const arr = [...(props[key] || [])];
                    arr.push({ label: "New Link", url: "#" });
                    onChange({ [key]: arr });
                }}
                style={{ marginTop: "6px", fontSize: "12px", color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
                + Add Link
            </button>
        </div>
    );

    const renderCardsField = (label, key) => (
        <div key={key}>
            <label style={labelStyle}>{label}</label>
            {(props[key] || []).map((item, i) => {
                const isObj = typeof item === 'object' && item !== null;
                const title = isObj ? item.title : item;
                const description = isObj ? item.description : "";
                const image = isObj ? item.image : "";

                const updateItem = (field, val) => {
                    const arr = [...(props[key] || [])];
                    if (!isObj) arr[i] = { title: arr[i], description: "", image: "" };
                    arr[i] = { ...arr[i], [field]: val };
                    onChange({ [key]: arr });
                };

                return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8, padding: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8 }}>
                        <div style={{ display: "flex", gap: 4 }}>
                            <input value={title} onChange={e => updateItem('title', e.target.value)} style={{ ...inputStyle, marginTop: 0, flex: 1 }} placeholder="Title" />
                            <button onClick={() => handleRemoveArrayItem(key, i)} style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", cursor: "pointer", padding: "0 8px", fontSize: "14px", border: "none", borderRadius: 4 }}>×</button>
                        </div>
                        <input value={description} onChange={e => updateItem('description', e.target.value)} style={{ ...inputStyle, marginTop: 0 }} placeholder="Description" />
                        <div style={{ display: "flex", gap: 4 }}>
                            <input value={image} onChange={e => updateItem('image', e.target.value)} style={{ ...inputStyle, marginTop: 0, flex: 1 }} placeholder="Image URL" />
                            <button onClick={() => {
                                const fileInput = document.createElement("input");
                                fileInput.type = "file";
                                fileInput.accept = "image/*";
                                fileInput.onchange = async (e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    setUploading(true);
                                    try {
                                        const formData = new FormData();
                                        formData.append("image", file);
                                        const res = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
                                        if (res.data.success) {
                                            const fullUrl = res.data.url.startsWith("http") ? res.data.url : `http://localhost:5000${res.data.url}`;
                                            updateItem('image', fullUrl);
                                        }
                                    } finally {
                                        setUploading(false);
                                    }
                                };
                                fileInput.click();
                            }} style={{ background: "var(--color-primary)", color: "var(--bg-card)", border: "none", borderRadius: 4, padding: "0 8px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{uploading ? <Loader2 size={12} className="animate-spin" /> : "Upload"}</button>
                        </div>
                    </div>
                );
            })}
            <button
                onClick={() => {
                    const arr = [...(props[key] || [])];
                    arr.push({ title: "New Card", description: "Card description", image: "" });
                    onChange({ [key]: arr });
                }}
                style={{ marginTop: "6px", fontSize: "12px", color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
                + Add Card
            </button>
        </div>
    );

    const handleImageUpload = async (key, file) => {
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("image", file);
            const res = await api.post("/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            if (res.data.success) {
                // If it starts with /uploads, prepend the backend URL if we need to, 
                // but the sitezy.ai router usually handles relative paths via proxy or base url.
                // Let's use the full absolute URL for the image
                const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
                const base = backendUrl.replace("/api", "");
                handleChange(key, base + res.data.url);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    const renderImageField = (label, key) => (
        <div key={key} style={{ marginTop: 10 }}>
            <label style={labelStyle}>{label}</label>
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <input
                    type="text" value={props[key] || ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder="https://..." style={{ ...inputStyle, flex: 1, marginTop: 0 }}
                />
                <label style={{
                    background: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.3)", borderRadius: "6px", color: "var(--color-primary)", cursor: uploading ? "wait" : "pointer", padding: "0 10px", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap"
                }}>
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : "Upload"}
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(key, e.target.files[0])} style={{ display: "none" }} disabled={uploading} />
                </label>
            </div>
            {props[key] && props[key].length > 10 && (props[key].startsWith("http") || props[key].startsWith("data:")) && (
                <div style={{ marginTop: 8, borderRadius: 6, overflow: "hidden", height: 100, border: "1px solid var(--border-color)", background: "#000" }}>
                    <img src={props[key]} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }} />
                </div>
            )}
        </div>
    );

    const parseColor = (col, def) => {
        let c = col || def;
        if (typeof c !== 'string') return { hex: "#000000", alpha: 1 };
        if (c.startsWith("rgba")) {
            const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (m) {
                const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
                const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
                return { hex, alpha: m[4] !== undefined ? parseFloat(m[4]) : 1 };
            }
        }
        if (c.startsWith("#") && c.length === 9) {
            return { hex: c.substring(0, 7), alpha: parseInt(c.substring(7, 9), 16) / 255 };
        }
        return { hex: c.length === 7 || c.length === 4 ? c : "#000000", alpha: 1 };
    };

    const updateColorAlpha = (hexColor, alpha) => {
        if (alpha === 1) return hexColor;
        const hex = hexColor.replace("#", "");
        let r = 0, g = 0, b = 0;
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16); g = parseInt(hex[1] + hex[1], 16); b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 6) {
            r = parseInt(hex.substring(0, 2), 16); g = parseInt(hex.substring(2, 4), 16); b = parseInt(hex.substring(4, 6), 16);
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const renderSliderField = (label, key, min = 0, max = 100, step = 1, showVal = "") => (
        <div key={key} style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <label style={{ ...labelStyle, marginTop: 4 }}>{label}</label>
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{props[key] || 0}{showVal}</span>
            </div>
            <input
                type="range" min={min} max={max} step={step}
                value={props[key] || 0}
                onChange={(e) => handleChange(key, e.target.value)}
                style={{ width: "100%", cursor: "pointer", marginTop: 4 }}
            />
        </div>
    );

    const renderColorField = (label, key, defaultVal = "#14b8a6") => {
        const { hex, alpha } = parseColor(props[key], defaultVal);
        return (
            <div key={key} style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 }}>
                    <label style={{ ...labelStyle, marginTop: 0 }}>{label}</label>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{Math.round(alpha * 100)}% Opacity</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: props[key] || defaultVal,
                        position: "relative", overflow: "hidden", cursor: "pointer",
                        border: "1px solid rgba(255,255,255,0.15)",
                        boxShadow: `0 2px 8px ${hex}40`,
                    }}>
                        <input type="color" value={hex}
                            onChange={(e) => handleChange(key, updateColorAlpha(e.target.value, alpha))}
                            style={{ position: "absolute", inset: -8, width: 60, height: 60, cursor: "pointer", opacity: 0 }}
                        />
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                        <input
                            value={props[key] || defaultVal}
                            onChange={(e) => handleChange(key, e.target.value)}
                            placeholder={defaultVal}
                            style={{ ...inputStyle, marginTop: 0, fontFamily: "monospace", fontSize: 12, padding: "7px 10px" }}
                        />
                        <input type="range" min="0" max="1" step="0.05" value={alpha}
                            onChange={(e) => handleChange(key, updateColorAlpha(hex, parseFloat(e.target.value)))}
                            style={{ marginTop: 6, width: "100%", height: 4, cursor: "pointer" }}
                        />
                    </div>
                </div>
            </div>
        );
    };

    const renderFontField = () => (
        <div key="fontFamily">
            <label style={labelStyle}>Font Family</label>
            <div style={{ position: "relative", marginTop: 4 }}>
                <select
                    value={props.fontFamily || "Google Sans"}
                    onChange={(e) => handleChange("fontFamily", e.target.value)}
                    style={{
                        ...inputStyle, marginTop: 0, appearance: "none", cursor: "pointer",
                        fontFamily: props.fontFamily || "Google Sans",
                        paddingRight: 28,
                    }}
                >
                    {FONT_OPTIONS.map((f) => (
                        <option key={f} value={f} style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>{f}</option>
                    ))}
                </select>
                <div style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    pointerEvents: "none", opacity: 0.4,
                }}>
                    <ChevronDown size={12} />
                </div>
            </div>
        </div>
    );

    const renderVariantField = () => {
        const variants = {
            Navbar: ["Glassy Island", "Full Width Solid", "Minimal Transparent"],
            Hero: ["Split Text Left", "Centered Image Bg", "Split Text Right"],
            Text: ["Centered Standard", "Left Aligned Big", "Card Based"],
            Gallery: ["Bento Grid", "Masonry Column", "Horizontal Flex"],
            CTA: ["Centered Large", "Floating Pill", "Split Screen CTA"],
            ContactForm: ["Left Text Right Form", "Centered Card", "Minimal Left Form"],
            DynamicForm: ["Card Based", "Split Left Text"],
            Footer: ["Simple Centered", "Multi-Column Mock", "Ultra Minimal"],
            Button: ["Primary Pill", "Secondary Outline", "Ghost Action"],
            Image: ["Rounded Shadow", "Full Bleed Edge", "Circle Cropped"],
            Spacer: ["Standard", "Large", "Divider Line"]
        };
        const opts = variants[type] || ["Default", "Variant 2", "Variant 3"];
        return (
            <div key="variant" style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <label style={{ ...labelStyle, color: "var(--color-primary)", marginTop: 0 }}>Choose Design Template</label>
                <div style={{ position: "relative", marginTop: 8 }}>
                    <select
                        value={props.variant || opts[0]}
                        onChange={(e) => handleChange("variant", e.target.value)}
                        style={{ ...inputStyle, marginTop: 0, appearance: "none", cursor: "pointer", paddingRight: 28, background: "rgba(20,184,166,0.05)", border: "1px solid rgba(20,184,166,0.2)", fontSize: "14px", fontWeight: "600" }}
                    >
                        {opts.map((v) => <option key={v} value={v} style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>{v}</option>)}
                    </select>
                    <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", opacity: 0.8, color: "var(--color-primary)" }}>
                        <ChevronDown size={14} />
                    </div>
                </div>
            </div>
        );
    };

    /** Styling section common to all section types */
    const renderStyleControls = () => {
        const hasBgImage = !!props.backgroundImage;
        return (
            <div style={{
                marginTop: 16, paddingTop: 14,
                borderTop: "1px solid rgba(255,255,255,0.06)",
            }}>
                <p style={{
                    fontSize: "10px", fontWeight: 800, textTransform: "uppercase",
                    letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)",
                    marginBottom: 6, display: "flex", alignItems: "center", gap: 6,
                }}>
                    🎨 Style Controls
                </p>
                {hasBgImage ? (
                    <>
                        {renderSliderField("Background Dim", "bgDim", 0, 100, 1, "%")}
                        {renderSliderField("Background Blur", "bgBlur", 0, 50, 1, "px")}
                    </>
                ) : (
                    renderColorField("Background Color", "bgColor", "#0a0a14")
                )}
                {renderColorField("Text Color", "textColor", "#f0f0ff")}
                {renderColorField("Accent Color", "accentColor", "#14b8a6")}
                {renderColorField("Secondary Color", "secondaryColor", "#0ea5e9")}
                {renderFontField()}
            </div>
        );
    };

    const renderByType = () => {
        switch (type) {
            case "Navbar":
                return <>
                    {renderField("Brand Name", "brand", "text", "My Brand")}
                    <div style={{ marginTop: "16px", marginBottom: "8px" }}>
                        {renderNavLinksField("Navigation Links", "links")}
                    </div>
                </>;

            case "Hero":
                return <>
                    {renderField("Heading", "heading", "text", "Welcome to our site")}
                    {renderField("Subheading", "subheading", "text", "Your tagline")}
                    {renderField("CTA Button Text", "ctaText", "text", "Get Started")}
                    {renderField("CTA Link", "ctaLink", "text", "#")}
                    {renderImageField("Background Image", "backgroundImage")}
                </>;

            case "Text":
                return <>
                    {renderField("Heading", "heading", "text", "Section Title")}
                    {renderField("Content", "description", "textarea", "Write your content here...")}
                    {renderImageField("Background Image", "backgroundImage")}
                </>;

            case "Gallery":
                return <>
                    {renderField("Heading", "heading", "text", "Our Gallery")}
                    {renderCardsField("Cards / Gallery Items", "items")}
                    {renderImageField("Background Image", "backgroundImage")}
                </>;

            case "CTA":
                return <>
                    {renderField("Heading", "heading", "text", "Ready to get started?")}
                    {renderField("Subheading", "subheading", "text", "Join us today")}
                    {renderField("Button Text", "ctaText", "text", "Sign Up")}
                    {renderField("Button Link", "ctaLink", "text", "#")}
                    {renderImageField("Background Image", "backgroundImage")}
                </>;

            case "ContactForm":
                return <>
                    {renderField("Heading", "heading", "text", "Contact Us")}
                    {renderArrayField("Form Fields", "fields")}
                    {renderImageField("Background Image", "backgroundImage")}
                </>;

            case "DynamicForm":
                return <>
                    {renderField("Heading", "heading", "text", "Fill Details")}
                    {renderField("Description", "description", "textarea", "Please provide the following information.")}
                    {renderField("Submit Button Text", "submitText", "text", "Submit")}
                    {renderImageField("Background Image", "backgroundImage")}
                </>;

            case "Footer":
                return <>
                    {renderField("Footer Text", "text", "text", "© 2026 Company. All rights reserved.")}
                    {renderImageField("Background Image", "backgroundImage")}
                </>;

            case "Button":
                return <>
                    {renderField("Text", "text", "text", "Click Me")}
                    {renderField("Link", "link", "text", "#")}
                </>;

            case "Image":
                return <>
                    {renderImageField("Source URL", "src")}
                    {renderField("Alt text", "alt", "text", "Image")}
                </>;

            case "Spacer":
                return <>
                    {renderField("Height (e.g. 40px, 5vh)", "height", "text", "80px")}
                </>;

            default:
                return <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "8px" }}>No editable fields for this section.</p>;
        }
    };

    return (
        <div style={{ paddingTop: 8 }}>
            <p style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>
                Editing: {type}
            </p>
            {renderVariantField()}
            {renderByType()}
            {renderStyleControls()}
        </div>
    );
}
