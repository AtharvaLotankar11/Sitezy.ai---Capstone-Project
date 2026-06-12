import { useParams, useSearchParams } from "react-router-dom";
import { SECTION_MAP, globalResponsiveCss } from "./PublicSiteRenderer.jsx";
import { TEMPLATES } from "../../utils/templates.js";

// Dev-only standalone preview: renders a template's sections through the real
// section renderer with NO backend. Visit /preview/<templateId> or /preview to list.
export default function TemplatePreviewPage() {
    const { templateId } = useParams();
    const [sp] = useSearchParams();
    const only = sp.get("only");
    const tpl = TEMPLATES.find((t) => t.id === templateId);

    if (!tpl) {
        return (
            <div style={{ minHeight: "100vh", background: "#0f172a", color: "#fff", padding: "48px", fontFamily: "system-ui" }}>
                <h1 style={{ fontSize: "24px", marginBottom: "24px" }}>Template Preview</h1>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
                    {TEMPLATES.map((t) => (
                        <a key={t.id} href={`/preview/${t.id}`} style={{ display: "block", padding: "16px 20px", background: "rgba(255,255,255,0.06)", borderRadius: "12px", color: "#fff", textDecoration: "none", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <div style={{ fontWeight: 700 }}>{t.name}</div>
                            <div style={{ fontSize: "12px", opacity: 0.6, marginTop: "4px" }}>{t.id}</div>
                        </a>
                    ))}
                </div>
            </div>
        );
    }

    const sections = tpl.sections
        .map((s, i) => ({ ...s, id: s.id || `s${i}`, order: i }))
        .filter((s) => !only || s.type === only);
    const branding = { font: sections[0]?.props?.fontFamily, primaryColor: sections[0]?.props?.accentColor };

    return (
        <div style={{ minHeight: "100vh", background: "#fff", overflowX: "hidden" }}>
            <style>{globalResponsiveCss}</style>
            {sections.map((section) => {
                const Component = SECTION_MAP[section.type];
                if (!Component) return null;
                return <Component key={section.id} props={section.props || {}} branding={branding} websiteId={null} />;
            })}
        </div>
    );
}
