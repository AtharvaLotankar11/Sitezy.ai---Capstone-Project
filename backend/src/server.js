import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import axios from "axios";

import connectDB from "./config/db.js";
import { requestLogger } from "./middleware/logger.middleware.js";
import { errorHandler, notFound } from "./middleware/error.middleware.js";
import { initializeSockets } from "./sockets/collaboration.socket.js";
import { initializeVisitorSockets } from "./sockets/visitor.socket.js";
import { registry, websitePageViewsTotal, websitePublishTotal, aiUsageTotal, tenantWebsitesTotal } from "./utils/metrics.js";

import authRoutes from "./modules/auth/auth.routes.js";
import tenantRoutes from "./modules/tenant/tenant.routes.js";
import websiteRoutes from "./modules/website/website.routes.js";
import builderRoutes from "./modules/builder/builder.routes.js";
import aiRoutes from "./modules/ai/ai.routes.js";
import domainRoutes from "./modules/domain/domain.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import publishRoutes from "./agents/routes/publish.js";
import formsRoutes from "./modules/forms/forms.routes.js";
import uploadRoutes from "./modules/upload/upload.routes.js";
import paymentRoutes from "./modules/payment/payment.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import unsplashRoutes from "./modules/ai/unsplash.controller.js";


// Public routes
import {
    resolveHostname,
    getPublicPage,
    getPublicSite,
} from "./modules/domain/domain.controller.js";
import { chatWithWebsite } from "./modules/ai/ai.controller.js";
import { recordEngagement } from "./modules/analytics/engagement.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);

const corsOptions = {
    origin: (origin, callback) => callback(null, true),
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
};

// Socket.io
const io = new Server(httpServer, {
    cors: corsOptions,
});

initializeSockets(io);
initializeVisitorSockets(io);

// Security middleware
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://checkout.razorpay.com"],
                "frame-src": ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
                "connect-src": ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com", "https://api.razorpay.com", "*"],
                "img-src": ["'self'", "data:", "blob:", "*"],
                "media-src": ["'self'", "data:", "blob:", "*"],
            },
        },
    })
);

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === "production" ? 200 : 10000, // increased for development
    message: { success: false, message: "Too many requests, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use("/api", limiter);

// Stricter limit for AI endpoints
const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: process.env.NODE_ENV === "production" ? 10 : 1000, // increased for development
    message: { success: false, message: "AI rate limit exceeded" },
});
app.use("/api/ai", aiLimiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logger
app.use(requestLogger);

// Serve uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check
app.get("/health", (req, res) => {
    res.json({ success: true, service: "Sitezy.ai API", timestamp: new Date().toISOString() });
});

// Prometheus Metrics
app.get("/metrics", async (req, res) => {
    try {
        res.set("Content-Type", registry.contentType);
        res.end(await registry.metrics());
    } catch (err) {
        res.status(500).end(err);
    }
});

// Hackathon: Simulate Data for Demo
app.post("/metrics/simulate", (req, res) => {
    const tenants = ["tenant-A", "tenant-B", "tenant-C"];
    const websites = ["web-1", "web-2", "web-3", "web-4", "web-5"];

    // Simulate initial website creation
    tenants.forEach(t => {
        tenantWebsitesTotal.inc({ tenantId: t }, Math.floor(Math.random() * 5));
    });

    // Run interval to simulate continuous usage traffic
    setInterval(() => {
        const randomTenant = tenants[Math.floor(Math.random() * tenants.length)];
        const randomWebsite = websites[Math.floor(Math.random() * websites.length)];

        // 80% chance for a page view
        if (Math.random() > 0.2) {
            websitePageViewsTotal.inc({ tenantId: randomTenant, websiteId: randomWebsite });
        }
        // 10% chance for AI usage
        if (Math.random() > 0.9) {
            aiUsageTotal.inc({ tenantId: randomTenant, websiteId: randomWebsite });
        }
        // 2% chance for a publish event
        if (Math.random() > 0.98) {
            websitePublishTotal.inc({ tenantId: randomTenant, websiteId: randomWebsite });
        }
    }, 1000); // 1 tick per second

    res.json({ success: true, message: "Started generating fake data traffic in the background for Grafana demo!" });
});

// Public API routes (no auth)
app.get("/api/public/resolve", resolveHostname);
app.get("/api/public/sites/:tenantSlug", getPublicSite);
app.get("/api/public/sites/:tenantSlug/pages/:slug", getPublicPage);
app.use("/api/public/forms", formsRoutes);
app.use("/api/public/unsplash", unsplashRoutes);
app.post("/api/public/chat", chatWithWebsite);
app.post("/api/public/analytics/engagement", recordEngagement);


// Protected API routes
app.use("/api/auth", authRoutes);
app.use("/api/tenant", tenantRoutes);
app.use("/api/websites", websiteRoutes);
app.use("/api/builder/websites/:websiteId/pages", builderRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/domains", domainRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/publish", publishRoutes);
app.use("/api/forms", formsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin", adminRoutes);

// Serve frontend if built (even if NODE_ENV is occasionally set to development in Render)
const frontendDist = path.join(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get(/^\/(?!api).*/, (req, res) => {
        res.sendFile(path.join(frontendDist, "index.html"));
    });
}

// AI Layout Generation
app.post("/api/layout", async (req, res) => {
    try {

        const prompt = req.body.prompt;

        const response = await axios.post(
            "http://localhost:6000/generate-layout",
            { prompt }
        );

        res.json(response.data);

    } catch (error) {

        console.error(error.message);

        res.status(500).json({
            success: false,
            message: "AI layout generation failed"
        });

    }
});

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();
    httpServer.listen(PORT, () => {
        console.log(`🚀 Sitezy.ai API running on port ${PORT}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
        console.log(`📡 Socket.io active`);
    });
};



startServer();
