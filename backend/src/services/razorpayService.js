import Razorpay from "razorpay";
import crypto from "crypto";

class RazorpayService {
    constructor() {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            console.warn("⚠️ Razorpay credentials not configured");
            this.instance = null;
            return;
        }

        this.instance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        console.log("✅ Razorpay Service initialized (Test Mode)");
    }

    /**
     * Create a Razorpay order
     */
    async createOrder({ amount, currency = "INR", receipt, notes = {} }) {
        if (!this.instance) {
            throw new Error("Razorpay not configured");
        }

        const options = {
            amount: amount * 100, // Convert to paise
            currency,
            receipt,
            notes,
        };

        return await this.instance.orders.create(options);
    }

    /**
     * Verify payment signature
     */
    verifyPaymentSignature({ orderId, paymentId, signature }) {
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest("hex");

        return generatedSignature === signature;
    }

    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(payload, signature) {
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(JSON.stringify(payload))
            .digest("hex");

        return expectedSignature === signature;
    }

    /**
     * Fetch payment details
     */
    async fetchPayment(paymentId) {
        if (!this.instance) {
            throw new Error("Razorpay not configured");
        }

        return await this.instance.payments.fetch(paymentId);
    }

    /**
     * Fetch order details
     */
    async fetchOrder(orderId) {
        if (!this.instance) {
            throw new Error("Razorpay not configured");
        }

        return await this.instance.orders.fetch(orderId);
    }

    /**
     * Get Razorpay key ID for frontend
     */
    getKeyId() {
        return process.env.RAZORPAY_KEY_ID;
    }
}

export default new RazorpayService();
