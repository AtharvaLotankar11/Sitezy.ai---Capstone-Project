import { useState } from "react";
import api from "../../services/api";
import { X, CreditCard, Shield, Loader } from "lucide-react";
import toast from "react-hot-toast";

const SubscriptionCheckout = ({ plan, onSuccess, onClose }) => {
    const [loading, setLoading] = useState(false);

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handlePayment = async () => {
        setLoading(true);

        try {
            // Load Razorpay script
            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) {
                toast.error("Failed to load payment gateway. Please check your connection.");
                setLoading(false);
                return;
            }

            // Create order
            const orderResponse = await api.post("/payment/create-order", {
                planType: plan.name,
            });

            const { orderId, amount, currency, keyId, subscriptionId } = orderResponse.data.data;

            // Razorpay options
            const options = {
                key: keyId,
                amount: amount,
                currency: currency,
                name: "Sitezy.ai",
                description: `${plan.displayName} Subscription`,
                order_id: orderId,
                handler: async function (response) {
                    try {
                        // Verify payment
                        const verifyResponse = await api.post("/payment/verify", {
                            orderId: response.razorpay_order_id,
                            paymentId: response.razorpay_payment_id,
                            signature: response.razorpay_signature,
                            subscriptionId: subscriptionId,
                        });

                        if (verifyResponse.data.success) {
                            toast.success("Payment successful! Your subscription is now active. 🎉");
                            onSuccess();
                        }
                    } catch (error) {
                        console.error("Payment verification error:", error);
                        toast.error("Payment verification failed. Please contact support.");
                    }
                },
                prefill: {
                    name: "Test User",
                    email: "test@example.com",
                    contact: "9999999999",
                },
                notes: {
                    planType: plan.name,
                },
                theme: {
                    color: "#14b8a6",
                },
                modal: {
                    ondismiss: function () {
                        setLoading(false);
                    },
                },
            };

            const razorpay = new window.Razorpay(options);
            razorpay.open();
        } catch (error) {
            console.error("Payment error:", error);
            toast.error(error.response?.data?.message || "Failed to initiate payment");
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0, 0, 0, 0.8)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: 20,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 24,
                    padding: 40,
                    maxWidth: 500,
                    width: "100%",
                    position: "relative",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{
                        position: "absolute",
                        top: 20,
                        right: 20,
                        background: "rgba(var(--fg),0.05)",
                        border: "1px solid var(--border-color)",
                        borderRadius: 12,
                        width: 40,
                        height: 40,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "var(--text-secondary)",
                        transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(var(--fg),0.1)";
                        e.currentTarget.style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(var(--fg),0.05)";
                        e.currentTarget.style.color = "var(--text-secondary)";
                    }}
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <div
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 16,
                            background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 20px",
                            boxShadow: "0 8px 24px rgba(20,184,166,0.3)",
                        }}
                    >
                        <CreditCard size={32} color="white" strokeWidth={2} />
                    </div>
                    <h2
                        style={{
                            fontSize: 28,
                            fontWeight: 800,
                            color: "var(--text-primary)",
                            marginBottom: 8,
                            letterSpacing: "-0.01em",
                        }}
                    >
                        Checkout
                    </h2>
                    <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>
                        Complete your subscription to {plan.displayName}
                    </p>
                </div>

                {/* Plan details */}
                <div
                    style={{
                        background: "rgba(var(--fg),0.03)",
                        border: "1px solid var(--border-color)",
                        borderRadius: 16,
                        padding: 24,
                        marginBottom: 24,
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Plan</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                            {plan.displayName}
                        </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Billing</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Monthly</span>
                    </div>
                    <div
                        style={{
                            borderTop: "1px solid var(--border-color)",
                            paddingTop: 16,
                            marginTop: 16,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                        }}
                    >
                        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Total</span>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                            <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>₹</span>
                            <span
                                style={{
                                    fontSize: 32,
                                    fontWeight: 800,
                                    color: "var(--text-primary)",
                                    letterSpacing: "-0.02em",
                                }}
                            >
                                {plan.price}
                            </span>
                            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>/month</span>
                        </div>
                    </div>
                </div>


                {/* Payment button */}
                <button
                    onClick={handlePayment}
                    disabled={loading}
                    style={{
                        width: "100%",
                        padding: "16px",
                        borderRadius: 14,
                        border: "none",
                        fontSize: 16,
                        fontWeight: 700,
                        cursor: loading ? "not-allowed" : "pointer",
                        background: loading
                            ? "var(--bg-input)"
                            : "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
                        color: "white",
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        opacity: loading ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                        if (!loading) {
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.boxShadow = "0 8px 24px rgba(20,184,166,0.4)";
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!loading) {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                        }
                    }}
                >
                    {loading ? (
                        <>
                            <Loader size={20} className="animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <Shield size={20} />
                            Pay ₹{plan.price} Securely
                        </>
                    )}
                </button>

                {/* Security badge */}
                <div
                    style={{
                        marginTop: 20,
                        textAlign: "center",
                        fontSize: 12,
                        color: "var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                    }}
                >
                    <Shield size={14} style={{ color: "#10b981" }} />
                    Secured by Razorpay
                </div>
            </div>
        </div>
    );
};

export default SubscriptionCheckout;
