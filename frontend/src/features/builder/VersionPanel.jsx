import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { commitPage, fetchCommits, rollbackToCommit } from "../../store/slices/builderSlice.js";
import toast from "react-hot-toast";
import {
    GitCommitHorizontal, History, RotateCcw, ChevronDown, ChevronRight,
    Plus, Loader2, Clock, User2, X
} from "lucide-react";

export default function VersionPanel({ websiteId, pageId, open, onClose }) {
    const dispatch = useDispatch();
    const { commits, commitsLoading, currentPage } = useSelector((s) => s.builder);
    const { user } = useSelector((s) => s.auth);
    const [commitMsg, setCommitMsg] = useState("");
    const [committing, setCommitting] = useState(false);
    const [expandedCommit, setExpandedCommit] = useState(null);

    const canRollback = ["OWNER", "ADMIN"].includes(user?.role);

    useEffect(() => {
        if (open && pageId && websiteId) {
            dispatch(fetchCommits({ websiteId, pageId }));
        }
    }, [open, pageId, websiteId, dispatch]);

    const handleCommit = async () => {
        if (!commitMsg.trim()) return toast.error("Enter a commit message");
        setCommitting(true);
        const res = await dispatch(commitPage({ websiteId, pageId, message: commitMsg.trim() }));
        setCommitting(false);
        if (commitPage.fulfilled.match(res)) {
            toast.success(`Committed v${res.payload.version} ✓`);
            setCommitMsg("");
        } else {
            toast.error(res.payload || "Commit failed");
        }
    };

    const handleRollback = async (commitId, version) => {
        if (!confirm(`Rollback to version ${version}? Your current unsaved changes will be replaced.`)) return;
        const res = await dispatch(rollbackToCommit({ websiteId, pageId, commitId }));
        if (rollbackToCommit.fulfilled.match(res)) {
            toast.success(`Rolled back to v${version}`);
        } else {
            toast.error(res.payload || "Rollback failed");
        }
    };

    const formatDate = (ts) => {
        const d = new Date(ts);
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return "Just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    if (!open) return null;

    return (
        <div style={{
            width: 340, minWidth: 340, flexShrink: 0,
            background: "var(--bg-surface)",
            borderLeft: "1px solid var(--border-color)",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
        }}>
            {/* Header */}
            <div style={{
                padding: "15px 18px", borderBottom: "1px solid var(--border-color)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <History size={15} style={{ color: "#5eead4" }} />
                    <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                        Version History
                    </h3>
                </div>
                <button onClick={onClose} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,0.4)", padding: 4,
                }}>
                    <X size={16} />
                </button>
            </div>

            {/* Create Commit */}
            <div style={{
                padding: "14px 16px", borderBottom: "1px solid var(--border-color)",
                background: "rgba(20,184,166,0.04)", flexShrink: 0,
            }}>
                <label style={{
                    fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                    letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)",
                    display: "block", marginBottom: 8,
                }}>
                    Create Commit
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                    <input
                        value={commitMsg}
                        onChange={(e) => setCommitMsg(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCommit()}
                        placeholder="e.g. Added hero section..."
                        style={{
                            flex: 1, padding: "9px 12px", borderRadius: 10,
                            background: "var(--bg-input)", border: "1px solid var(--border-color)",
                            color: "var(--text-primary)", fontSize: 12, outline: "none",
                        }}
                    />
                    <button
                        onClick={handleCommit}
                        disabled={committing || !commitMsg.trim()}
                        style={{
                            padding: "9px 14px", borderRadius: 10, border: "none",
                            background: commitMsg.trim()
                                ? "linear-gradient(135deg, #14b8a6, #0ea5e9)"
                                : "rgba(255,255,255,0.05)",
                            color: commitMsg.trim() ? "white" : "rgba(255,255,255,0.2)",
                            cursor: commitMsg.trim() ? "pointer" : "default",
                            display: "flex", alignItems: "center", gap: 5,
                            fontSize: 12, fontWeight: 700, flexShrink: 0,
                            transition: "all 0.15s ease",
                        }}
                    >
                        {committing ? <Loader2 size={12} className="animate-spin" /> : <GitCommitHorizontal size={12} />}
                        Commit
                    </button>
                </div>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
                    Current: <strong>v{currentPage?.version || 0}</strong>
                </p>
            </div>

            {/* Commit History */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
                {commitsLoading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
                        <Loader2 size={20} className="animate-spin" style={{ color: "rgba(255,255,255,0.2)" }} />
                    </div>
                ) : commits.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 12px" }}>
                        <GitCommitHorizontal size={28} style={{ color: "rgba(255,255,255,0.08)", margin: "0 auto 10px" }} />
                        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, fontWeight: 500 }}>
                            No commits yet. Create your first checkpoint above.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {commits.map((commit, i) => {
                            const isExpanded = expandedCommit === commit._id;
                            const isFirst = i === 0;
                            return (
                                <div key={commit._id} style={{
                                    borderRadius: 12, overflow: "hidden",
                                    border: isFirst
                                        ? "1px solid rgba(20,184,166,0.3)"
                                        : "1px solid rgba(255,255,255,0.06)",
                                    background: isFirst
                                        ? "rgba(20,184,166,0.06)"
                                        : "rgba(255,255,255,0.02)",
                                }}>
                                    <button
                                        onClick={() => setExpandedCommit(isExpanded ? null : commit._id)}
                                        style={{
                                            width: "100%", display: "flex", alignItems: "center", gap: 10,
                                            padding: "11px 12px", background: "none", border: "none",
                                            cursor: "pointer", color: "var(--text-primary)", textAlign: "left",
                                        }}
                                    >
                                        {/* Version badge */}
                                        <span style={{
                                            fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6,
                                            background: isFirst ? "rgba(20,184,166,0.2)" : "rgba(255,255,255,0.06)",
                                            color: isFirst ? "#5eead4" : "rgba(255,255,255,0.4)",
                                            flexShrink: 0,
                                        }}>
                                            v{commit.version}
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{
                                                fontSize: 13, fontWeight: 600,
                                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                            }}>
                                                {commit.message}
                                            </p>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: 3 }}>
                                                    <User2 size={9} /> {commit.committedByName}
                                                </span>
                                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", gap: 3 }}>
                                                    <Clock size={9} /> {formatDate(commit.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ color: "rgba(255,255,255,0.2)" }}>
                                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div style={{
                                            padding: "8px 12px 12px",
                                            borderTop: "1px solid rgba(255,255,255,0.04)",
                                            background: "rgba(0,0,0,0.15)",
                                        }}>
                                            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                                                {commit.snapshot?.sections?.length || 0} section(s) in this snapshot
                                            </p>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                                                {(commit.snapshot?.sections || []).map((s, j) => (
                                                    <span key={j} style={{
                                                        fontSize: 9, fontWeight: 700, padding: "2px 6px",
                                                        borderRadius: 5, textTransform: "uppercase",
                                                        background: "rgba(255,255,255,0.05)",
                                                        color: "rgba(255,255,255,0.4)",
                                                        border: "1px solid rgba(255,255,255,0.06)",
                                                    }}>
                                                        {s.type}
                                                    </span>
                                                ))}
                                            </div>
                                            {canRollback && (
                                                <button
                                                    onClick={() => handleRollback(commit._id, commit.version)}
                                                    style={{
                                                        display: "flex", alignItems: "center", gap: 6,
                                                        padding: "7px 14px", borderRadius: 8,
                                                        background: "rgba(245,158,11,0.1)",
                                                        border: "1px solid rgba(245,158,11,0.25)",
                                                        color: "#f59e0b", fontSize: 11, fontWeight: 700,
                                                        cursor: "pointer", transition: "all 0.15s ease",
                                                    }}
                                                >
                                                    <RotateCcw size={11} /> Restore This Version
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
