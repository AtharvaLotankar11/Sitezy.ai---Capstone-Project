import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { getSocket } from "../../services/socket.js";
import { MessageCircle, Send, X, ChevronDown } from "lucide-react";

export default function ChatPanel({ websiteId }) {
    const { user } = useSelector((s) => s.auth);
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState("");
    const [unread, setUnread] = useState(0);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    // Load chat history + listen for new messages
    useEffect(() => {
        const socket = getSocket();
        if (!socket || !websiteId) return;

        const joinSetup = () => {
            // Join the website room for chat
            socket.emit("join:website", { websiteId });

            // Request history
            socket.emit("chat:history", { websiteId, limit: 50 });
        };

        if (socket.connected) {
            joinSetup();
        }

        socket.on("connect", joinSetup);

        const handleHistory = (data) => {
            console.log("📥 chat:history received:", data);
            if (data.websiteId === websiteId) setMessages(data.messages);
        };

        const handleMessage = (msg) => {
            console.log("📥 chat:message received:", msg);
            if (msg.websiteId === websiteId) {
                setMessages((prev) => [...prev, msg]);
                if (!open && msg.userId !== user?._id) {
                    setUnread((u) => u + 1);
                }
            }
        };

        const handleError = (err) => {
            console.error("❌ chat:error received:", err);
        };

        socket.on("chat:history", handleHistory);
        socket.on("chat:message", handleMessage);
        socket.on("chat:error", handleError);

        return () => {
            socket.off("connect", joinSetup);
            socket.off("chat:history", handleHistory);
            socket.off("chat:message", handleMessage);
            socket.off("chat:error", handleError);
        };
    }, [websiteId, open, user]);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (open) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, open]);

    const handleSend = () => {
        const socket = getSocket();
        if (!socket || !draft.trim()) return;
        socket.emit("chat:send", { websiteId, message: draft.trim(), userName: user?.name });
        setDraft("");
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleOpen = () => {
        setOpen(true);
        setUnread(0);
    };

    const formatTime = (ts) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    // Floating button when closed
    if (!open) {
        return (
            <button
                onClick={handleOpen}
                style={{
                    position: "fixed", bottom: 24, right: 24, zIndex: 999,
                    width: 56, height: 56, borderRadius: "50%",
                    background: "linear-gradient(135deg, #14b8a6, #0ea5e9)",
                    border: "none", cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    boxShadow: "0 8px 32px rgba(20,184,166,0.5)",
                    transition: "transform 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
                <MessageCircle size={24} color="white" />
                {unread > 0 && (
                    <span style={{
                        position: "absolute", top: -4, right: -4,
                        width: 22, height: 22, borderRadius: "50%",
                        background: "#ef4444", color: "white",
                        fontSize: 11, fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: "2px solid var(--bg-base)",
                    }}>
                        {unread > 9 ? "9+" : unread}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 999,
            width: 380, height: 520, borderRadius: 24,
            background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            animation: "scaleIn 0.2s ease-out",
        }}>
            {/* Header */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px",
                background: "linear-gradient(135deg, rgba(20,184,166,0.15), rgba(16,185,129,0.15))",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <MessageCircle size={18} style={{ color: "#5eead4" }} />
                    <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                        Team Chat
                    </span>
                    <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                        background: "rgba(20,184,166,0.2)", color: "#5eead4",
                    }}>
                        LIVE
                    </span>
                </div>
                <button onClick={() => setOpen(false)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,0.4)", padding: 4,
                }}>
                    <X size={18} />
                </button>
            </div>

            {/* Messages */}
            <div style={{
                flex: 1, overflowY: "auto", padding: "16px 16px 8px",
                display: "flex", flexDirection: "column", gap: 12,
            }}>
                {messages.length === 0 && (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                        <div>
                            <MessageCircle size={32} style={{ color: "rgba(255,255,255,0.08)", margin: "0 auto 8px" }} />
                            <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, fontWeight: 500 }}>
                                No messages yet. Say hi to your team! 👋
                            </p>
                        </div>
                    </div>
                )}
                {messages.map((msg, i) => {
                    const isMe = msg.userId === user?._id;
                    return (
                        <div key={msg._id || i} style={{
                            display: "flex", flexDirection: "column",
                            alignItems: isMe ? "flex-end" : "flex-start",
                            width: "100%"
                        }}>
                            {!isMe && (
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, paddingLeft: 4 }}>
                                    <div style={{
                                        width: 18, height: 18, borderRadius: "50%",
                                        background: msg.color || "#14b8a6",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 9, fontWeight: 800, color: "white",
                                    }}>
                                        {msg.userName?.[0]?.toUpperCase()}
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: msg.color || "#5eead4" }}>
                                        {msg.userName}
                                    </span>
                                </div>
                            )}
                            <div style={{
                                maxWidth: "80%", padding: "10px 14px", borderRadius: 16,
                                background: isMe
                                    ? "linear-gradient(135deg, #14b8a6, #0ea5e9)"
                                    : "rgba(255,255,255,0.06)",
                                color: isMe ? "white" : "var(--text-primary)",
                                fontSize: 14, lineHeight: 1.5, wordBreak: "break-word",
                                borderBottomRightRadius: isMe ? 4 : 16,
                                borderBottomLeftRadius: isMe ? 16 : 4,
                            }}>
                                {msg.message}
                            </div>
                            <span style={{
                                fontSize: 10, color: "rgba(255,255,255,0.25)",
                                marginTop: 4, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0,
                            }}>
                                {formatTime(msg.createdAt)}
                            </span>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{
                padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", gap: 10,
            }}>
                <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    style={{
                        flex: 1, padding: "10px 14px", borderRadius: 12,
                        background: "var(--bg-input)", border: "1px solid var(--border-color)",
                        color: "var(--text-primary)", fontSize: 14, outline: "none",
                    }}
                    autoFocus
                />
                <button
                    onClick={handleSend}
                    disabled={!draft.trim()}
                    style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: draft.trim()
                            ? "linear-gradient(135deg, #14b8a6, #0ea5e9)"
                            : "rgba(255,255,255,0.05)",
                        border: "none", cursor: draft.trim() ? "pointer" : "default",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s ease",
                    }}
                >
                    <Send size={16} color={draft.trim() ? "white" : "rgba(255,255,255,0.2)"} />
                </button>
            </div>
        </div>
    );
}
