import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import api from "../../services/api";
import SubscriptionCheckout from "./SubscriptionCheckout";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
    CreditCard, Check, X, Sparkles, Crown, Zap, Rocket, Clock, CheckCircle2,
    AlertCircle, Trash2, History, ArrowUpCircle, ArrowDownCircle, RefreshCw
} from "lucide-react";
import toast from "react-hot-toast";

// Helper function to get plan hierarchy level
const getPlanLevel = (planName) => {
    const levels = { FREE: 0, BASIC: 1, PRO: 2, ENTERPRISE: 3 };
    return levels[planName] || 0;
};

const PlanCard = ({ plan, currentPlan, onSelect, loading }) => {
    const isActive = currentPlan === plan.name;
    const isFree = plan.price === 0;
    const isPro = plan.name === "PRO";
    const isEnterprise = plan.name === "ENTERPRISE";

    const planIcons = {
        FREE: Sparkles,
        BASIC: Zap,
        PRO: Crown,
        ENTERPRISE: Rocket,
    };

    const PlanIcon = planIcons[plan.name] || CreditCard;

    const planColors = {
        FREE: "#71717a",
        BASIC: "#38bdf8",
        PRO: "#10b981",
        ENTERPRISE: "#fbbf24",
    };

    const color = planColors[plan.name];

    return (
        <div
            style={{
                background: isActive ? "var(--bg-card)" : "var(--bg-card)",
                border: isActive ? `2px solid ${color}` : "1px solid var(--border-color)",
                borderRadius: 24,
                padding: 32,
                position: "relative",
                overflow: "hidden",
                transition: "all 0.3s ease",
                display: "flex",
                flexDirection: "column",
                minHeight: 520,
                transform: "translateY(0)",
            }}
            onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                e.currentTarget.style.transform = "translateY(-4px)";
            }}
            onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.borderColor = "var(--border-color)";
                e.currentTarget.style.transform = "translateY(0)";
            }}
        >
            {/* Glow effect */}
            {(isPro || isEnterprise) && (
                <div
                    style={{
                        position: "absolute",
                        top: -100,
                        right: -100,
                        width: 200,
                        height: 200,
                        borderRadius: "50%",
                        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                        opacity: 0.15,
                        pointerEvents: "none",
                    }}
                />
            )}

            {/* Top Right Badges */}
            <div style={{ position: "absolute", top: 20, right: 20, display: "flex", gap: 8 }}>
                {/* Active badge */}
                {isActive && (
                    <div
                        style={{
                            background: `${color}20`,
                            color: color,
                            fontSize: 11,
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            padding: "6px 14px",
                            borderRadius: 100,
                            border: `1px solid ${color}40`,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        <CheckCircle2 size={12} /> Active
                    </div>
                )}

                {/* Popular badge */}
                {isPro && (
                    <div
                        style={{
                            background: `linear-gradient(135deg, ${color}, #f472b6)`,
                            color: "white",
                            fontSize: 11,
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            padding: "6px 14px",
                            borderRadius: 100,
                            boxShadow: `0 4px 12px ${color}40`,
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        Popular
                    </div>
                )}
            </div>

            {/* Icon */}
            <div
                style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: `${color}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 24,
                }}
            >
                <PlanIcon size={28} style={{ color }} strokeWidth={2} />
            </div>

            {/* Plan name */}
            <h3
                style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    marginBottom: 8,
                    letterSpacing: "-0.01em",
                }}
            >
                {plan.displayName}
            </h3>

            {/* Description */}
            <p
                style={{
                    fontSize: 14,
                    color: "var(--text-secondary)",
                    marginBottom: 24,
                    minHeight: 40,
                }}
            >
                {plan.description}
            </p>

            {/* Price */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 18, color: "var(--text-secondary)" }}>₹</span>
                    <span
                        style={{
                            fontSize: 48,
                            fontWeight: 800,
                            color: "var(--text-primary)",
                            letterSpacing: "-0.02em",
                        }}
                    >
                        {plan.price}
                    </span>
                    <span style={{ fontSize: 16, color: "var(--text-muted)" }}>/month</span>
                </div>
            </div>

            {/* Features */}
            <div style={{ flex: 1, marginBottom: 24 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <FeatureItem
                        icon={Check}
                        text={`${plan.features.websiteLimit} Website${plan.features.websiteLimit > 1 ? "s" : ""}`}
                        color={color}
                    />
                    <FeatureItem
                        icon={Check}
                        text={`${plan.features.aiQuota} AI Generations/month`}
                        color={color}
                    />
                    <FeatureItem
                        icon={plan.features.customDomain ? Check : X}
                        text="Custom Domain"
                        color={plan.features.customDomain ? color : "#71717a"}
                        disabled={!plan.features.customDomain}
                    />
                    <FeatureItem
                        icon={plan.features.premiumComponents ? Check : X}
                        text="Premium Components"
                        color={plan.features.premiumComponents ? color : "#71717a"}
                        disabled={!plan.features.premiumComponents}
                    />
                    <FeatureItem
                        icon={plan.features.analyticsAccess ? Check : X}
                        text="Analytics Access"
                        color={plan.features.analyticsAccess ? color : "#71717a"}
                        disabled={!plan.features.analyticsAccess}
                    />
                </div>
            </div>

            {/* CTA Button */}
            <button
                onClick={() => onSelect(plan)}
                disabled={isActive || loading}
                style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: 14,
                    border: "none",
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: isActive || loading ? "not-allowed" : "pointer",
                    background: isActive
                        ? "var(--bg-input)"
                        : isFree
                            ? "var(--bg-input)"
                            : `linear-gradient(135deg, ${color}, ${color}dd)`,
                    color: isActive ? "var(--text-muted)" : isFree ? "var(--text-primary)" : "white",
                    transition: "all 0.2s ease",
                    opacity: loading ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                }}
                onMouseEnter={(e) => {
                    if (!isActive && !isFree && !loading) {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = `0 8px 20px ${color}40`;
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isActive && !isFree && !loading) {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                    }
                }}
            >
                {isActive ? (
                    <>
                        <CheckCircle2 size={18} />
                        Current Plan
                    </>
                ) : isFree ? (
                    "Free Forever"
                ) : currentPlan && getPlanLevel(plan.name) > getPlanLevel(currentPlan) ? (
                    <>
                        <ArrowUpCircle size={18} />
                        Upgrade Now
                    </>
                ) : currentPlan && getPlanLevel(plan.name) < getPlanLevel(currentPlan) ? (
                    <>
                        <ArrowDownCircle size={18} />
                        Downgrade
                    </>
                ) : (
                    "Get Started"
                )}
            </button>
        </div>
    );
};

const FeatureItem = ({ icon: Icon, text, color, disabled }) => (
    <div
        style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            opacity: disabled ? 0.4 : 1,
        }}
    >
        <div
            style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                background: `${color}20`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
            }}
        >
            <Icon size={12} style={{ color }} strokeWidth={3} />
        </div>
        <span style={{ fontSize: 14, color: disabled ? "var(--text-muted)" : "var(--text-secondary)" }}>
            {text}
        </span>
    </div>
);

const SubscriptionPage = () => {
    const [plans, setPlans] = useState([]);
    const [currentSubscription, setCurrentSubscription] = useState(null);
    const [subscriptionHistory, setSubscriptionHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const { user } = useSelector((state) => state.auth);

    useEffect(() => {
        fetchPlansAndSubscription();
    }, []);

    const fetchPlansAndSubscription = async () => {
        try {
            const [plansRes, subRes, historyRes] = await Promise.all([
                api.get("/payment/plans"),
                api.get("/payment/subscription"),
                api.get("/payment/history"),
            ]);

            setPlans(plansRes.data.data);
            setCurrentSubscription(subRes.data.data);
            setSubscriptionHistory(historyRes.data.data);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPlan = (plan) => {
        if (plan.price === 0) {
            if (currentSubscription?.subscription?.planType !== "FREE") {
                handleCancelSubscription();
            }
            return;
        }
        setSelectedPlan(plan);
    };

    const handlePaymentSuccess = () => {
        setSelectedPlan(null);
        fetchPlansAndSubscription();
        window.dispatchEvent(new Event("planUpdated"));
    };

    const handleCancelSubscription = async () => {
        if (!window.confirm("Are you sure you want to cancel your subscription? You'll lose access to premium features.")) {
            return;
        }

        setCancelling(true);
        try {
            await api.post("/payment/cancel");
            toast.success("Subscription cancelled successfully");
            fetchPlansAndSubscription();
            window.dispatchEvent(new Event("planUpdated"));
        } catch (error) {
            console.error("Cancel error:", error);
            toast.error(error.response?.data?.message || "Failed to cancel subscription");
        } finally {
            setCancelling(false);
        }
    };

    const isUpgrade = (targetPlan) => {
        if (!currentSubscription?.subscription) return true;
        return getPlanLevel(targetPlan) > getPlanLevel(currentSubscription.subscription.planType);
    };

    const isDowngrade = (targetPlan) => {
        if (!currentSubscription?.subscription) return false;
        return getPlanLevel(targetPlan) < getPlanLevel(currentSubscription.subscription.planType);
    };

    return (
        <DashboardLayout>
            <div style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 40px 60px" }}>
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 48 }}>
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 16px",
                            borderRadius: 100,
                            background: "rgba(20,184,166,0.1)",
                            border: "1px solid rgba(20,184,166,0.25)",
                            marginBottom: 20,
                        }}
                    >
                        <CreditCard size={16} style={{ color: "#5eead4" }} />
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#5eead4",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            Subscription Plans
                        </span>
                    </div>

                    <h1
                        style={{
                            fontSize: 48,
                            fontWeight: 800,
                            letterSpacing: "-0.02em",
                            color: "var(--text-primary)",
                            marginBottom: 16,
                        }}
                    >
                        Choose Your Plan
                    </h1>
                    <p style={{ fontSize: 18, color: "var(--text-secondary)", maxWidth: 600, margin: "0 auto" }}>
                        Unlock premium features and scale your business with the perfect plan for your needs
                    </p>
                </div>

                {/* Current Subscription Badge */}
                {currentSubscription?.subscription && currentSubscription.subscription.status === "ACTIVE" && (
                    <div
                        style={{
                            background: "rgba(16,185,129,0.08)",
                            border: "1px solid rgba(16,185,129,0.2)",
                            borderRadius: 20,
                            padding: "20px 28px",
                            marginBottom: 40,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 16,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <div
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    background: "rgba(16,185,129,0.15)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <CheckCircle2 size={24} style={{ color: "#10b981" }} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p style={{ fontSize: 16, fontWeight: 700, color: "#10b981", marginBottom: 4 }}>
                                    Active Subscription
                                </p>
                                <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                                    You're currently on the{" "}
                                    <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                        {currentSubscription.subscription.planType}
                                    </span>{" "}
                                    plan
                                </p>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            {currentSubscription.subscription.endDate && (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "10px 18px",
                                        borderRadius: 12,
                                        background: "rgba(255,255,255,0.05)",
                                    }}
                                >
                                    <Clock size={16} style={{ color: "var(--text-muted)" }} />
                                    <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                                        Valid until{" "}
                                        {new Date(currentSubscription.subscription.endDate).toLocaleDateString("en-US", {
                                            month: "long",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </span>
                                </div>
                            )}
                            {currentSubscription.subscription.planType !== "FREE" && (
                                <button
                                    onClick={handleCancelSubscription}
                                    disabled={cancelling}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "10px 18px",
                                        borderRadius: 12,
                                        background: "rgba(239,68,68,0.1)",
                                        border: "1px solid rgba(239,68,68,0.2)",
                                        color: "#ef4444",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor: cancelling ? "not-allowed" : "pointer",
                                        transition: "all 0.2s ease",
                                        opacity: cancelling ? 0.6 : 1,
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!cancelling) {
                                            e.currentTarget.style.background = "rgba(239,68,68,0.15)";
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!cancelling) {
                                            e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                                        }
                                    }}
                                >
                                    {cancelling ? (
                                        <>
                                            <RefreshCw size={16} className="animate-spin" />
                                            Cancelling...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 size={16} />
                                            Cancel Subscription
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Plans Grid */}
                {loading ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: 24,
                        }}
                    >
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="shimmer" style={{ height: 520, borderRadius: 24 }} />
                        ))}
                    </div>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: 24,
                            alignItems: "start",
                        }}
                    >
                        {plans.map((plan) => (
                            <PlanCard
                                key={plan._id}
                                plan={plan}
                                currentPlan={currentSubscription?.subscription?.planType}
                                onSelect={handleSelectPlan}
                                loading={loading}
                            />
                        ))}
                    </div>
                )}



                {/* Subscription History */}
                {subscriptionHistory.length > 0 && (
                    <div style={{ marginTop: 48 }}>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "14px 24px",
                                borderRadius: 14,
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid var(--border-color)",
                                color: "var(--text-primary)",
                                fontSize: 16,
                                fontWeight: 700,
                                cursor: "pointer",
                                marginBottom: 24,
                                transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                                e.currentTarget.style.borderColor = "var(--border-color)";
                            }}
                        >
                            <History size={20} />
                            {showHistory ? "Hide" : "View"} Subscription History ({subscriptionHistory.length})
                        </button>

                        {showHistory && (
                            <div
                                style={{
                                    background: "var(--bg-card)",
                                    border: "1px solid var(--border-color)",
                                    borderRadius: 20,
                                    padding: 28,
                                }}
                            >
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    {subscriptionHistory.map((sub) => {
                                        const statusColors = {
                                            ACTIVE: { bg: "rgba(16,185,129,0.1)", color: "#10b981", border: "rgba(16,185,129,0.2)" },
                                            CANCELLED: { bg: "rgba(239,68,68,0.1)", color: "#ef4444", border: "rgba(239,68,68,0.2)" },
                                            EXPIRED: { bg: "rgba(161,161,170,0.1)", color: "#a1a1aa", border: "rgba(161,161,170,0.2)" },
                                            PENDING: { bg: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "rgba(251,191,36,0.2)" },
                                            FAILED: { bg: "rgba(239,68,68,0.1)", color: "#ef4444", border: "rgba(239,68,68,0.2)" },
                                        };
                                        const statusStyle = statusColors[sub.status] || statusColors.PENDING;

                                        return (
                                            <div
                                                key={sub._id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    padding: "16px 20px",
                                                    borderRadius: 14,
                                                    background: "rgba(255,255,255,0.02)",
                                                    border: "1px solid transparent",
                                                    transition: "all 0.15s ease",
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                                                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                                                    e.currentTarget.style.borderColor = "transparent";
                                                }}
                                            >
                                                <div>
                                                    <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                                                        {sub.planType} Plan
                                                    </p>
                                                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                                        {new Date(sub.createdAt).toLocaleDateString("en-US", {
                                                            month: "long",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        })}
                                                        {sub.startDate && sub.endDate && (
                                                            <> • {new Date(sub.startDate).toLocaleDateString()} to {new Date(sub.endDate).toLocaleDateString()}</>
                                                        )}
                                                    </p>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                                    <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
                                                        ₹{sub.amount}
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            fontWeight: 800,
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.05em",
                                                            padding: "6px 12px",
                                                            borderRadius: 100,
                                                            background: statusStyle.bg,
                                                            color: statusStyle.color,
                                                            border: `1px solid ${statusStyle.border}`,
                                                        }}
                                                    >
                                                        {sub.status}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Checkout Modal */}
            {selectedPlan && (
                <SubscriptionCheckout
                    plan={selectedPlan}
                    onSuccess={handlePaymentSuccess}
                    onClose={() => setSelectedPlan(null)}
                />
            )}
        </DashboardLayout>
    );
};

export default SubscriptionPage;
