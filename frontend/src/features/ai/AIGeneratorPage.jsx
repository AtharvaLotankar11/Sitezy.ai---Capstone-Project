import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import api from "../../services/api.js";
import DashboardLayout from "../../layouts/DashboardLayout.jsx";
import { fetchWebsites } from "../../store/slices/websiteSlice.js";
import toast from "react-hot-toast";
import {
    Wand2, Sparkles, Loader2, CheckCircle,
    Code2, Eye, ChevronDown, ChevronRight, LayoutTemplate, Globe, Mic
} from "lucide-react";
import { SECTION_MAP } from "../publicSite/PublicSiteRenderer.jsx";
import { updateTenantBranding } from "../../store/slices/authSlice.js";
import { TEMPLATES } from "../../utils/templates.js";

// ML section name → builder feature name
// Covers every key the Flask RandomForest model can return
const ML_SECTION_MAP = {
    // Hero variants
    hero_banner:        "Hero Banner",
    hero:               "Hero Banner",

    // Service / product
    service_cards:      "Service Cards",
    product_grid:       "Service Cards",

    // Team
    team_section:       "Team Section",
    team:               "Team Section",

    // Gallery
    gallery:            "Gallery",
    gallery_section:    "Gallery",

    // Testimonials
    testimonials:       "Testimonials",

    // FAQ
    faq:                "FAQ",

    // Pricing
    pricing_table:      "Pricing Table",
    pricing:            "Pricing Table",

    // Contact
    contact_form:       "Contact Form",
    contact_section:    "Contact Form",

    // Newsletter
    newsletter:         "Newsletter",

    // Blog
    blog_preview:       "Blog Preview",
    blog_section:       "Blog Preview",

    // Stats
    stats_counter:      "Stats Counter",
    stats:              "Stats Counter",

    // CTA
    call_to_action:     "Call to Action",
    cta:                "Call to Action",
    booking_section:    "Call to Action",

    // Implicit layout elements — map to nearest equivalent
    navbar:             "Hero Banner",
    footer:             "Contact Form",
};

// ── Hidden ML input quality mappings ─────────────────────────────────────────

// Base template name → ML business_type feature
const TEMPLATE_TO_BUSINESS_TYPE = {
    "Modern Minimalist":    "startup",
    "Vibrant SaaS":         "saas",
    "Dark Web3":            "startup",
    "Elegant Corporate":    "business_clients",
    "Restaurant & Food":    "restaurant",
    "Bold Creative Agency": "portfolio",
};

// UI tone label → ML experience_level feature
const TONE_TO_EXPERIENCE = {
    "Professional": "intermediate",
    "Friendly":     "beginner",
    "Bold":         "advanced",
    "Minimalist":   "intermediate",
    "Playful":      "beginner",
    "Luxury":       "advanced",
};

// UI audience label → ML target_audience feature
const AUDIENCE_MAP = {
    "General Public": "general_public",
    "Businesses":     "business_clients",
    "Developers":     "developers",
    "Creatives":      "members",
    "Students":       "students",
    "Executives":     "investors",
};

// UI purpose label → ML goal feature
const PURPOSE_TO_GOAL = {
    "Sell products":      "sales",
    "Generate leads":     "lead_generation",
    "Build brand":        "branding",
    "Showcase portfolio": "portfolio_showcase",
    "Allow bookings":     "booking",
    "Share content":      "content_delivery",
    "Educate users":      "education",
    "Promote events":     "awareness",
};

const PURPOSES = Object.keys(PURPOSE_TO_GOAL);

// ─────────────────────────────────────────────────────────────────────────────

const FEATURES = [
    "Hero Banner", "Service Cards", "Team Section", "Gallery", "Testimonials",
    "FAQ", "Pricing Table", "Contact Form", "Newsletter", "Blog Preview",
    "Stats Counter", "Call to Action",
];
const TONES = ["Professional", "Friendly", "Bold", "Minimalist", "Playful", "Luxury"];
const AUDIENCES = ["General Public", "Businesses", "Developers", "Creatives", "Students", "Executives"];

