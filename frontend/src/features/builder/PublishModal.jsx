import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { publishWebsite, fetchDomains } from "../../store/slices/websiteSlice.js";
import toast from "react-hot-toast";
import { Rocket, Globe, X, Loader2, CheckCircle, ExternalLink, ChevronDown } from "lucide-react";

export default function PublishModal({ websiteId, onClose }) {
    const dispatch = useDispatch();
    const { domains, websites } = useSelector((s) => s.website);
    const { tenant } = useSelector((s) => s.auth);
    const [selectedDomainId, setSelectedDomainId] = useState("");
    const [publishing, setPublishing] = useState(false);

    useEffect(() => {
        dispatch(fetchDomains());
    }, [dispatch]);

    // Pre-select the domain if the website is already linked to one
    useEffect(() => {
        const website = websites.find(w => w._id === websiteId);
        if (website && website.defaultDomain) {
            const linkedDomain = domains.find(d => d.domain === website.defaultDomain);
            if (linkedDomain) {
                setSelectedDomainId(linkedDomain._id);
            }
        }
    }, [websites, domains, websiteId]);

    const verifiedDomains = domains.filter((d) => d.verified);

    const handlePublish = async () => {
        setPublishing(true);
        const res = await dispatch(publishWebsite({
            id: websiteId,
            domainId: selectedDomainId || undefined,
        }));
        setPublishing(false);
        if (publishWebsite.fulfilled.match(res)) {
            const selectedDomain = verifiedDomains.find((d) => d._id === selectedDomainId);
            const defaultDomain = domains.find((d) => d.isDefault);
            const website = websites.find(w => w._id === websiteId);

            // Fetch the accurate domain name this was published to
            const targetDomainStr = selectedDomain
                ? selectedDomain.domain
                : (defaultDomain ? defaultDomain.domain : (website ? (website.slug || website.defaultDomain) : tenant?.slug));

            toast.success(
                selectedDomain
                    ? `Published to ${selectedDomain.domain}! 🚀`
                    : "Website published! 🚀"
            );

            if (targetDomainStr) {
                // Ensure it opens seamlessly within the current dev server environment path
                const url = `${window.location.origin}/site/${targetDomainStr}`;
                window.open(url, "_blank");
            }

            onClose();
        } else {
            toast.error(res.payload || "Publish failed");
        }
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)",
        }}>
            <div style={{
                width: "100%", maxWidth: 480, padding: 36, borderRadius: 24,
                background: "var(--bg-card)", border: "1px solid rgba(var(--fg),0.1)",
                boxShadow: "0 24px 48px rgba(0,0,0,0.5)", position: "relative",
                overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column",
            }}>
                {/* Header */}
                <div style={{
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                    marginBottom: 28,
                }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                            <div style={{
                                padding: 10, borderRadius: 12,
                                background: "rgba(16,185,129,0.12)", color: "#10b981",
                            }}>
                                <Rocket size={22} strokeWidth={2.5} />
                            </div>
                            <h2 style={{
                                fontSize: 22, fontWeight: 800, color: "var(--text-primary)",
                                letterSpacing: "-0.02em",
                            }}>
                                Publish Website
                            </h2>
                        </div>
                        <p style={{ fontSize: 14, color: "rgba(var(--fg),0.4)", paddingLeft: 52 }}>
                            Deploy your website live. Choose a domain below.
                        </p>
                    </div>
                    <button onClick={onClose} style={{
                        padding: 8, borderRadius: "50%", background: "none",
                        border: "none", cursor: "pointer", color: "var(--text-muted)",
                    }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Domain Selection */}
                <div style={{ marginBottom: 28, flex: 1, overflowY: "auto", minHeight: 0 }}>
                    <label style={{
                        display: "block", fontSize: 12, fontWeight: 800,
                        textTransform: "uppercase", letterSpacing: "0.1em",
                        color: "rgba(var(--fg),0.4)", marginBottom: 10,
                    }}>
                        Select Domain
                    </label>

                    {verifiedDomains.length === 0 ? (
                        <div style={{
                            padding: "20px 16px", borderRadius: 14,
                            background: "rgba(var(--fg),0.03)",
                            border: "1px dashed rgba(var(--fg),0.1)",
                            textAlign: "center",
                        }}>
                            <Globe size={24} style={{ color: "rgba(var(--fg),0.1)", margin: "0 auto 8px" }} />
                            <p style={{ color: "rgba(var(--fg),0.3)", fontSize: 13, fontWeight: 500 }}>
                                No verified domains found. The default workspace domain will be used.
                            </p>
                            <p style={{ color: "rgba(var(--fg),0.2)", fontSize: 11, marginTop: 4 }}>
                                Add domains in Settings → Custom Domains
                            </p>
                        </div>
                    ) : (
                        <div style={{
                            display: "flex", flexDirection: "column", gap: 8,
                            maxHeight: 320, overflowY: "auto",
                            paddingRight: 4,
                            scrollbarWidth: "thin",
                            scrollbarColor: "rgba(20,184,166,0.4) transparent",
                        }}>
                            {/* Default option */}
                            <button
                                onClick={() => setSelectedDomainId("")}
                                style={{
                                    display: "flex", alignItems: "center", gap: 12,
                                    padding: "14px 16px", borderRadius: 14,
                                    background: !selectedDomainId ? "rgba(20,184,166,0.08)" : "rgba(var(--fg),0.02)",
                                    border: !selectedDomainId
                                        ? "2px solid rgba(20,184,166,0.4)"
                                        : "1px solid rgba(var(--fg),0.06)",
                                    cursor: "pointer", textAlign: "left", width: "100%",
                                    color: "var(--text-primary)",
                                }}
                            >
                                <div style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    background: "rgba(var(--fg),0.05)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    <Globe size={16} style={{ color: "rgba(var(--fg),0.4)" }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 14, fontWeight: 700 }}>Default Domain</p>
                                    <p style={{ fontSize: 12, color: "rgba(var(--fg),0.3)" }}>
                                        Use workspace default domain
                                    </p>
                                </div>
                                {!selectedDomainId && (
                                    <CheckCircle size={18} style={{ color: "#14b8a6" }} />
                                )}
                            </button>

                            {verifiedDomains.map((domain) => {
                                const isSelected = selectedDomainId === domain._id;
                                const isUsedByOther = domain.websiteId && domain.websiteId !== websiteId;
                                const usedSite = isUsedByOther ? websites.find(w => w._id === domain.websiteId) : null;

                                return (
                                    <button
                                        key={domain._id}
                                        onClick={() => !isUsedByOther && setSelectedDomainId(domain._id)}
                                        disabled={isUsedByOther}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 12,
                                            padding: "14px 16px", borderRadius: 14,
                                            background: isSelected ? "rgba(16,185,129,0.08)" : (isUsedByOther ? "rgba(var(--fg),0.01)" : "rgba(var(--fg),0.02)"),
                                            border: isSelected
                                                ? "2px solid rgba(16,185,129,0.4)"
                                                : "1px solid rgba(var(--fg),0.06)",
                                            cursor: isUsedByOther ? "not-allowed" : "pointer", textAlign: "left", width: "100%",
                                            color: isUsedByOther ? "rgba(var(--fg),0.3)" : "var(--text-primary)",
                                            opacity: isUsedByOther ? 0.6 : 1,
                                        }}
                                    >
                                        <div style={{
                                            width: 36, height: 36, borderRadius: 10,
                                            background: isSelected ? "rgba(16,185,129,0.12)" : "rgba(var(--fg),0.05)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                        }}>
                                            <Globe size={16} style={{
                                                color: isSelected ? "#10b981" : "rgba(var(--fg),0.4)"
                                            }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: 14, fontWeight: 700 }}>{domain.domain}</p>
                                            <p style={{ fontSize: 12, color: "rgba(var(--fg),0.3)" }}>
                                                {isUsedByOther ? `In use by ${usedSite ? usedSite.name : 'another project'}` : "Available ✓"}
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <CheckCircle size={18} style={{ color: "#10b981" }} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={onClose} style={{
                        flex: 1, padding: 14, borderRadius: 14,
                        background: "transparent", border: "1px solid var(--border-color)",
                        color: "var(--text-primary)", cursor: "pointer",
                        fontSize: 15, fontWeight: 600,
                    }}>
                        Cancel
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={publishing}
                        style={{
                            flex: 2, padding: 14, borderRadius: 14,
                            border: publishing ? "1px solid var(--border-color)" : "1px solid rgba(var(--fg),0.12)",
                            background: publishing ? "rgba(var(--fg),0.05)" : "var(--grad-btn)",
                            color: publishing ? "rgba(var(--fg),0.3)" : "#fff",
                            cursor: publishing ? "not-allowed" : "pointer",
                            fontSize: 15, fontWeight: 600, fontFamily: "var(--font-display)",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            boxShadow: publishing ? "none" : "0 5px 16px rgba(8,90,72,0.35), inset 0 1px 0 rgba(var(--fg),0.14)",
                        }}
                    >
                        {publishing ? (
                            <><Loader2 size={18} className="animate-spin" /> Publishing...</>
                        ) : (
                            <><Rocket size={18} strokeWidth={2.5} /> Deploy Now</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
