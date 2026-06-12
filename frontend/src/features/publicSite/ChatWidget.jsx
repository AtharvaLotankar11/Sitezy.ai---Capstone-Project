import React, { useState, useRef, useEffect } from "react";
import api from "../../services/api.js";

// Helper to format basic markdown from Qwen
function formatMarkdown(text) {
    if (!text) return { __html: '' };
    let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '<br/><br/>')
        .replace(/\n/g, '<br/>')
        .replace(/<br\/>\* /g, '<br/>• ')
        .replace(/<br\/>\- /g, '<br/>• ')
        .replace(/^\* /g, '• ')
        .replace(/^\- /g, '• ');
    return { __html: html };
}

export default function ChatWidget({ websiteId, branding, brandName = "AI Assistant" }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([{ role: "ai", text: `Hi! How can I help you regarding ${brandName}?` }]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("chat"); // 'chat' or 'contact'
    
    // Contact Form States
    const [contactData, setContactData] = useState({ name: "", email: "", message: "" });
    const [contactStatus, setContactStatus] = useState(null);

    // Voice recognition states
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);

    const messagesEndRef = useRef(null);

    // Styling constants
    const primaryColor = branding?.primaryColor || "#14b8a6";
    // Unified Dark Theme
    const chatboxBg = "#1f1f22";
    const bg = "#131316"; // Dark window background
    const tc = "#ffffff";
    const aiBubbleBg = "#1a1a1e"; 
    const inputBg = "rgba(255,255,255,0.06)";

    const headerGradient = `linear-gradient(135deg, ${chatboxBg}, #111111)`;

    // Initialize Speech Recognition
    useEffect(() => {
        if (typeof window !== "undefined") {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = true;
                // en-IN supports switching well between Hindi and English
                recognition.lang = 'en-IN';

                recognition.onstart = () => setIsListening(true);
                
                recognition.onresult = (event) => {
                    let transcript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        transcript += event.results[i][0].transcript;
                    }
                    setInputValue(transcript);
                };

                recognition.onerror = (event) => {
                    console.error("Speech recognition error", event.error);
                    setIsListening(false);
                };

                recognition.onend = () => {
                    setIsListening(false);
                };

                recognitionRef.current = recognition;
            }
        }
    }, []);

    const toggleListening = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!recognitionRef.current) {
            alert("Speech recognition is not supported in this browser.");
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setInputValue("");
            recognitionRef.current.start();
        }
    };

    const getInitials = (name) => {
        if (!name) return "AI";
        const words = name.trim().split(" ");
        if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen && activeTab === "chat") {
            scrollToBottom();
        }
    }, [messages, isOpen, activeTab]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputValue.trim() || !websiteId) return;

        const userMsg = inputValue.trim();
        setMessages(prev => [...prev, { role: "user", text: userMsg }]);
        setInputValue("");
        setIsLoading(true);

        try {
            const res = await api.post("/public/chat", { question: userMsg, websiteId });
            if (res.data.success) {
                setMessages(prev => [...prev, { role: "ai", text: res.data.answer }]);
            } else {
                setMessages(prev => [...prev, { role: "ai", text: "Sorry, I couldn't process that. Please try again." }]);
            }
        } catch (error) {
            console.error("Chat Error:", error);
            setMessages(prev => [...prev, { role: "ai", text: "Something went wrong. Please try again later." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleContactSubmit = async (e) => {
        e.preventDefault();
        if (!contactData.name || !contactData.email || !contactData.message) return;
        
        setIsLoading(true);
        setContactStatus(null);
        try {
            const res = await api.post(`/public/forms/submit/${websiteId}`, contactData);
            if (res.data.success) {
                setContactStatus("success");
                setContactData({ name: "", email: "", message: "" });
            } else {
                setContactStatus("error");
            }
        } catch (error) {
            console.error("Form Submit Error:", error);
            setContactStatus("error");
        } finally {
            setIsLoading(false);
            // Hide success message after 3s
            if (contactStatus !== "error") {
                setTimeout(() => setContactStatus(null), 3500);
            }
        }
    };

    return (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 99999, fontFamily: "inherit" }}>
            {/* Chat button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "50%",
                        background: primaryColor,
                        color: "#fff",
                        border: "none",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.08)"}
                    onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div style={{
                    width: "380px",
                    height: "600px", // Baseline height
                    minWidth: "320px",
                    minHeight: "400px",
                    maxWidth: "90vw",
                    maxHeight: "90vh",
                    resize: "both", // Dynamically resizable
                    background: bg,
                    borderRadius: "24px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden", // Required for CSS resize
                    border: "1px solid rgba(255,255,255,0.1)",
                    animation: "sp-fadeUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)",
                    transformOrigin: "bottom right"
                }}>
                    {/* Top Bar (Close and Tabs) */}
                    <div style={{ padding: "20px 20px 10px 20px", background: "transparent", flexShrink: 0, display: "flex", gap: "10px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ display: "flex", flex: 1, alignItems: "center", background: "rgba(0,0,0,0.3)", borderRadius: "100px", padding: "4px" }}>
                            <button
                                onClick={() => setActiveTab("chat")}
                                style={{
                                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                                    padding: "8px", borderRadius: "100px",
                                    background: activeTab === "chat" ? "rgba(255,255,255,0.1)" : "transparent",
                                    color: activeTab === "chat" ? "#fff" : "#9ca3af",
                                    border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                {brandName} AI Assistant
                            </button>
                            <button
                                onClick={() => setActiveTab("contact")}
                                style={{
                                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                                    padding: "8px", borderRadius: "100px",
                                    background: activeTab === "contact" ? "rgba(255,255,255,0.1)" : "transparent",
                                    color: activeTab === "contact" ? "#fff" : "#9ca3af",
                                    border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                Contact Us
                            </button>
                        </div>
                        
                        {/* Close Button */}
                        <button onClick={() => setIsOpen(false)} style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "#fff", cursor: "pointer", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0 }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.15)"} onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    {/* Chat History Container (Only open if chat tab) */}
                    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", background: "transparent", padding: "20px" }}>
                        {activeTab === "contact" ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 10px", color: "#fff" }}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9, marginBottom: "5px" }}><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>
                                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>Send us a message</h3>
                                <p style={{ margin: "0 0 10px 0", color: "#9ca3af", fontSize: "13px", textAlign: "center" }}>We'll get back to you via email shortly.</p>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                {messages.map((msg, idx) => (
                                    <div key={idx} style={{ alignSelf: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                                        <div style={{
                                            background: msg.role === "user" ? primaryColor : aiBubbleBg,
                                            color: "#fff",
                                            padding: "14px 18px",
                                            borderRadius: msg.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                                            fontSize: "14px",
                                            lineHeight: "1.6",
                                            boxShadow: msg.role === "user" ? "0 4px 15px " + primaryColor + "40" : "0 4px 15px rgba(0,0,0,0.2)",
                                            border: msg.role === "user" ? "none" : "1px solid rgba(255,255,255,0.05)",
                                            wordBreak: "break-word"
                                        }}
                                            dangerouslySetInnerHTML={ msg.role === "user" ? undefined : formatMarkdown(msg.text) }
                                        >
                                            {msg.role === "user" ? msg.text : null}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && activeTab === "chat" && (
                                    <div style={{ alignSelf: "flex-start", display: "flex", gap: "6px", padding: "16px 20px", background: aiBubbleBg, borderRadius: "20px 20px 20px 4px", border: "1px solid rgba(255,255,255,0.05)", boxShadow: "0 4px 15px rgba(0,0,0,0.2)" }}>
                                        <div style={{ width: "6px", height: "6px", background: primaryColor, borderRadius: "50%", animation: "sp-fadeUp 0.6s infinite alternate", opacity: 0.7 }} />
                                        <div style={{ width: "6px", height: "6px", background: primaryColor, borderRadius: "50%", animation: "sp-fadeUp 0.6s infinite alternate 0.2s", opacity: 0.7 }} />
                                        <div style={{ width: "6px", height: "6px", background: primaryColor, borderRadius: "50%", animation: "sp-fadeUp 0.6s infinite alternate 0.4s", opacity: 0.7 }} />
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Bottom Area: Controls & Input (Seamless integration instead of card above card) */}
                    <div style={{
                        background: chatboxBg,
                        borderTop: "1px solid rgba(255,255,255,0.05)",
                        padding: "16px 20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "14px"
                    }}>
                        {/* Active Content Area */}
                        {activeTab === "chat" ? (
                            <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    <input
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder={isListening ? "Listening..." : "Ask me anything..."}
                                        disabled={isLoading}
                                        style={{
                                            width: "100%",
                                            background: "rgba(0,0,0,0.15)",
                                            border: "1px solid rgba(255,255,255,0.05)",
                                            padding: "12px 14px",
                                            borderRadius: "12px",
                                            color: "#fff",
                                            fontSize: "14px",
                                            outline: "none",
                                            fontFamily: "inherit"
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = primaryColor}
                                        onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.05)"}
                                    />
                                    
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        {/* Left Side Details */}
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "rgba(255,255,255,0.5)", fontSize: "11px", fontWeight: "600" }}>
                                            <span style={{ color: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", gap: "4px", background: primaryColor + "15", padding: "2px 6px", borderRadius: "4px" }}>✨ AI Powered</span>
                                        </div>

                                        {/* Right Side Buttons */}
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <button
                                                type="button"
                                                onClick={toggleListening}
                                                style={{
                                                    background: "transparent",
                                                    border: "none",
                                                    color: isListening ? "#ef4444" : "rgba(255,255,255,0.6)",
                                                    cursor: "pointer",
                                                    padding: "4px"
                                                }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isLoading || !inputValue.trim()}
                                                style={{
                                                    width: "32px",
                                                    height: "32px",
                                                    borderRadius: "50%",
                                                    background: inputValue.trim() ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)",
                                                    color: inputValue.trim() ? "#000" : "rgba(255,255,255,0.4)",
                                                    border: "none",
                                                    cursor: inputValue.trim() ? "pointer" : "not-allowed",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    transition: "background 0.2s"
                                                }}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleContactSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {contactStatus === "success" && <div style={{ color: "#34d399", fontSize: "12px", textAlign: "center", marginBottom: "4px" }}>Message Sent Successfully!</div>}
                                    {contactStatus === "error" && <div style={{ color: "#ef4444", fontSize: "12px", textAlign: "center", marginBottom: "4px" }}>Failed to send. Please try again.</div>}
                                    
                                    <input
                                        type="text"
                                        value={contactData.name}
                                        onChange={(e) => setContactData({...contactData, name: e.target.value})}
                                        placeholder="Your Name"
                                        required
                                        style={{ width: "100%", background: inputBg, border: "1px solid rgba(255,255,255,0.05)", padding: "12px", borderRadius: "10px", color: "#fff", fontSize: "13px", outline: "none", fontFamily: "inherit" }}
                                        onFocus={(e) => e.target.style.borderColor = primaryColor}
                                        onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.05)"}
                                    />
                                    <input
                                        type="email"
                                        value={contactData.email}
                                        onChange={(e) => setContactData({...contactData, email: e.target.value})}
                                        placeholder="Your Email"
                                        required
                                        style={{ width: "100%", background: inputBg, border: "1px solid rgba(255,255,255,0.05)", padding: "12px", borderRadius: "10px", color: "#fff", fontSize: "13px", outline: "none", fontFamily: "inherit" }}
                                        onFocus={(e) => e.target.style.borderColor = primaryColor}
                                        onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.05)"}
                                    />
                                    <textarea
                                        value={contactData.message}
                                        onChange={(e) => setContactData({...contactData, message: e.target.value})}
                                        placeholder="How can we help you?"
                                        required
                                        style={{ width: "100%", height: "80px", background: inputBg, border: "1px solid rgba(255,255,255,0.05)", padding: "12px", borderRadius: "10px", color: "#fff", fontSize: "13px", outline: "none", fontFamily: "inherit", resize: "none" }}
                                        onFocus={(e) => e.target.style.borderColor = primaryColor}
                                        onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.05)"}
                                    />
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        style={{ width: "100%", padding: "10px", borderRadius: "10px", background: primaryColor, color: "#fff", border: "none", fontWeight: "600", fontSize: "13px", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", transition: "opacity 0.2s" }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                                    >
                                        {isLoading ? <div style={{ width: "16px", height: "16px", border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "sp-fadeUp 0.6s infinite linear" }} /> : "Send Message"}
                                    </button>
                                </form>
                            )}

                        </div>
                </div>
            )}
        </div>
    );
}
