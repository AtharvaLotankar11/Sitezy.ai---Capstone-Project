import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import api from "../../services/api.js";
import DashboardLayout from "../../layouts/DashboardLayout.jsx";
import webDesignIcon from "../../components/icons/web-design_16603388.png";

// Tint the (blue) web-design template icon toward each template's accent color while
// keeping its detail — by rotating its hue from blue (~210°) to the accent's hue.
function hexToHsl(hex) {
    let h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return [210, 0.5, 0.5];
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let hue = 0;
    if (d) {
        if (max === r) hue = ((g - b) / d) % 6;
        else if (max === g) hue = (b - r) / d + 2;
        else hue = (r - g) / d + 4;
        hue *= 60; if (hue < 0) hue += 360;
    }
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return [hue, s, l];
}
function templateIconFilter(hex) {
    const [hue, s] = hexToHsl(hex);
    if (s < 0.12) return "saturate(0.15) brightness(1.2)"; // near-gray accent → neutral icon
    const rot = Math.round((((hue - 210) % 360) + 360) % 360);
    return `hue-rotate(${rot}deg) saturate(1.25)`;
}
import { fetchWebsites } from "../../store/slices/websiteSlice.js";
import toast from "react-hot-toast";
import {
    Wand2, Sparkles, Loader2, CheckCircle,
    Code2, Eye, ChevronDown, ChevronRight, LayoutTemplate, Globe, Mic, ArrowRight,
    SlidersHorizontal, X
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
        brandDetails: {},                 // confirmed facts from the Prompt Tuner
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
    // ── Prompt Tuner: AI-written, business-specific questions answered before generating ──
    const [tuneOpen, setTuneOpen] = useState(false);
    const [tuneLoading, setTuneLoading] = useState(false);
    const [tuneQuestions, setTuneQuestions] = useState([]);
    const [tuneAnswers, setTuneAnswers] = useState({});   // field → string | string[]
    const [tuneCustom, setTuneCustom] = useState({});     // field → "Other…" free text
    const [tuneConcept, setTuneConcept] = useState("");   // concept the questions were written for
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

    // ── Prompt Tuner ──────────────────────────────────────────────────────────
    // Asks the AI for a handful of questions specific to THIS business, so the
    // generated copy carries the owner's real tagline, address and reviews.
    const TUNE_FIELD_TITLES = {
        tagline: "Tagline", positioning: "Positioning", usp: "Differentiator",
        services: "Services", reviews: "Reviews", address: "Address",
        hours: "Opening hours", cta: "Call to action",
    };

    const loadTuneQuestions = async (concept) => {
        setTuneLoading(true);
        try {
            const res = await api.post("/ai/tune-questions", {
                concept,
                businessType: TEMPLATE_TO_BUSINESS_TYPE[form.selectedTemplateName] || "",
                tone: form.tone,
                audience: form.targetAudience,
            });
            const qs = Array.isArray(res.data?.questions) ? res.data.questions : [];
            if (qs.length === 0) throw new Error("No questions returned");
            setTuneQuestions(qs);
            setTuneConcept(concept);
        } catch (err) {
            toast.error(err.response?.data?.message || "Couldn't build the questions. Is the AI service running?");
            setTuneOpen(false);
        } finally {
            setTuneLoading(false);
        }
    };

    const handleOpenTuner = async (forceNew = false) => {
        const concept = form.businessType.trim();
        if (!concept) { toast.error("Describe your concept first, then tune it."); return; }
        setTuneOpen(true);
        // Reuse the existing set (and the answers already given) unless the concept changed
        if (!forceNew && tuneQuestions.length > 0 && tuneConcept === concept) return;
        await loadTuneQuestions(concept);
    };

    const pickTuneOption = (field, opt) =>
        setTuneAnswers((p) => ({ ...p, [field]: p[field] === opt ? "" : opt }));

    const toggleTuneOption = (field, opt) =>
        setTuneAnswers((p) => {
            const cur = Array.isArray(p[field]) ? p[field] : [];
            return { ...p, [field]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
        });

    // Collapse the per-question answers into the flat { field: value } map the backend expects.
    const collapseTuneAnswers = () => {
        const details = {};
        for (const q of tuneQuestions) {
            const custom = (tuneCustom[q.field] || "").trim();
            const ans = tuneAnswers[q.field];
            if (q.type === "multi") {
                const picked = Array.isArray(ans) ? ans.filter(Boolean) : [];
                const all = custom ? [...picked, custom] : picked;
                if (all.length) details[q.field] = all;
            } else {
                // A custom answer overrides the AI's suggestions
                const v = custom || (typeof ans === "string" ? ans.trim() : "");
                if (v) details[q.field] = v;
            }
        }
        return details;
    };

    const handleApplyTune = () => {
        const details = collapseTuneAnswers();
        setForm((p) => ({ ...p, brandDetails: details }));
        setTuneOpen(false);
        const n = Object.keys(details).length;
        toast.success(n ? `Tuned ✨ ${n} brand fact${n > 1 ? "s" : ""} will be used verbatim` : "Tuning cleared — AI will write everything itself");
    };

    const tunedFields = Object.keys(form.brandDetails || {});

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
            <style>{`
                .ai-tpl-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
                .ai-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
                /* Describe-concept beside the template picker; required-blocks beside the generate buttons */
                .ai-concept-row { display: grid; grid-template-columns: 1.35fr 1fr; gap: 18px; align-items: stretch; }
                .ai-blocks-row { display: grid; grid-template-columns: 1.6fr 1fr; gap: 18px; align-items: stretch; }
                .ai-tpl-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; max-height: 192px; overflow-y: auto; padding-right: 6px; }
                @media (max-width: 900px) { .ai-concept-row, .ai-blocks-row { grid-template-columns: 1fr; } }
                @media (max-width: 1100px) { .ai-tpl-grid { grid-template-columns: repeat(3, 1fr); } }
                @media (max-width: 900px) {
                    .ai-twocol { grid-template-columns: 1fr !important; }
                    .ai-page-pad { padding: 28px 18px 48px !important; }
                    .ai-grid-4 { grid-template-columns: repeat(2, 1fr); }
                }
                @media (max-width: 640px) {
                    .ai-grid-3, .ai-grid-3b, .ai-grid-2, .ai-tpl-grid, .ai-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
                }
                @media (max-width: 440px) {
                    .ai-grid-3, .ai-grid-3b, .ai-grid-2, .ai-grid-4 { grid-template-columns: 1fr !important; }
                }
            `}</style>
            <div className="ai-page-pad" style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 40px 56px" }}>
                {/* Header */}
                <div style={{ marginBottom: 26 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
                        <div style={{
                            width: 42, height: 42, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center",
                            background: "var(--grad-brand)", color: "#fff", boxShadow: "0 8px 22px rgba(13,148,136,0.4)",
                        }}>
                            <Wand2 size={22} color="#fff" />
                        </div>
                        <h1 className="font-display" style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>AI Playground</h1>
                    </div>
                    <p style={{ fontSize: 14.5, color: "var(--text-secondary)", paddingLeft: 56 }}>
                        Powered by Sitezy's AI — Generate a complete, stunning website layout in seconds.
                    </p>
                </div>

                {/* Stacked layout: full-width form on top, generated preview below */}
                <div className="ai-twocol" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
                    {/* Form */}
                    <form style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        {/* Architect Details Card */}
                        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 20, padding: 24 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                                <div style={{ padding: 9, borderRadius: 11, background: "rgba(var(--fg),0.05)", color: "white" }}>
                                    <LayoutTemplate size={19} />
                                </div>
                                <h3 style={{ fontWeight: 700, fontSize: 18, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Architect Details</h3>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                                {/* 1 + 2 — Describe (left) beside the base-template picker (right) */}
                                <div className="ai-concept-row">
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                        <label style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.4)" }}>
                                            Describe Your Concept *
                                        </label>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Input Lang:</span>
                                            <select
                                                value={inputLanguage}
                                                onChange={(e) => setInputLanguage(e.target.value)}
                                                style={{ background: "rgba(var(--fg),0.05)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "4px 8px", fontSize: 12, outline: "none", cursor: "pointer" }}
                                            >
                                                {TRANSLATION_LANGUAGES.map(lang => (
                                                    <option key={lang.code} value={lang.code} style={{ background: "#1e293b", color: "#fff" }}>{lang.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ position: "relative", flex: 1, minHeight: 170 }}>
                                        <textarea value={form.businessType} onChange={(e) => setForm((p) => ({ ...p, businessType: e.target.value }))}
                                            placeholder={inputLanguage === 'hi' ? "उदाहरण: एक आधुनिक स्टार्टअप जो स्लीक एआई एजेंट बनाता है..." : inputLanguage === 'mr' ? "उदाहरण: आधुनिक एआय एजंट्स तयार करणारी स्टार्टअप..." : "e.g. A futuristic startup building smart AI agents with a sleek, dark aesthetic..."}
                                            required style={{ ...inputStyle, resize: "none", lineHeight: 1.6, paddingBottom: 52, height: "100%", minHeight: 170 }} />
                                        {/* Inline action row — voice + AI auto-configure, right-aligned like a chat composer's send */}
                                        <div style={{ position: "absolute", left: 12, right: 12, bottom: 10, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                                            <button
                                                type="button"
                                                onClick={handleVoiceInput}
                                                title="Use Voice Input"
                                                style={{
                                                    background: isListening ? "#ef4444" : "rgba(var(--fg),0.12)",
                                                    color: "#fff", border: "none", borderRadius: "50%",
                                                    width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                                                    cursor: "pointer", transition: "all 0.2s", flexShrink: 0,
                                                    animation: isListening ? "pulse-glow 1.5s infinite" : "none"
                                                }}>
                                                <Mic size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenTuner(false)}
                                                disabled={!form.businessType.trim()}
                                                title="Answer a few AI-written questions about your business so the site uses your real tagline, address and reviews"
                                                style={{
                                                    display: "inline-flex", alignItems: "center", gap: 7,
                                                    padding: "7px 14px", borderRadius: 100,
                                                    border: tunedFields.length ? "1px solid rgba(16,185,129,0.45)" : "1px solid rgba(139,92,246,0.35)",
                                                    background: tunedFields.length ? "rgba(16,185,129,0.12)" : "rgba(139,92,246,0.12)",
                                                    color: tunedFields.length ? "#10b981" : "#a78bfa",
                                                    fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-display)",
                                                    cursor: !form.businessType.trim() ? "not-allowed" : "pointer",
                                                    opacity: !form.businessType.trim() ? 0.5 : 1, transition: "all 0.15s ease", whiteSpace: "nowrap",
                                                }}>
                                                {tunedFields.length
                                                    ? <><CheckCircle size={14} strokeWidth={2.5} /> Tuned · {tunedFields.length}</>
                                                    : <><SlidersHorizontal size={14} strokeWidth={2.5} /> Tune with AI</>}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleAutoConfigure}
                                                disabled={autoConfiguring || !form.businessType.trim()}
                                                title="Let AI pick the template, colors, tone, audience, theme & purpose from your description"
                                                style={{
                                                    display: "inline-flex", alignItems: "center", gap: 7,
                                                    padding: "7px 14px", borderRadius: 100, border: "1px solid rgba(20,184,166,0.35)",
                                                    background: autoConfiguring ? "rgba(20,184,166,0.18)" : "rgba(20,184,166,0.12)",
                                                    color: "var(--text-accent)", fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-display)",
                                                    cursor: (autoConfiguring || !form.businessType.trim()) ? "not-allowed" : "pointer",
                                                    opacity: (!form.businessType.trim() && !autoConfiguring) ? 0.5 : 1, transition: "all 0.15s ease",
                                                }}
                                                onMouseEnter={(e) => { if (!autoConfiguring && form.businessType.trim()) e.currentTarget.style.background = "rgba(20,184,166,0.2)"; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = autoConfiguring ? "rgba(20,184,166,0.18)" : "rgba(20,184,166,0.12)"; }}>
                                                {autoConfiguring ? <><Loader2 size={14} className="animate-spin" /> Configuring…</> : <><Sparkles size={14} strokeWidth={2.5} /> AI auto configure</>}
                                            </button>
                                        </div>
                                    </div>
                                    {inputLanguage !== 'en' && (
                                        <div style={{ fontSize: 11, color: "var(--text-accent)", marginTop: 6, display: "flex", gap: 4, alignItems: "center" }}>
                                            <Globe size={12} />
                                            <span>Text will be translated to English locally via Browser AI before generating.</span>
                                        </div>
                                    )}
                                    {/* Facts locked in by the tuner — click any chip to edit them */}
                                    {tunedFields.length > 0 && (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 8 }}>
                                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Using your own</span>
                                            {tunedFields.map((f) => (
                                                <button key={f} type="button" onClick={() => handleOpenTuner(false)} title="Edit tuned answers" style={{
                                                    fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 100, cursor: "pointer",
                                                    background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)",
                                                }}>
                                                    {TUNE_FIELD_TITLES[f] || f}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* 2 — Base template (right column, 2×2 scrollable) */}
                                <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
                                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.4)", marginBottom: 12 }}>Pick A Base Template</label>
                                    <div className="ai-tpl-2">
                                        {TEMPLATES.map((tmpl) => {
                                            const selected = form.baseTemplateSections === tmpl.sections;
                                            const swBg = tmpl.sections[0]?.props?.bgColor || "#111";
                                            const swAccent = (tmpl.sections.find(s => s.props?.accentColor) || tmpl.sections[0])?.props?.accentColor || "#14b8a6";
                                            return (
                                                <div key={tmpl.id} onClick={() => setForm(p => ({ ...p, baseTemplateSections: tmpl.sections, theme: tmpl.themeSelected, selectedTemplateName: tmpl.name }))} style={{
                                                    display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "11px 12px", borderRadius: "12px", cursor: "pointer",
                                                    border: selected ? "2px solid rgba(45,212,191,0.6)" : "1px solid rgba(var(--fg),0.1)",
                                                    background: selected ? "rgba(20,184,166,0.08)" : "rgba(var(--fg),0.02)",
                                                    transition: "all 0.2s"
                                                }}>
                                                    <div style={{ display: "flex", gap: 11, alignItems: "center", minWidth: 0 }}>
                                                        <div style={{ width: 34, height: 34, borderRadius: 8, background: swBg, border: "1px solid rgba(var(--fg),0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                            <img src={webDesignIcon} alt="" style={{ width: 22, height: 22, objectFit: "contain", filter: templateIconFilter(swAccent) }} />
                                                        </div>
                                                        <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tmpl.name}</div>
                                                    </div>
                                                    <button type="button" title="Live preview" onClick={(e) => { e.stopPropagation(); setPreviewId(tmpl.id); }} style={{
                                                        flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(var(--fg),0.14)", background: "rgba(var(--fg),0.05)",
                                                        color: selected ? "var(--text-accent)" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s"
                                                    }}>
                                                        <Eye size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                </div>

                                {/* 3 — Tone · Audience · Theme · Purpose (one row) */}
                                <div className="ai-grid-4">
                                    {[
                                        { label: "Tone", value: form.tone, key: "tone", opts: TONES },
                                        { label: "Audience", value: form.targetAudience, key: "targetAudience", opts: AUDIENCES },
                                        { label: "Theme Mode", value: form.theme, key: "theme", opts: ["Light", "Dark"] },
                                        { label: "Website Purpose", value: form.websitePurpose, key: "websitePurpose", opts: PURPOSES },
                                    ].map(({ label, value, key, opts }) => (
                                        <div key={key} style={{ position: "relative" }}>
                                            <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.4)", marginBottom: 8 }}>{label}</label>
                                            <select value={value} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                                                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                                                {opts.map((o) => <option key={o} value={o} style={{ background: "#1e293b", color: "#fff" }}>{o}</option>)}
                                            </select>
                                            <div style={{ position: "absolute", right: 14, bottom: 15, pointerEvents: "none", opacity: 0.4 }}><ChevronDown size={16} /></div>
                                        </div>
                                    ))}
                                </div>

                                {/* 4 — Primary · Secondary · Apply target (one row) */}
                                <div className="ai-grid-3b" style={{ display: "grid", gridTemplateColumns: websites.length > 0 ? "1fr 1fr 1fr" : "1fr 1fr", gap: 14 }}>
                                    <div>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.4)", marginBottom: 8 }}>Primary Color</label>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 14, padding: "8px", height: 50 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", position: "relative", flexShrink: 0 }}>
                                                <input type="color" value={form.primaryColor} onChange={(e) => setForm((p) => ({ ...p, primaryColor: e.target.value }))}
                                                    style={{ position: "absolute", inset: -8, width: 48, height: 48, cursor: "pointer", border: "none" }} />
                                            </div>
                                            <input type="text" value={form.primaryColor} onChange={(e) => setForm((p) => ({ ...p, primaryColor: e.target.value }))}
                                                style={{ border: "none", background: "transparent", color: "var(--text-primary)", fontSize: 15, outline: "none", width: "100%", fontFamily: "monospace" }} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.4)", marginBottom: 8 }}>Secondary Color</label>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 14, padding: "8px", height: 50 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", position: "relative", flexShrink: 0 }}>
                                                <input type="color" value={form.secondaryColor} onChange={(e) => setForm((p) => ({ ...p, secondaryColor: e.target.value }))}
                                                    style={{ position: "absolute", inset: -8, width: 48, height: 48, cursor: "pointer", border: "none" }} />
                                            </div>
                                            <input type="text" value={form.secondaryColor} onChange={(e) => setForm((p) => ({ ...p, secondaryColor: e.target.value }))}
                                                style={{ border: "none", background: "transparent", color: "var(--text-primary)", fontSize: 15, outline: "none", width: "100%", fontFamily: "monospace" }} />
                                        </div>
                                    </div>
                                    {websites.length > 0 && (
                                        <div style={{ position: "relative" }}>
                                            <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.4)", marginBottom: 8 }}>Apply To</label>
                                            <select value={form.websiteId} onChange={(e) => setForm((p) => ({ ...p, websiteId: e.target.value }))}
                                                style={{ ...inputStyle, appearance: "none", cursor: "pointer", height: 50 }}>
                                                <option value="" style={{ background: "#1e293b", color: "#fff" }}>— Preview Sandbox Only —</option>
                                                {websites.map((w) => <option key={w._id} value={w._id} style={{ background: "#1e293b", color: "#fff" }}>{w.name}</option>)}
                                            </select>
                                            <div style={{ position: "absolute", right: 14, bottom: 17, pointerEvents: "none", opacity: 0.4 }}><ChevronDown size={16} /></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Required Blocks (left) beside the generate buttons (right) */}
                        <div className="ai-blocks-row">
                        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 20, padding: 24 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                                <h3 style={{ fontWeight: 700, fontSize: 18, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Required Blocks</h3>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {mlPredicting && (
                                        <span title="BART classifier runs on CPU — takes ~30-40s" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(20,184,166,0.15)", color: "var(--text-accent)", padding: "5px 10px", borderRadius: 100, display: "flex", alignItems: "center", gap: 5 }}>
                                            <Loader2 size={10} className="animate-spin" /> AI predicting... {mlElapsed}s
                                        </span>
                                    )}
                                    {mlPredicted && !mlPredicting && (
                                        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(16,185,129,0.12)", color: "#10b981", padding: "5px 10px", borderRadius: 100, display: "flex", alignItems: "center", gap: 5 }}>
                                            <Sparkles size={10} /> AI predicted
                                        </span>
                                    )}
                                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", background: "rgba(20,184,166,0.12)", padding: "6px 12px", borderRadius: 100, color: "var(--text-accent)", border: "1px solid rgba(20,184,166,0.28)" }}>
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
                                            border: sel ? "1px solid rgba(var(--fg),0.12)" : "1px solid var(--border-color)",
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

                        {/* Generate Buttons — compact Basic on top, feature-rich Pro filling the rest */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <button type="button" onClick={(e) => handleGenerate(e, 'qwen')} disabled={loading} className="saas-button" style={{
                                width: "100%", padding: "15px 0", borderRadius: 16, fontSize: 15.5,
                                opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer",
                            }}>
                                {loading ? <><Loader2 size={19} className="animate-spin" /> Cooking...</> : <><Sparkles size={19} strokeWidth={2.5} /> Generate with Basic AI</>}
                            </button>

                            <button type="button" onClick={(e) => handleGenerate(e, 'gemini')} disabled={loading} className="sz-btn-soft" style={{
                                flex: 1, width: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 14,
                                padding: "22px 24px", borderRadius: 16, textAlign: "left",
                                border: "1px solid rgba(20,184,166,0.32)", transition: "all 0.2s ease",
                                cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
                            }}
                                onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(45,212,191,0.6)"; e.currentTarget.style.boxShadow = "0 12px 30px rgba(13,148,136,0.22)"; e.currentTarget.style.background = "rgba(20,184,166,0.08)"; } }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "rgba(20,184,166,0.32)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = ""; }}>
                                {loading ? (
                                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 16, fontWeight: 600, color: "var(--text-accent)", fontFamily: "var(--font-display)" }}>
                                        <Loader2 size={20} className="animate-spin" /> Cooking...
                                    </span>
                                ) : (
                                    <>
                                        <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16.5, fontWeight: 700, color: "var(--text-accent)", fontFamily: "var(--font-display)" }}>
                                            <Wand2 size={20} strokeWidth={2.5} /> Generate with Pro AI
                                            <ArrowRight size={18} style={{ marginLeft: "auto", opacity: 0.85 }} />
                                        </span>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                                            {["Generated faster, in less time", "Sharper, better-written content", "More relevant images"].map((t) => (
                                                <span key={t} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}>
                                                    <CheckCircle size={15} strokeWidth={2.5} style={{ color: "var(--text-accent)", flexShrink: 0 }} /> {t}
                                                </span>
                                            ))}
                                        </div>
                                        <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-accent)", opacity: 0.75 }}>Tap to generate →</span>
                                    </>
                                )}
                            </button>
                        </div>
                        </div>
                    </form>

                    {/* Right: Preview */}
                    <div>
                        {!result && !loading && (
                            <div style={{
                                background: "var(--bg-card)", border: "1px solid var(--border-color)",
                                borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                padding: 44, minHeight: 380, textAlign: "center",
                            }}>
                                <div style={{ padding: 24, borderRadius: "50%", background: "rgba(var(--fg),0.04)", marginBottom: 20, color: "rgba(var(--fg),0.15)" }}>
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
                                padding: 44, minHeight: 380, textAlign: "center", position: "relative", overflow: "hidden",
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
                                    marginBottom: 20, background: "rgba(var(--fg),0.03)", padding: 16, borderRadius: 16,
                                    border: "1px solid rgba(var(--fg),0.06)", flexShrink: 0
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
                                <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid rgba(var(--fg),0.08)", paddingBottom: 16, overflowX: "auto", flexShrink: 0 }}>
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
                                <div style={{ flex: 1, background: "#0f0f1a", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(var(--fg),0.08)", position: "relative" }}>
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

            {/* ── Prompt Tuner modal — AI-written questions about the user's actual business ── */}
            {tuneOpen && (() => {
                const answered = Object.keys(collapseTuneAnswers()).length;
                return createPortal((
                    <div onClick={() => setTuneOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(5,8,12,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                        <div onClick={(e) => e.stopPropagation()} style={{ width: "min(760px, 94vw)", maxHeight: "90vh", background: "var(--bg-card, #0d1117)", borderRadius: 20, border: "1px solid rgba(var(--fg),0.12)", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 40px 100px rgba(0,0,0,0.6)" }}>

                            {/* Header */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 22px", borderBottom: "1px solid rgba(var(--fg),0.08)", flexShrink: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <SlidersHorizontal size={18} style={{ color: "#a78bfa" }} />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 16.5, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Tune your website content</div>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {tuneLoading ? "Writing questions for your business…" : "Your answers are used word for word — anything you skip, the AI writes itself."}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                    <button type="button" onClick={() => handleOpenTuner(true)} disabled={tuneLoading} title="Ask the AI for a different set of questions"
                                        style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(var(--fg),0.12)", background: "rgba(var(--fg),0.04)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: tuneLoading ? "not-allowed" : "pointer", opacity: tuneLoading ? 0.5 : 1, whiteSpace: "nowrap" }}>
                                        New questions
                                    </button>
                                    <button type="button" onClick={() => setTuneOpen(false)} title="Close"
                                        style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid rgba(var(--fg),0.12)", background: "rgba(var(--fg),0.04)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <X size={17} />
                                    </button>
                                </div>
                            </div>

                            {/* Questions */}
                            <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 20 }}>
                                {tuneLoading ? (
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "70px 0", color: "var(--text-muted)" }}>
                                        <Loader2 size={30} className="animate-spin" style={{ color: "#a78bfa" }} />
                                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>Studying your concept…</div>
                                        <div style={{ fontSize: 12.5, textAlign: "center", maxWidth: 380, lineHeight: 1.6 }}>
                                            The AI is writing questions — and candidate answers — specific to your business. This takes a few seconds.
                                        </div>
                                    </div>
                                ) : tuneQuestions.map((q, qi) => {
                                    const ans = tuneAnswers[q.field];
                                    const selected = Array.isArray(ans) ? ans : (ans ? [ans] : []);
                                    return (
                                        <div key={q.id || q.field} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                            <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{String(qi + 1).padStart(2, "0")}</span>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.45 }}>{q.label}</div>
                                                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                                                        {q.type === "multi" ? "Pick as many as apply" : q.type === "single" ? "Pick one, or write your own" : "Optional — leave blank to let the AI decide"}
                                                    </div>
                                                </div>
                                            </div>

                                            {q.type === "text" ? (
                                                <textarea
                                                    value={typeof ans === "string" ? ans : ""}
                                                    onChange={(e) => setTuneAnswers((p) => ({ ...p, [q.field]: e.target.value }))}
                                                    placeholder={q.placeholder || ""}
                                                    rows={q.field === "reviews" ? 4 : 2}
                                                    style={{ ...inputStyle, padding: "11px 14px", fontSize: 14, resize: "vertical", lineHeight: 1.55 }}
                                                />
                                            ) : (
                                                <>
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                        {q.options.map((opt) => {
                                                            const sel = selected.includes(opt);
                                                            return (
                                                                <button key={opt} type="button"
                                                                    onClick={() => (q.type === "multi" ? toggleTuneOption(q.field, opt) : pickTuneOption(q.field, opt))}
                                                                    style={{
                                                                        display: "flex", alignItems: "center", gap: 7, textAlign: "left",
                                                                        padding: "9px 15px", borderRadius: 100, fontSize: 13.5, fontWeight: 600,
                                                                        background: sel ? "var(--grad-btn)" : "var(--bg-input)",
                                                                        border: sel ? "1px solid rgba(var(--fg),0.12)" : "1px solid var(--border-color)",
                                                                        color: sel ? "#fff" : "var(--text-secondary)",
                                                                        cursor: "pointer", transition: "all 0.15s ease",
                                                                        boxShadow: sel ? "0 4px 12px rgba(8,90,72,0.35)" : "none",
                                                                    }}>
                                                                    {sel && <CheckCircle size={13} strokeWidth={3} />}
                                                                    {opt}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    {q.allowCustom && (
                                                        <input
                                                            value={tuneCustom[q.field] || ""}
                                                            onChange={(e) => setTuneCustom((p) => ({ ...p, [q.field]: e.target.value }))}
                                                            placeholder={q.type === "multi" ? "Other… (added to your picks)" : "Other… (used instead of the options above)"}
                                                            style={{ ...inputStyle, padding: "10px 14px", fontSize: 13.5 }}
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Footer */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 22px", borderTop: "1px solid rgba(var(--fg),0.08)", flexShrink: 0, background: "rgba(var(--fg),0.02)" }}>
                                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                                    {answered} of {tuneQuestions.length} answered
                                </span>
                                <div style={{ display: "flex", gap: 10 }}>
                                    <button type="button" onClick={() => { setTuneAnswers({}); setTuneCustom({}); setForm((p) => ({ ...p, brandDetails: {} })); setTuneOpen(false); toast("Skipped tuning — the AI will write everything", { icon: "✏️" }); }}
                                        style={{ padding: "11px 18px", borderRadius: 12, border: "1px solid rgba(var(--fg),0.12)", background: "rgba(var(--fg),0.04)", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                                        Skip
                                    </button>
                                    <button type="button" onClick={handleApplyTune} disabled={tuneLoading} className="saas-button"
                                        style={{ padding: "11px 22px", borderRadius: 12, fontSize: 14.5, opacity: tuneLoading ? 0.6 : 1, cursor: tuneLoading ? "not-allowed" : "pointer" }}>
                                        <CheckCircle size={17} strokeWidth={2.5} /> Apply to my website
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ), document.body);
            })()}

            {/* ── Live template preview modal (portaled to body to escape the layout stacking context) ── */}
            {previewId && (() => {
                const tpl = TEMPLATES.find(t => t.id === previewId);
                return createPortal((
                    <div onClick={() => setPreviewId(null)} style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(5,8,12,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                        <div onClick={(e) => e.stopPropagation()} style={{ width: "min(1180px, 94vw)", height: "90vh", background: "#0d1117", borderRadius: 20, border: "1px solid rgba(var(--fg),0.12)", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 40px 100px rgba(0,0,0,0.6)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(var(--fg),0.08)", flexShrink: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                    <Eye size={18} style={{ color: "var(--text-accent)", flexShrink: 0 }} />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{tpl?.name}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tpl?.description || "Live preview · scroll inside to explore"}</div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                                    <button type="button" onClick={() => { if (tpl) setForm(p => ({ ...p, baseTemplateSections: tpl.sections, theme: tpl.themeSelected, selectedTemplateName: tpl.name })); setPreviewId(null); toast.success(`"${tpl?.name}" selected`); }} className="saas-button" style={{ padding: "10px 20px", borderRadius: 10, fontSize: 14 }}>
                                        <CheckCircle size={16} strokeWidth={2.5} /> Use this template
                                    </button>
                                    <button type="button" onClick={() => setPreviewId(null)} title="Close" style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid rgba(var(--fg),0.12)", background: "rgba(var(--fg),0.04)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 20, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
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
