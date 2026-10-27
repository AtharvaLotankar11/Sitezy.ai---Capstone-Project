import { useEffect, useRef, useCallback, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
    fetchPages, fetchPage, createPage, createAiPage, deletePage, updateSections, saveDraft,
    setSelectedSection, setCurrentPage, updateLocalSections, updateSectionProps,
    setActiveEditors, applyRemoteUpdate,
} from "../../store/slices/builderSlice.js";
import { getSocket, connectSocket } from "../../services/socket.js";
import toast from "react-hot-toast";
import {
    ArrowLeft, Plus, Trash2, GripVertical, Rocket, Save,
    Users, Pencil, FileText, Eye, Loader2, LayoutGrid, Globe, History, GitCommitHorizontal, Gauge,
    Monitor, Tablet, Smartphone, Maximize, Minimize, ChevronDown
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import SectionEditor from "./SectionEditor.jsx";
import { SECTION_MAP, globalResponsiveCss } from "../publicSite/PublicSiteRenderer.jsx";
import ChatPanel from "./ChatPanel.jsx";
import HelpAssistant from "../../components/HelpAssistant.jsx";
import VersionPanel from "./VersionPanel.jsx";
import SeoPanel from "./SeoPanel.jsx";
import PublishModal from "./PublishModal.jsx";

const SECTION_TYPES = ["Hero", "Navbar", "Footer", "Text", "Gallery", "CTA", "ContactForm", "Button", "Image", "Spacer"];

const SECTION_COLORS = {
    Hero: "#2dd4bf", Navbar: "#0ea5e9", Footer: "#64748b",
    Text: "#10b981", Gallery: "#f59e0b", CTA: "#f472b6", ContactForm: "#38bdf8",
    Button: "#fb7185", Image: "#06b6d4", Spacer: "#94a3b8"
};

export default function BuilderPage() {
    const { websiteId, pageId } = useParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user, token, tenant } = useSelector((s) => s.auth);
    const { pages, currentPage, selectedSectionId, saving, activeEditors } = useSelector((s) => s.builder);

    const autoSaveRef = useRef(null);
    const canvasRef = useRef(null);
    const [showVersionPanel, setShowVersionPanel] = useState(false);
    const [showSeoPanel, setShowSeoPanel] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [previewWidth, setPreviewWidth] = useState("100%");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [cursors, setCursors] = useState({});
    const [showAddMenu, setShowAddMenu] = useState(false);

    useEffect(() => {
        const socket = connectSocket(token);
        let initJoin;
        if (socket && pageId && websiteId) {
            initJoin = () => {
                socket.emit("join:website", { websiteId });
                socket.emit("join:page", { pageId, userName: user?.name });
            };

            if (socket.connected) initJoin();
            socket.on("connect", initJoin);
            const handleEditorsUpdate = ({ editors }) => dispatch(setActiveEditors(editors));
            const handleContentUpdate = (data) => { if (data.updatedBy !== user?._id) dispatch(applyRemoteUpdate(data)); };
            const handleAutosaveSuccess = () => { };
            const handleCursorUpdate = (data) => {
                if (data.userId === user?._id) return;
                setCursors(prev => ({ ...prev, [data.userId]: data }));

                // Clear cursor after 3 seconds of inactivity
                if (window[`cursorTimeout_${data.userId}`]) clearTimeout(window[`cursorTimeout_${data.userId}`]);
                window[`cursorTimeout_${data.userId}`] = setTimeout(() => {
                    setCursors(p => { const copy = { ...p }; delete copy[data.userId]; return copy; });
                }, 3000);
            };

            socket.on("editors:update", handleEditorsUpdate);
            socket.on("content:update", handleContentUpdate);
            socket.on("autosave:success", handleAutosaveSuccess);
            socket.on("cursor:update", handleCursorUpdate);

            return () => {
                const s = getSocket();
                if (s && pageId) {
                    if (initJoin) s.off("connect", initJoin);
                    s.emit("leave:page", { pageId });
                    s.off("editors:update", handleEditorsUpdate);
                    s.off("content:update", handleContentUpdate);
                    s.off("autosave:success", handleAutosaveSuccess);
                    s.off("cursor:update", handleCursorUpdate);
                }
            };
        }
    }, [pageId, websiteId, token, user]);

    useEffect(() => {
        dispatch(fetchPages(websiteId)).then((res) => {
            if (fetchPages.fulfilled.match(res)) {
                const fetchedPages = res.payload;
                if (!pageId && fetchedPages.length > 0) {
                    const homePage = fetchedPages.find(p => p.isHomePage) || fetchedPages[0];
                    navigate(`/websites/${websiteId}/builder/${homePage._id}`, { replace: true });
                }
            }
        });
    }, [websiteId, pageId, dispatch, navigate]);

    useEffect(() => {
        if (pageId) dispatch(fetchPage({ websiteId, pageId }));
    }, [websiteId, pageId, dispatch]);

    useEffect(() => {
        if (!currentPage) return;
        autoSaveRef.current = setInterval(() => {
            const socket = getSocket();
            if (socket?.connected) socket.emit("autosave", { pageId: currentPage._id, layoutConfig: currentPage.layoutConfig });
        }, 10000);
        return () => clearInterval(autoSaveRef.current);
    }, [currentPage]);

    const handlePageSelect = (page) => { navigate(`/websites/${websiteId}/builder/${page._id}`); dispatch(setCurrentPage(page)); };
    const handleAddPage = async () => {
        const title = prompt("New page name (e.g. Menu, Services, Pricing):");
        if (!title || !title.trim()) return;
        const t = toast.loading("AI is building your page…");
        const res = await dispatch(createAiPage({ websiteId, title: title.trim() }));
        if (createAiPage.fulfilled.match(res)) {
            // The new page + every existing page's navbar changed server-side → resync.
            await dispatch(fetchPages(websiteId));
            toast.success("Page added & linked into your navigation", { id: t });
            navigate(`/websites/${websiteId}/builder/${res.payload._id}`);
        } else {
            toast.error(res.payload || "Failed to add page", { id: t });
        }
    };
    const handleDeletePage = async (page) => {
        if (page.isHomePage) return toast.error("Cannot delete homepage");
        if (!confirm(`Delete "${page.title}"?`)) return;
        const res = await dispatch(deletePage({ websiteId, pageId: page._id }));
        if (deletePage.fulfilled.match(res)) { toast.success("Page deleted"); const r = pages.filter((p) => p._id !== page._id); if (r.length > 0) navigate(`/websites/${websiteId}/builder/${r[0]._id}`); }
    };
    const handleAddSection = (type) => {
        if (!currentPage) return;
        const newSection = { id: uuidv4(), type, props: getDefaultProps(type), order: (currentPage.layoutConfig?.sections?.length || 0) };
        const newSections = [...(currentPage.layoutConfig?.sections || []), newSection];
        dispatch(updateLocalSections(newSections));
        broadcastUpdate(newSections);
    };
    const handleDeleteSection = (sectionId) => {
        if (!currentPage) return;
        const newSections = (currentPage.layoutConfig?.sections || []).filter((s) => s.id !== sectionId);
        dispatch(updateLocalSections(newSections));
        broadcastUpdate(newSections);
        if (selectedSectionId === sectionId) dispatch(setSelectedSection(null));
    };
    const handleDragEnd = (result) => {
        if (!result.destination || !currentPage) return;
        const items = [...(currentPage.layoutConfig?.sections || [])];
        const [moved] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, moved);
        const reordered = items.map((s, i) => ({ ...s, order: i }));
        dispatch(updateLocalSections(reordered));
        broadcastUpdate(reordered);
    };
    const broadcastUpdate = useCallback((sections) => {
        const socket = getSocket();
        if (socket?.connected && currentPage) socket.emit("content:update", { pageId: currentPage._id, sections, userId: user?._id });
    }, [currentPage, user]);
    const handleSaveDraft = async () => {
        if (!currentPage) return;
        const res = await dispatch(saveDraft({ websiteId, pageId: currentPage._id, layoutConfig: currentPage.layoutConfig }));
        if (saveDraft.fulfilled.match(res)) toast.success("Draft saved ✓"); else toast.error("Save failed");
    };

    const generateAILayout = async () => {

        try {

            const promptText = prompt("Describe your website");

            if (!promptText) return;

            const res = await fetch(
                "http://localhost:5000/api/layout",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        prompt: promptText
                    })
                }
            );

            const components = await res.json();

            if (!components || components.length === 0) {

                toast.error("AI could not generate layout");

                return;

            }

            const newSections = components.map((component, index) => {

                const mappedType = mapComponentName(component);

                return {

                    id: uuidv4(),

                    type: mappedType,

                    props: getDefaultProps(mappedType),

                    order: index

                };

            });

            dispatch(updateLocalSections(newSections));

            toast.success("AI layout generated successfully 🚀");

        } catch (err) {

            console.error(err);

            toast.error("AI layout generation failed");

        }

    };
    // Publish is now handled via PublishModal

    const canPublish = ["OWNER", "ADMIN"].includes(user?.role);
    const canEdit = ["OWNER", "ADMIN", "EDITOR", "DEVELOPER"].includes(user?.role);

    const handleMouseMove = (e) => {
        if (!canvasRef.current || !pageId) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        // Throttling to 100ms
        if (window.lastCursorEmit && Date.now() - window.lastCursorEmit < 100) return;
        window.lastCursorEmit = Date.now();

        const socket = getSocket();
        if (socket?.connected) {
            socket.emit("cursor:move", { pageId, x, y });
        }
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-base)" }}>
                {/* ====== 1. LEFT — Pages Panel ====== */}
                {!isFullscreen && (
                    <div style={{
                        width: 220, minWidth: 150, maxWidth: 500, background: "var(--bg-surface)",
                        borderRight: "1px solid var(--border-color)", display: "flex", flexDirection: "column",
                        resize: "horizontal", overflow: "hidden", flexShrink: 0
                    }}>
                        {/* Header */}
                        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 14 }}>
                            <Link to="/websites" style={{
                                display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600,
                                color: "rgba(var(--fg),0.4)", textDecoration: "none",
                            }}>
                                <ArrowLeft size={14} /> Back
                            </Link>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.35)" }}>Pages</h3>
                                {canEdit && (
                                    <button onClick={handleAddPage} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-primary)", padding: 4 }}>
                                        <Plus size={16} strokeWidth={2.5} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Pages list */}
                        <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                            {pages.map((page) => {
                                const active = page._id === currentPage?._id;
                                return (
                                    <div key={page._id} onClick={() => handlePageSelect(page)} style={{
                                        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
                                        cursor: "pointer", transition: "all 0.15s ease",
                                        background: active ? "rgba(20,184,166,0.14)" : "transparent",
                                        border: active ? "1px solid rgba(20,184,166,0.3)" : "1px solid transparent",
                                    }}>
                                        <FileText size={14} style={{ color: active ? "var(--color-primary)" : "rgba(var(--fg),0.3)", flexShrink: 0 }} />
                                        <span style={{
                                            fontSize: 13, fontWeight: active ? 700 : 500, flex: 1,
                                            color: active ? "var(--color-primary)" : "var(--text-secondary)",
                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                        }}>{page.title}</span>
                                        {page.isHomePage && (
                                            <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(var(--fg),0.08)", padding: "2px 6px", borderRadius: 6, color: "rgba(var(--fg),0.4)" }}>HOME</span>
                                        )}
                                        {!page.isHomePage && canEdit && (
                                            <button onClick={(e) => { e.stopPropagation(); handleDeletePage(page); }}
                                                style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", opacity: 0.5, padding: 2 }}>
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ====== 2. LEFT — Page Layers (DND) ====== */}
                {currentPage && !isFullscreen && (
                    <div style={{
                        width: 300, minWidth: 200, maxWidth: 600, background: "var(--bg-surface)",
                        borderRight: "1px solid var(--border-color)", display: "flex", flexDirection: "column",
                        resize: "horizontal", overflow: "hidden", flexShrink: 0
                    }}>
                        <div style={{
                            padding: "14px 16px", borderBottom: "1px solid var(--border-color)",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}>
                            <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(var(--fg),0.35)" }}>
                                Page Layers (Sections)
                            </h3>
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                            <Droppable droppableId="sections">
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {(currentPage.layoutConfig?.sections || []).map((section, index) => {
                                            const isSelected = selectedSectionId === section.id;
                                            const sColor = SECTION_COLORS[section.type] || "var(--color-primary)";
                                            return (
                                                <Draggable key={section.id} draggableId={section.id} index={index} isDragDisabled={!canEdit}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef} {...provided.draggableProps}
                                                            onClick={() => canEdit && dispatch(setSelectedSection(isSelected ? null : section.id))}
                                                            style={{
                                                                borderRadius: 14, overflow: "hidden",
                                                                border: isSelected ? `2px solid ${sColor}` : "2px solid var(--border-color)",
                                                                background: snapshot.isDragging ? "var(--bg-card)" : "var(--bg-input)",
                                                                cursor: canEdit ? "pointer" : "default",
                                                                transition: "border-color 0.15s ease",
                                                                ...provided.draggableProps.style,
                                                            }}
                                                        >
                                                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                                                                {canEdit && (
                                                                    <span {...provided.dragHandleProps} style={{ color: "rgba(var(--fg),0.2)", display: "flex", cursor: "grab" }}>
                                                                        <GripVertical size={14} />
                                                                    </span>
                                                                )}
                                                                <span style={{
                                                                    fontSize: 10, fontWeight: 700, padding: "4px 8px", borderRadius: 6,
                                                                    textTransform: "uppercase", letterSpacing: "0.04em",
                                                                    background: `${sColor}18`, color: sColor, border: `1px solid ${sColor}35`,
                                                                }}>
                                                                    {section.type}
                                                                </span>
                                                                {section.props?.heading && (
                                                                    <span style={{
                                                                        fontSize: 12, flex: 1, fontWeight: 500, color: "var(--text-secondary)",
                                                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                                    }}>
                                                                        {section.props.heading}
                                                                    </span>
                                                                )}
                                                                {canEdit && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id); }}
                                                                        style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", marginLeft: "auto", padding: 2, opacity: 0.6 }}
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {/* Inline editor */}
                                                            {isSelected && canEdit && (
                                                                <div
                                                                    style={{ padding: "8px 14px 14px", borderTop: "1px solid var(--border-color)", background: "rgba(0,0,0,0.15)" }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <SectionEditor
                                                                        section={section}
                                                                        pages={pages}
                                                                        onChange={(props) => {
                                                                            dispatch(updateSectionProps({ sectionId: section.id, props }));
                                                                            broadcastUpdate(
                                                                                (currentPage.layoutConfig?.sections || []).map((s) =>
                                                                                    s.id === section.id ? { ...s, props: { ...s.props, ...props } } : s
                                                                                )
                                                                            );
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </Draggable>
                                            );
                                        })}
                                        {provided.placeholder}
                                        {(currentPage.layoutConfig?.sections?.length || 0) === 0 && (
                                            <div style={{
                                                textAlign: "center", padding: "40px 16px", border: "2px dashed rgba(var(--fg),0.08)",
                                                borderRadius: 16, marginTop: 8,
                                            }}>
                                                <LayoutGrid size={24} style={{ color: "rgba(var(--fg),0.12)", margin: "0 auto 8px" }} />
                                                <p style={{ color: "rgba(var(--fg),0.25)", fontSize: 12, fontWeight: 600 }}>No sections yet. Use “Add Section” below.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Droppable>

                            {/* Add Section — lives inside the Page Layers column */}
                            {canEdit && (
                                <div style={{ marginTop: 10, borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
                                    <button onClick={() => setShowAddMenu((v) => !v)} style={{
                                        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                        padding: "11px 14px", borderRadius: 12, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                                        background: "var(--grad-btn)", color: "#fff", border: "1px solid rgba(var(--fg),0.12)",
                                        fontFamily: "var(--font-display)", boxShadow: "0 4px 12px rgba(8,90,72,0.3)",
                                    }}>
                                        <Plus size={15} strokeWidth={2.5} /> Add Section
                                        <ChevronDown size={14} style={{ transform: showAddMenu ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} />
                                    </button>
                                    {showAddMenu && (
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
                                            {SECTION_TYPES.map((type) => (
                                                <button
                                                    key={type}
                                                    onClick={() => { handleAddSection(type); setShowAddMenu(false); }}
                                                    style={{
                                                        display: "flex", alignItems: "center", gap: 8, padding: "10px 11px", borderRadius: 10,
                                                        fontSize: 12, fontWeight: 700, textAlign: "left", cursor: "pointer", transition: "all 0.15s ease",
                                                        background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)",
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = SECTION_COLORS[type]; e.currentTarget.style.color = SECTION_COLORS[type]; e.currentTarget.style.background = `${SECTION_COLORS[type]}10`; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "var(--bg-input)"; }}
                                                >
                                                    <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: SECTION_COLORS[type], boxShadow: `0 0 8px ${SECTION_COLORS[type]}` }} />
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ====== 3. CENTER — Canvas ====== */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
                    {/* Toolbar */}
                    <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "0 20px", height: 56, background: "var(--bg-surface)",
                        borderBottom: "1px solid var(--border-color)", flexShrink: 0,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Eye size={16} style={{ color: "rgba(var(--fg),0.5)" }} />
                            <h2 style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>Live Preview</h2>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "4px" }}>
                            <button onClick={() => setPreviewWidth("100%")} style={{ background: previewWidth === "100%" ? "rgba(var(--fg),0.1)" : "transparent", color: previewWidth === "100%" ? "white" : "rgba(var(--fg),0.4)", border: "none", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}><Monitor size={14} /></button>
                            <button onClick={() => setPreviewWidth("768px")} style={{ background: previewWidth === "768px" ? "rgba(var(--fg),0.1)" : "transparent", color: previewWidth === "768px" ? "white" : "rgba(var(--fg),0.4)", border: "none", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}><Tablet size={14} /></button>
                            <button onClick={() => setPreviewWidth("375px")} style={{ background: previewWidth === "375px" ? "rgba(var(--fg),0.1)" : "transparent", color: previewWidth === "375px" ? "white" : "rgba(var(--fg),0.4)", border: "none", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}><Smartphone size={14} /></button>
                            <div style={{ width: 1, height: 16, background: "rgba(var(--fg),0.1)", margin: "0 4px" }} />
                            <button onClick={() => setIsFullscreen(!isFullscreen)} title="Presentation Mode" style={{ background: isFullscreen ? "rgba(20,184,166,0.2)" : "transparent", color: isFullscreen ? "var(--text-accent)" : "rgba(var(--fg),0.4)", border: "none", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                                {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                            </button>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {activeEditors.length > 0 && (
                                <div style={{
                                    display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
                                    borderRadius: 10, background: "var(--bg-input)", border: "1px solid var(--border-color)",
                                }}>
                                    <Users size={13} style={{ color: "rgba(var(--fg),0.4)" }} />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>{activeEditors.length}</span>
                                    <div style={{ display: "flex" }}>
                                        {activeEditors.slice(0, 3).map((ed) => (
                                            <div key={ed.socketId} title={ed.userName} style={{
                                                width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: 9, fontWeight: 700, background: ed.color, color: "white",
                                                border: "2px solid var(--bg-surface)", marginLeft: -4,
                                            }}>
                                                {ed.userName?.[0]}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* SEO & Insights button */}
                            <button onClick={() => { setShowSeoPanel((v) => !v); setShowVersionPanel(false); }} style={{
                                display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                                borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                                background: showSeoPanel ? "rgba(20,184,166,0.14)" : "var(--bg-input)",
                                border: showSeoPanel ? "1px solid rgba(20,184,166,0.3)" : "1px solid var(--border-color)",
                                color: showSeoPanel ? "var(--text-accent)" : "var(--text-primary)",
                            }}>
                                <Gauge size={14} /> SEO
                            </button>
                            {/* Version History button */}
                            <button onClick={() => { setShowVersionPanel((v) => !v); setShowSeoPanel(false); }} style={{
                                display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                                borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                                background: showVersionPanel ? "rgba(20,184,166,0.14)" : "var(--bg-input)",
                                border: showVersionPanel ? "1px solid rgba(20,184,166,0.3)" : "1px solid var(--border-color)",
                                color: showVersionPanel ? "var(--text-accent)" : "var(--text-primary)",
                            }}>
                                <History size={14} /> History
                            </button>
                            {canEdit && (
                                <button onClick={handleSaveDraft} disabled={saving} style={{
                                    display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
                                    borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                                    background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)",
                                }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                                </button>
                            )}
                            {canPublish && (
                                <button onClick={() => setShowPublishModal(true)} style={{
                                    display: "flex", alignItems: "center", gap: 8, padding: "8px 18px",
                                    borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                                    background: "linear-gradient(135deg, #10b981, #34d399)", color: "white", border: "none",
                                    boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
                                }}>
                                    <Rocket size={14} /> Publish
                                </button>
                            )}
                        </div>
                    </div>



                    {/* Canvas */}
                    <div style={{ flex: 1, overflowY: "auto", padding: 32, background: "var(--bg-base)" }}>
                        {currentPage ? (
                            <div
                                ref={canvasRef}
                                onMouseMove={handleMouseMove}
                                style={{
                                    maxWidth: previewWidth === "100%" ? "none" : previewWidth,
                                    width: previewWidth === "100%" ? "100%" : previewWidth,
                                    margin: "0 auto", borderRadius: previewWidth === "100%" ? 0 : 20, overflow: "hidden",
                                    background: "#0f0f1a", border: previewWidth === "100%" ? "none" : "1px solid rgba(var(--fg),0.08)",
                                    boxShadow: previewWidth === "100%" ? "none" : "0 24px 48px rgba(0,0,0,0.4)", minHeight: "60vh",
                                    display: "flex", flexDirection: "column", position: "relative",
                                    transition: "all 0.3s ease"
                                }}>
                                {/* Browser chrome */}
                                <div style={{
                                    display: "flex", alignItems: "center", padding: "14px 20px",
                                    background: "rgba(var(--fg),0.02)", borderBottom: "1px solid rgba(var(--fg),0.04)",
                                }}>
                                    <div style={{ display: "flex", gap: 8, marginRight: 20 }}>
                                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f56" }} />
                                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ffbd2e" }} />
                                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#27c93f" }} />
                                    </div>
                                    <div style={{
                                        flex: 1, display: "flex", justifyContent: "center",
                                    }}>
                                        <div style={{
                                            display: "flex", alignItems: "center", gap: 8,
                                            padding: "6px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                                            background: "rgba(0,0,0,0.4)", color: "rgba(var(--fg),0.4)",
                                            border: "1px solid rgba(var(--fg),0.04)",
                                        }}>
                                            <Globe size={12} />
                                            {currentPage.slug === "home" ? "yoursite.com" : `yoursite.com/${currentPage.slug}`}
                                        </div>
                                    </div>
                                </div>

                                {/* Rendered sections */}
                                <Droppable droppableId="canvas-sections">
                                    {(provided) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef} className="responsive-master-container" style={{ flex: 1, color: "#f0f0ff", position: "relative" }}>
                                            <style>{globalResponsiveCss}</style>
                                            {Object.values(cursors).map(cursor => (
                                                <div key={cursor.userId} style={{
                                                    position: "absolute",
                                                    left: `${cursor.x * 100}%`,
                                                    top: `${cursor.y * 100}%`,
                                                    zIndex: 9999,
                                                    pointerEvents: "none",
                                                    transition: "left 0.1s linear, top 0.1s linear"
                                                }}>
                                                    <svg width="18" height="24" viewBox="0 0 18 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M2.5 2.5L15 11.5L9.5 13L7.5 20.5L2.5 2.5Z" fill={cursor.color} stroke="white" strokeWidth="2" strokeLinejoin="round" />
                                                    </svg>
                                                    <div style={{
                                                        background: cursor.color,
                                                        color: "white", padding: "4px 8px", borderRadius: "12px",
                                                        fontSize: "11px", fontWeight: "bold", marginLeft: "14px", marginTop: "4px",
                                                        whiteSpace: "nowrap", boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                                                    }}>
                                                        {cursor.userName}
                                                    </div>
                                                </div>
                                            ))}

                                            {(currentPage.layoutConfig?.sections || []).map((section, index) => {
                                                const Component = SECTION_MAP[section.type];
                                                if (!Component) return null;
                                                return (
                                                    <Draggable key={`canvas-${section.id}`} draggableId={`canvas-${section.id}`} index={index} isDragDisabled={!canEdit}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                style={{
                                                                    position: "relative",
                                                                    outline: selectedSectionId === section.id ? `2px solid ${SECTION_COLORS[section.type] || "var(--color-primary)"}` : "none",
                                                                    transition: snapshot.isDragging ? "none" : "outline 0.2s ease",
                                                                    opacity: snapshot.isDragging ? 0.8 : 1,
                                                                    cursor: canEdit ? "grab" : "default",
                                                                    ...provided.draggableProps.style
                                                                }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    canEdit && dispatch(setSelectedSection(section.id));
                                                                }}
                                                            >
                                                                <Component props={section.props || {}} branding={tenant?.branding} websiteId={websiteId} allPages={pages} currentPage={currentPage} onPageChange={handlePageSelect} />
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                );
                                            })}
                                            {provided.placeholder}
                                            {((currentPage.layoutConfig?.sections?.length) || 0) === 0 && (
                                                <div style={{
                                                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                                    padding: "80px 20px", textAlign: "center",
                                                }}>
                                                    <LayoutGrid size={40} style={{ color: "rgba(var(--fg),0.08)", marginBottom: 16 }} />
                                                    <p style={{ color: "rgba(var(--fg),0.2)", fontSize: 16, fontWeight: 600 }}>Page is empty. Add sections from the right panel.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        ) : (
                            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ textAlign: "center" }}>
                                    <FileText size={40} style={{ color: "rgba(var(--fg),0.1)", margin: "0 auto 12px" }} />
                                    <p style={{ color: "rgba(var(--fg),0.25)", fontSize: 16, fontWeight: 600 }}>Select a page to edit</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div >

                {/* ====== SEO & INSIGHTS — Inline Panel ====== */}
                <SeoPanel
                    websiteId={websiteId}
                    pageId={pageId}
                    open={showSeoPanel}
                    onClose={() => setShowSeoPanel(false)}
                />

                {/* ====== VERSION HISTORY — Inline Panel ====== */}
                < VersionPanel
                    websiteId={websiteId}
                    pageId={pageId}
                    open={showVersionPanel}
                    onClose={() => setShowVersionPanel(false)
                    }
                />

                {/* ====== Floating Overlays ====== */}
                {websiteId && <ChatPanel websiteId={websiteId} />}

                {!isFullscreen && (
                    <HelpAssistant
                        position="bottom-left"
                        context="website builder"
                        topics={[
                            "What is a Navbar, Hero and CTA?",
                            "How do I edit an image in the navbar?",
                            "What does the SEO button do?",
                            "What is version History and how do I roll back?",
                            "How do I add a new page?",
                            "How do I add fields to a form?",
                        ]}
                    />
                )}

                {
                    showPublishModal && (
                        <PublishModal
                            websiteId={websiteId}
                            onClose={() => setShowPublishModal(false)}
                        />
                    )
                }
            </div >
        </DragDropContext >
    );
}

function mapComponentName(name) {

    const mapping = {

        navbar: "Navbar",
        hero: "Hero",
        footer: "Footer",
        gallery_section: "Gallery",
        contact_section: "ContactForm"

    };

    return mapping[name] || "Text";
}

function getDefaultProps(type) {
    const defaults = {
        Hero: { heading: "Welcome", subheading: "Your tagline here", ctaText: "Get Started", ctaLink: "#" },
        Navbar: { brand: "Brand", links: ["Home", "About", "Contact"] },
        Footer: { text: `© ${new Date().getFullYear()} Your Company. All rights reserved.` },
        Text: { heading: "Section Title", description: "Write your content here." },
        Gallery: { heading: "Our Gallery", items: ["Image 1", "Image 2", "Image 3"] },
        CTA: { heading: "Ready to start?", subheading: "Join us today.", ctaText: "Get Started", ctaLink: "#" },
        ContactForm: { heading: "Contact Us", fields: ["name", "email", "message"] },
        Button: { text: "Click Me", link: "#", align: "center", bgColor: "transparent", accentColor: "#14b8a6", textColor: "#ffffff" },
        Image: { src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1000", alt: "Descriptive label", align: "center", bgColor: "transparent" },
        Spacer: { height: "80px", bgColor: "transparent" }
    };
    return defaults[type] || {};
}