const inputStyle = {
    width: "100%", padding: "14px 18px", borderRadius: 14,
    background: "var(--bg-input)", border: "1px solid var(--border-color)",
    color: "var(--text-primary)", fontSize: 15, outline: "none",
    transition: "all 0.2s ease", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.15)",
};

export default function AIGeneratorPage() {
    const dispatch = useDispatch();
    const { websites } = useSelector((s) => s.website);
    const { tenant } = useSelector((s) => s.auth);
    const [form, setForm] = useState({
        businessType: "", tone: "Professional", targetAudience: "General Public",
        features: ["Hero Banner", "Contact Form"], websiteId: "",
        theme: "Light",
        primaryColor: tenant?.branding?.primaryColor || "#14b8a6",
        secondaryColor: tenant?.branding?.secondaryColor || "#0ea5e9",
        baseTemplateSections: null,
        websitePurpose: "Build brand",   // new — Website Purpose dropdown
        selectedTemplateName: null,       // tracks template name for ML business_type mapping
    });
    const [loading, setLoading] = useState(false);
    const [mlPredicting, setMlPredicting] = useState(false);
    const [mlPredicted, setMlPredicted] = useState(false);
    const [mlElapsed, setMlElapsed] = useState(0);
    const [activeModel, setActiveModel] = useState(null);
    const [result, setResult] = useState(null);
    const [activePageIdx, setActivePageIdx] = useState(0);
    const [inputLanguage, setInputLanguage] = useState("en");
    const [isListening, setIsListening] = useState(false);
    const [previewId, setPreviewId] = useState(null); // template id shown in the live-preview modal
    const [autoConfiguring, setAutoConfiguring] = useState(false); // AI is picking template/colors/tone/etc.
    const mlDebounceRef = useRef(null);
    const mlTimerRef = useRef(null);

    const TRANSLATION_LANGUAGES = [
        { code: "en", label: "English" },
        { code: "hi", label: "Hindi (हिंदी)" },
        { code: "mr", label: "Marathi (मराठी)" },
    ];

    const toggleFeature = (f) => {
        setMlPredicted(false); // user manually overriding
        setForm((p) => ({
            ...p,
            features: p.features.includes(f) ? p.features.filter((x) => x !== f) : [...p.features, f],
        }));
    };

    // ── Auto ML Prediction (live layout suggestions while typing) ─────────────
    useEffect(() => {
        // Don't fire until the user has typed something meaningful
        if (!form.businessType.trim()) {
            setMlPredicted(false);
            return;
        }

        // Clear any pending debounce
        if (mlDebounceRef.current) clearTimeout(mlDebounceRef.current);

        mlDebounceRef.current = setTimeout(async () => {
            setMlPredicting(true);
            setMlElapsed(0);

            // Elapsed-seconds ticker for the loading badge
            mlTimerRef.current = setInterval(
                () => setMlElapsed((s) => s + 1),
                1000
            );

            try {
                // ── Build structured ML payload from hidden mappings ──────────
                const payload = {
                    // concept: raw user text
                    concept: form.businessType.trim(),

                    // business_type: derived from selected template (falls back to raw text)
                    businessType: TEMPLATE_TO_BUSINESS_TYPE[form.selectedTemplateName] || form.businessType.trim(),

                    // tone → experience_level
                    tone: TONE_TO_EXPERIENCE[form.tone] || "intermediate",

                    // audience → normalised ML value
                    targetAudience: AUDIENCE_MAP[form.targetAudience] || "general_public",

                    // purpose → goal
                    goal: PURPOSE_TO_GOAL[form.websitePurpose] || "branding",
                };

                const res = await fetch("http://localhost:5050/generate-layout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) throw new Error(`ML service responded ${res.status}`);

                const data = await res.json();

                // Flask response: { success: true, components: ["hero_banner", ...] }
                if (!data.success) throw new Error("ML service returned success=false");

                const sections = Array.isArray(data.components) ? data.components : [];

                // Deduplicate while preserving order
                const mapped = [
                    ...new Set(
                        sections
                            .map((key) => ML_SECTION_MAP[key])
                            .filter(Boolean)
                    ),
                ];

                if (mapped.length > 0) {
                    setForm((prev) => ({ ...prev, features: mapped }));
                    setMlPredicted(true);
                }
            } catch (err) {
                // Silently degrade — user can still pick blocks manually
                console.warn("ML layout recommender unavailable:", err.message);
                setMlPredicted(false);
            } finally {
                setMlPredicting(false);
                clearInterval(mlTimerRef.current);
            }
        }, 600); // 600 ms debounce

        return () => {
            clearTimeout(mlDebounceRef.current);
            clearInterval(mlTimerRef.current);
        };
    }, [form.businessType, form.tone, form.targetAudience, form.websitePurpose, form.selectedTemplateName]);
    const handleVoiceInput = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error("Browser does not support voice input natively.");
            return;
        }

        const recognition = new SpeechRecognition();
        const langCode = inputLanguage === 'en' ? 'en-US' : (inputLanguage === 'hi' ? 'hi-IN' : 'mr-IN');
        recognition.lang = langCode;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
            toast.loading("Listening... Speak now", { id: "voice-toast" });
        };

        recognition.onresult = (event) => {
            let addText = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    addText += event.results[i][0].transcript + " ";
                }
            }
            if (addText.trim()) {
                setForm(p => ({ ...p, businessType: p.businessType + (p.businessType ? " " : "") + addText.trim() }));
                toast.success("Voice added!", { id: "voice-toast" });
            } else {
                toast.dismiss("voice-toast");
            }
        };

        recognition.onerror = (event) => {
            setIsListening(false);
            if (event.error !== 'no-speech') {
                toast.error("Voice input failed: " + event.error, { id: "voice-toast" });
            } else {
                toast.dismiss("voice-toast");
            }
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        try {
            recognition.start();
        } catch (e) {
            console.error(e);
            setIsListening(false);
            toast.dismiss("voice-toast");
        }
    };

    // ── Let Qwen (Ollama) auto-pick template, colors, tone, audience, theme & purpose ──
    const handleAutoConfigure = async () => {
        const concept = form.businessType.trim();
        if (!concept) { toast.error("Describe your concept first, then let AI configure it."); return; }
        setAutoConfiguring(true);
        try {
            const res = await api.post("/ai/auto-configure", {
                concept,
                templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description })),
                options: { tones: TONES, audiences: AUDIENCES, purposes: PURPOSES, themes: ["Light", "Dark"] },
            });
            const c = res.data?.config;
            if (!c) throw new Error("No config returned");
            const tpl = TEMPLATES.find((t) => t.id === c.templateId);
            setForm((p) => ({
                ...p,
                ...(tpl ? { baseTemplateSections: tpl.sections, selectedTemplateName: tpl.name } : {}),
                tone: c.tone || p.tone,
                targetAudience: c.audience || p.targetAudience,
                websitePurpose: c.purpose || p.websitePurpose,
                theme: c.theme || p.theme,
                primaryColor: c.primaryColor || p.primaryColor,
                secondaryColor: c.secondaryColor || p.secondaryColor,
            }));
            toast.success(c.reason ? `✨ ${tpl ? tpl.name + " — " : ""}${c.reason}` : "AI configured your settings ✨");
        } catch (err) {
            toast.error(err.response?.data?.message || "Auto-configure failed. Is the AI service running?");
        } finally {
            setAutoConfiguring(false);
        }
    };

    const handleGenerate = async (e, preferredModel = 'qwen') => {
        if (e) e.preventDefault();
        if (!form.businessType) return toast.error("Please describe your business");
        if (form.features.length === 0) return toast.error("Select at least one feature");
        setLoading(true); setResult(null); setActiveModel(preferredModel);

        let translatedConcept = form.businessType;

        if (inputLanguage !== "en") {
            try {
                const translatorAPI = self.translation || self.ai?.translator;
                if (translatorAPI && translatorAPI.createTranslator) {
                    const canTranslate = await translatorAPI.canTranslate({
                        sourceLanguage: inputLanguage,
                        targetLanguage: "en"
                    });
                    if (canTranslate !== "no") {
                        toast("Initializing AI Translator...", { icon: "🌐" });
                        const translator = await translatorAPI.createTranslator({
                            sourceLanguage: inputLanguage,
                            targetLanguage: "en"
                        });
                        translatedConcept = await translator.translate(form.businessType);
                        toast.success("Translation applied!");
                        console.log("Translated concept:", translatedConcept);
                    } else {
                        toast.error("Translation language pair not natively supported by browser. Sending raw text.");
                    }
                } else {
                    // Muted error notification: Browser Built-in AI Translation API not detected.
                }
            } catch (err) {
                console.error("Translation error:", err);
                toast.error("Translation failed, falling back to original input.");
            }
        }

        try {
            const res = await api.post("/ai/generate-website", { ...form, businessType: translatedConcept, autoPublish: false, preferredModel });
            setResult(res.data);
            toast.success("Layout generated! ✨");
            if (form.websiteId) {
                dispatch(fetchWebsites());
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "AI generation failed");
        } finally { setLoading(false); }
    };

    return (
        <DashboardLayout>
            <div style={{ maxWidth: 1600, margin: "0 auto", padding: "40px 40px 60px" }}>
                {/* Header */}
                <div style={{ marginBottom: 40 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
                            background: "var(--grad-brand)", color: "#fff", boxShadow: "0 8px 22px rgba(13,148,136,0.4)",
                        }}>
                            <Wand2 size={24} color="#fff" />
                        </div>
                        <h1 className="font-display" style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>AI Playground</h1>
                    </div>
                    <p style={{ fontSize: 16, color: "var(--text-secondary)", paddingLeft: 64 }}>
                        Powered by Sitezy's AI — Generate a complete, stunning website layout in seconds.
                    </p>
                </div>

                {/* Two Column Layout */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                    {/* Left: Form */}
                    <form style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        {/* Architect Details Card */}
                        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 32 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
                                <div style={{ padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.05)", color: "white" }}>
                                    <LayoutTemplate size={20} />
                                </div>
                                <h3 style={{ fontWeight: 700, fontSize: 20, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Architect Details</h3>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                                <div style={{ marginBottom: 8 }}>
                                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>Pick A Base Template</label>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxHeight: "240px", overflowY: "auto", paddingRight: 8 }}>
                                        {TEMPLATES.map((tmpl) => {
                                            const selected = form.baseTemplateSections === tmpl.sections;
                                            const swBg = tmpl.sections[0]?.props?.bgColor || "#111";
                                            const swAccent = (tmpl.sections.find(s => s.props?.accentColor) || tmpl.sections[0])?.props?.accentColor || "#14b8a6";
                                            return (
                                                <div key={tmpl.id} onClick={() => setForm(p => ({ ...p, baseTemplateSections: tmpl.sections, theme: tmpl.themeSelected, selectedTemplateName: tmpl.name }))} style={{
                                                    display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "11px 12px", borderRadius: "12px", cursor: "pointer",
                                                    border: selected ? "2px solid rgba(45,212,191,0.6)" : "1px solid rgba(255,255,255,0.1)",
                                                    background: selected ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.02)",
                                                    transition: "all 0.2s"
                                                }}>
                                                    <div style={{ display: "flex", gap: 11, alignItems: "center", minWidth: 0 }}>
                                                        <div style={{ width: 34, height: 34, borderRadius: 8, background: swBg, border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                            <span style={{ width: 14, height: 14, borderRadius: "50%", background: swAccent, boxShadow: "0 0 0 2px rgba(255,255,255,0.08)" }} />
                                                        </div>
                                                        <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tmpl.name}</div>
                                                    </div>
                                                    <button type="button" title="Live preview" onClick={(e) => { e.stopPropagation(); setPreviewId(tmpl.id); }} style={{
                                                        flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)",
                                                        color: selected ? "#5eead4" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s"
                                                    }}>
                                                        <Eye size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                        <label style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)" }}>
                                            Describe Your Concept *
                                        </label>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Input Lang:</span>
                                            <select
                                                value={inputLanguage}
                                                onChange={(e) => setInputLanguage(e.target.value)}
                                                style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "4px 8px", fontSize: 12, outline: "none", cursor: "pointer" }}
                                            >
                                                {TRANSLATION_LANGUAGES.map(lang => (
                                                    <option key={lang.code} value={lang.code} style={{ background: "#1e293b", color: "#fff" }}>{lang.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ position: "relative" }}>
                                        <textarea value={form.businessType} onChange={(e) => setForm((p) => ({ ...p, businessType: e.target.value }))}
                                            placeholder={inputLanguage === 'hi' ? "उदाहरण: एक आधुनिक स्टार्टअप जो स्लीक एआई एजेंट बनाता है..." : inputLanguage === 'mr' ? "उदाहरण: आधुनिक एआय एजंट्स तयार करणारी स्टार्टअप..." : "e.g. A futuristic startup building smart AI agents with a sleek, dark aesthetic..."}
                                            rows={4} required style={{ ...inputStyle, resize: "none", lineHeight: 1.6, paddingRight: 48 }} />
                                        <button
                                            type="button"
                                            onClick={handleVoiceInput}
                                            style={{
                                                position: "absolute", right: 12, bottom: 12,
                                                background: isListening ? "#ef4444" : "rgba(255,255,255,0.1)",
                                                color: "#fff", border: "none", borderRadius: "50%",
                                                width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                                                cursor: "pointer", transition: "all 0.2s",
                                                animation: isListening ? "pulse-glow 1.5s infinite" : "none"
                                            }}
                                            title="Use Voice Input"
                                        >
                                            <Mic size={16} />
                                        </button>
                                    </div>
                                    {inputLanguage !== 'en' && (
                                        <div style={{ fontSize: 11, color: "#5eead4", marginTop: 6, display: "flex", gap: 4, alignItems: "center" }}>
                                            <Globe size={12} />
                                            <span>Text will be translated to English locally via Browser AI before generating.</span>
                                        </div>
                                    )}
                                </div>

                                {/* AI auto-configure — let Qwen choose template, colors, tone, audience, theme & purpose */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                    <button type="button" onClick={handleAutoConfigure} disabled={autoConfiguring || !form.businessType.trim()}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                                            width: "100%", padding: "13px 18px", borderRadius: 14,
                                            cursor: (autoConfiguring || !form.businessType.trim()) ? "not-allowed" : "pointer",
                                            background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.3)",
                                            color: "#5eead4", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)",
                                            opacity: (!form.businessType.trim() && !autoConfiguring) ? 0.55 : 1, transition: "all 0.15s ease",
                                        }}
                                        onMouseEnter={(e) => { if (!autoConfiguring && form.businessType.trim()) e.currentTarget.style.background = "rgba(20,184,166,0.16)"; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(20,184,166,0.1)"; }}>
                                        {autoConfiguring ? <><Loader2 size={16} className="animate-spin" /> AI is configuring…</> : <><Sparkles size={16} strokeWidth={2.5} /> Auto-configure with AI</>}
                                    </button>
                                    <span style={{ fontSize: 11.5, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.4 }}>
                                        Let AI pick the template, colors, tone, audience, theme &amp; purpose from your description.
                                    </span>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                                    <div style={{ position: "relative" }}>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Tone</label>
                                        <select value={form.tone} onChange={(e) => setForm((p) => ({ ...p, tone: e.target.value }))}
                                            style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                                            {TONES.map((t) => <option key={t} value={t} style={{ background: "#1e293b", color: "#fff" }}>{t}</option>)}
                                        </select>
                                        <div style={{ position: "absolute", right: 16, bottom: 16, pointerEvents: "none", opacity: 0.4 }}><ChevronDown size={16} /></div>
                                    </div>
                                    <div style={{ position: "relative" }}>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Audience</label>
                                        <select value={form.targetAudience} onChange={(e) => setForm((p) => ({ ...p, targetAudience: e.target.value }))}
                                            style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                                            {AUDIENCES.map((a) => <option key={a} value={a} style={{ background: "#1e293b", color: "#fff" }}>{a}</option>)}
                                        </select>
                                        <div style={{ position: "absolute", right: 16, bottom: 16, pointerEvents: "none", opacity: 0.4 }}><ChevronDown size={16} /></div>
                                    </div>
                                    <div style={{ position: "relative" }}>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Theme Mode</label>
                                        <select value={form.theme} onChange={(e) => setForm((p) => ({ ...p, theme: e.target.value }))}
                                            style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                                            <option value="Light" style={{ background: "#1e293b", color: "#fff" }}>Light</option>
                                            <option value="Dark" style={{ background: "#1e293b", color: "#fff" }}>Dark</option>
                                        </select>
                                        <div style={{ position: "absolute", right: 16, bottom: 16, pointerEvents: "none", opacity: 0.4 }}><ChevronDown size={16} /></div>
                                    </div>
                                </div>

                                {/* Website Purpose — feeds ML goal feature */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                    <div style={{ position: "relative" }}>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
                                            Website Purpose
                                        </label>
                                        <select
                                            value={form.websitePurpose}
                                            onChange={(e) => setForm((p) => ({ ...p, websitePurpose: e.target.value }))}
                                            style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
                                        >
                                            {PURPOSES.map((p) => (
                                                <option key={p} value={p} style={{ background: "#1e293b", color: "#fff" }}>{p}</option>
                                            ))}
                                        </select>
                                        <div style={{ position: "absolute", right: 16, bottom: 16, pointerEvents: "none", opacity: 0.4 }}><ChevronDown size={16} /></div>
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                    <div>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Primary Color</label>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 14, padding: "8px" }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", position: "relative", flexShrink: 0 }}>
                                                <input type="color" value={form.primaryColor} onChange={(e) => setForm((p) => ({ ...p, primaryColor: e.target.value }))}
                                                    style={{ position: "absolute", inset: -8, width: 48, height: 48, cursor: "pointer", border: "none" }} />
                                            </div>
                                            <input type="text" value={form.primaryColor} onChange={(e) => setForm((p) => ({ ...p, primaryColor: e.target.value }))}
                                                style={{ border: "none", background: "transparent", color: "var(--text-primary)", fontSize: 15, outline: "none", width: "100%", fontFamily: "monospace" }} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Secondary Color</label>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 14, padding: "8px" }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", position: "relative", flexShrink: 0 }}>
                                                <input type="color" value={form.secondaryColor} onChange={(e) => setForm((p) => ({ ...p, secondaryColor: e.target.value }))}
                                                    style={{ position: "absolute", inset: -8, width: 48, height: 48, cursor: "pointer", border: "none" }} />
                                            </div>
                                            <input type="text" value={form.secondaryColor} onChange={(e) => setForm((p) => ({ ...p, secondaryColor: e.target.value }))}
                                                style={{ border: "none", background: "transparent", color: "var(--text-primary)", fontSize: 15, outline: "none", width: "100%", fontFamily: "monospace" }} />
                                        </div>
                                    </div>
                                </div>

                                {websites.length > 0 && (
                                    <div style={{ position: "relative" }}>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Apply Directly (Optional)</label>
                                        <select value={form.websiteId} onChange={(e) => setForm((p) => ({ ...p, websiteId: e.target.value }))}
                                            style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                                            <option value="" style={{ background: "#1e293b", color: "#fff" }}>— Preview Sandbox Only —</option>
                                            {websites.map((w) => <option key={w._id} value={w._id} style={{ background: "#1e293b", color: "#fff" }}>{w.name}</option>)}
                                        </select>
                                        <div style={{ position: "absolute", right: 16, bottom: 16, pointerEvents: "none", opacity: 0.4 }}><ChevronDown size={16} /></div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Feature Selection */}
                        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 24, padding: 32 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                                <h3 style={{ fontWeight: 700, fontSize: 20, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Required Blocks</h3>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {mlPredicting && (
                                        <span title="BART classifier runs on CPU — takes ~30-40s" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(20,184,166,0.15)", color: "#5eead4", padding: "5px 10px", borderRadius: 100, display: "flex", alignItems: "center", gap: 5 }}>
                                            <Loader2 size={10} className="animate-spin" /> AI predicting... {mlElapsed}s
                                        </span>
                                    )}
                                    {mlPredicted && !mlPredicting && (
                                        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(16,185,129,0.12)", color: "#10b981", padding: "5px 10px", borderRadius: 100, display: "flex", alignItems: "center", gap: 5 }}>
                                            <Sparkles size={10} /> AI predicted
                                        </span>
                                    )}
                                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", background: "rgba(20,184,166,0.12)", padding: "6px 12px", borderRadius: 100, color: "#5eead4", border: "1px solid rgba(20,184,166,0.28)" }}>
                                        {form.features.length} selected
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                {FEATURES.map((f) => {
                                    const sel = form.features.includes(f);
                                    return (
                                        <button key={f} type="button" onClick={() => toggleFeature(f)} style={{
                                            display: "flex", alignItems: "center", gap: 7,
                                            padding: "9px 18px", borderRadius: 100, fontSize: 14, fontWeight: 600,
                                            background: sel ? "var(--grad-btn)" : "var(--bg-input)",
                                            border: sel ? "1px solid rgba(255,255,255,0.12)" : "1px solid var(--border-color)",
                                            color: sel ? "#fff" : "var(--text-secondary)",
                                            cursor: "pointer", transition: "all 0.15s ease",
                                            boxShadow: sel ? "0 4px 12px rgba(8,90,72,0.35)" : "none",
                                        }}>
                                            {sel && <CheckCircle size={14} strokeWidth={3} />}
                                            {f}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Generate Buttons */}
                        <div style={{ display: "flex", gap: "16px" }}>
                            <button type="button" onClick={(e) => handleGenerate(e, 'qwen')} disabled={loading} className="saas-button" style={{
                                flex: 1, padding: "18px 0", borderRadius: 16, fontSize: 16,
                                opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer",
                            }}>
                                {loading ? <><Loader2 size={20} className="animate-spin" /> Cooking...</> : <><Sparkles size={20} strokeWidth={2.5} /> Generate with Basic AI</>}
                            </button>

                            <button type="button" onClick={(e) => handleGenerate(e, 'gemini')} disabled={loading} className="sz-btn-soft" style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                                padding: "18px 0", borderRadius: 16, fontSize: 16, fontWeight: 600, fontFamily: "var(--font-display)",
                                color: loading ? "var(--text-muted)" : "#5eead4",
                                cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
                            }}>
                                {loading ? <><Loader2 size={20} className="animate-spin" /> Cooking...</> : <><Wand2 size={20} strokeWidth={2.5} /> Generate with Pro AI</>}
                            </button>
                        </div>
                    </form>

                    {/* Right: Preview */}
                    <div>
                        {!result && !loading && (
                            <div style={{
                                background: "var(--bg-card)", border: "1px solid var(--border-color)",
                                borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                padding: 48, minHeight: 600, textAlign: "center",
                            }}>
                                <div style={{ padding: 28, borderRadius: "50%", background: "rgba(255,255,255,0.04)", marginBottom: 24, color: "rgba(255,255,255,0.15)" }}>
                                    <Wand2 size={56} strokeWidth={1.5} />
                                </div>
                                <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Awaiting Instructions</h2>
                                <p style={{ fontSize: 16, color: "var(--text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
                                    Describe your concept, select blocks, and watch our AI generate your layout.
                                </p>
                            </div>
                        )}

                        {loading && (
                            <div style={{
                                background: "var(--bg-card)", border: "1px solid var(--border-color)",
                                borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                padding: 48, minHeight: 600, textAlign: "center", position: "relative", overflow: "hidden",
                            }}>
                                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at center, #14b8a6 0%, transparent 60%)", opacity: 0.18 }} />
                                <div style={{
                                    width: 80, height: 80, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                                    background: "var(--grad-brand)", boxShadow: "0 12px 32px rgba(13,148,136,0.45)",
                                    marginBottom: 28,
                                    animation: "pulse-glow 2s ease-in-out infinite", position: "relative", zIndex: 1,
                                }}>
                                    <Sparkles size={36} color="#fff" className="animate-spin" style={{ animationDuration: "3s" }} />
                                </div>
                                <h2 className="font-display" style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)", position: "relative", zIndex: 1 }}>Engineering Layout...</h2>
                                <p style={{ fontSize: 15, color: "var(--text-secondary)", position: "relative", zIndex: 1 }}>{activeModel === 'gemini' ? 'Our Pro AI is designing' : 'Our Basic AI is designing'} your pages.</p>
                            </div>
                        )}

                        {result && (
                            <div style={{
                                background: "var(--bg-card)", border: "1px solid var(--border-color)",
                                borderRadius: 24, padding: 24, display: "flex", flexDirection: "column", height: "100%", minHeight: 600
                            }}>
                                {/* Success banner */}
                                <div style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    marginBottom: 20, background: "rgba(255,255,255,0.03)", padding: 16, borderRadius: 16,
                                    border: "1px solid rgba(255,255,255,0.06)", flexShrink: 0
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <div style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", padding: 8, borderRadius: "50%" }}>
                                            <CheckCircle size={20} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <h3 style={{ fontWeight: 700, fontSize: 18, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Generation Successful</h3>
                                            <p style={{ fontSize: 13, color: "#10b981", fontWeight: 500 }}>{result.layout?.pages?.length} Pages Designed</p>
                                        </div>
                                    </div>
                                    {result.savedToWebsite && (
                                        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800, background: "rgba(16,185,129,0.15)", color: "#10b981", padding: "6px 12px", borderRadius: 100 }}>
                                            Saved
                                        </span>
                                    )}
                                </div>

                                {/* Tabs */}
                                <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 16, overflowX: "auto", flexShrink: 0 }}>
                                    {result.layout?.pages?.map((page, i) => (
                                        <button key={i} onClick={() => setActivePageIdx(i)} style={{
                                            padding: "8px 16px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                                            background: activePageIdx === i ? "var(--grad-btn)" : "var(--bg-input)",
                                            color: activePageIdx === i ? "#fff" : "var(--text-secondary)",
                                            transition: "all 0.2s"
                                        }}>
                                            {page.title}
                                        </button>
                                    ))}
                                </div>

                                {/* Live Preview Full */}
                                <div style={{ flex: 1, background: "#0f0f1a", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", position: "relative" }}>
                                    <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
                                        <div style={{ pointerEvents: "none" }}>
                                            {result.layout?.pages[activePageIdx]?.sections.map((section, j) => {
                                                const Component = SECTION_MAP[section.type];
                                                if (!Component) return null;
                                                return <Component key={j} props={{ ...section.props, accentColor: form.primaryColor, secondaryColor: form.secondaryColor }} branding={{ font: tenant?.branding?.font || "Montserrat" }} />;
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {!result.savedToWebsite && (
                                    <div style={{ marginTop: 20, padding: 16, borderRadius: 16, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", textAlign: "center", flexShrink: 0 }}>
                                        <p style={{ fontSize: 14, fontWeight: 600, color: "#f59e0b" }}>
                                            ⚠️ Sandbox preview. Choose a project above to apply directly.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Live template preview modal (portaled to body to escape the layout stacking context) ── */}
            {previewId && (() => {
                const tpl = TEMPLATES.find(t => t.id === previewId);
                return createPortal((
                    <div onClick={() => setPreviewId(null)} style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(5,8,12,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                        <div onClick={(e) => e.stopPropagation()} style={{ width: "min(1180px, 94vw)", height: "90vh", background: "#0d1117", borderRadius: 20, border: "1px solid rgba(255,255,255,0.12)", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 40px 100px rgba(0,0,0,0.6)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                    <Eye size={18} style={{ color: "#5eead4", flexShrink: 0 }} />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{tpl?.name}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tpl?.description || "Live preview · scroll inside to explore"}</div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                                    <button type="button" onClick={() => { if (tpl) setForm(p => ({ ...p, baseTemplateSections: tpl.sections, theme: tpl.themeSelected, selectedTemplateName: tpl.name })); setPreviewId(null); toast.success(`"${tpl?.name}" selected`); }} className="saas-button" style={{ padding: "10px 20px", borderRadius: 10, fontSize: 14 }}>
                                        <CheckCircle size={16} strokeWidth={2.5} /> Use this template
                                    </button>
                                    <button type="button" onClick={() => setPreviewId(null)} title="Close" style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 20, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                                </div>
                            </div>
                            <iframe title={`${tpl?.name} preview`} src={`/preview/${previewId}`} style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
                        </div>
                    </div>
                ), document.body);
            })()}
        </DashboardLayout>
    );
}
