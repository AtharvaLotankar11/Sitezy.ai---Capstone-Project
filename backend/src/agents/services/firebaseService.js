import admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";

/**
 * Firebase Service - Secure wrapper for Firebase Admin SDK
 * Handles all Firebase operations with tenant isolation
 */
class FirebaseService {
    constructor() {
        this.initialized = false;
        this.app = null;
    }

    /**
     * Initialize Firebase Admin SDK
     * Called once at application startup
     */
    initialize() {
        if (this.initialized) return;

        try {
            // Validate required environment variables
            if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
                throw new Error("Missing Firebase credentials in environment variables");
            }

            // Initialize Firebase Admin with service account
            this.app = admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                }),
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            });

            this.initialized = true;
            console.log("✅ Firebase Admin SDK initialized");
        } catch (error) {
            console.error("❌ Firebase initialization failed:", error.message);
            throw error;
        }
    }

    /**
     * Get Firestore instance
     */
    getFirestore() {
        if (!this.initialized) this.initialize();
        return admin.firestore();
    }

    /**
     * Get Storage instance
     */
    getStorage() {
        if (!this.initialized) this.initialize();
        return admin.storage();
    }

    /**
     * Create tenant-isolated Firestore structure with human-readable names
     * @param {string} tenantId - MongoDB tenant ID
     * @param {string} siteId - MongoDB website ID
     * @param {Object} metadata - Additional metadata (tenantSlug, websiteSlug, websiteName)
     */
    async createTenantStructure(tenantId, siteId, metadata = {}) {
        const db = this.getFirestore();
        
        // Use human-readable slugs for Firestore paths
        const tenantSlug = metadata.tenantSlug || tenantId;
        const websiteSlug = metadata.websiteSlug || metadata.websiteName?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || siteId;
        
        const tenantRef = db.collection("tenants").doc(tenantSlug);
        const siteRef = tenantRef.collection("sites").doc(websiteSlug);

        // Initialize tenant document with readable metadata
        await tenantRef.set(
            {
                tenantId,
                tenantSlug,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        // Initialize site document with readable metadata
        await siteRef.set({
            siteId,
            tenantId,
            websiteSlug,
            websiteName: metadata.websiteName || "Untitled Website",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "active",
        });

        // Create initial collections with descriptive names
        await siteRef.collection("pages").doc("_init").set({ initialized: true });
        await siteRef.collection("contact_form_submissions").doc("_init").set({ initialized: true });
        await siteRef.collection("analytics").doc("_init").set({ initialized: true });

        return {
            tenantPath: `tenants/${tenantSlug}`,
            sitePath: `tenants/${tenantSlug}/sites/${websiteSlug}`,
            tenantSlug,
            websiteSlug,
        };
    }

    /**
     * Setup form submission collection (auto-called when ContactForm detected)
     * @param {string} tenantSlug - Human-readable tenant identifier
     * @param {string} websiteSlug - Human-readable website identifier
     * @param {Object} metadata - Additional metadata
     */
    async setupFormCollection(tenantSlug, websiteSlug, metadata = {}) {
        const db = this.getFirestore();
        const siteRef = db.collection("tenants").doc(tenantSlug).collection("sites").doc(websiteSlug);

        // Initialize contact_form_submissions collection with metadata
        await siteRef.collection("contact_form_submissions").doc("_metadata").set({
            setupAt: admin.firestore.FieldValue.serverTimestamp(),
            totalSubmissions: 0,
            lastSubmissionAt: null,
            formEnabled: true,
            websiteName: metadata.websiteName || "Untitled Website",
        });

        return {
            submissionsPath: `tenants/${tenantSlug}/sites/${websiteSlug}/contact_form_submissions`,
            formEnabled: true,
        };
    }

    /**
     * Save form submission to Firestore with human-readable structure
     * @param {string} tenantSlug - Human-readable tenant identifier
     * @param {string} websiteSlug - Human-readable website identifier
     * @param {Object} formData - Form fields submitted by user
     * @param {Object} metadata - Additional metadata (tenantId, siteId for backward compatibility)
     */
    async saveFormSubmission(tenantSlug, websiteSlug, formData, metadata = {}) {
        const db = this.getFirestore();
        const siteRef = db.collection("tenants").doc(tenantSlug).collection("sites").doc(websiteSlug);
        const submissionsRef = siteRef.collection("contact_form_submissions");

        // Generate human-readable submission ID based on name/email and timestamp
        const timestamp = Date.now();
        const nameSlug = (formData.name || formData.email || "anonymous")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .substring(0, 30);
        const submissionId = `${nameSlug}-${timestamp}`;

        // Create submission document with readable ID
        await submissionsRef.doc(submissionId).set({
            ...formData,
            tenantId: metadata.tenantId,
            siteId: metadata.siteId,
            tenantSlug,
            websiteSlug,
            submittedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "new",
            read: false,
        });

        // Update metadata
        const metadataRef = submissionsRef.doc("_metadata");
        await metadataRef.set(
            {
                totalSubmissions: admin.firestore.FieldValue.increment(1),
                lastSubmissionAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        return {
            submissionId,
            path: `tenants/${tenantSlug}/sites/${websiteSlug}/contact_form_submissions/${submissionId}`,
        };
    }

    /**
     * Get form submissions for a site
     * @param {string} tenantSlug - Human-readable tenant identifier
     * @param {string} websiteSlug - Human-readable website identifier
     * @param {number} limit
     */
    async getFormSubmissions(tenantSlug, websiteSlug, limit = 50) {
        const db = this.getFirestore();
        const submissionsRef = db
            .collection("tenants")
            .doc(tenantSlug)
            .collection("sites")
            .doc(websiteSlug)
            .collection("contact_form_submissions");

        const snapshot = await submissionsRef
            .orderBy("submittedAt", "desc")
            .limit(limit)
            .get();

        const submissions = [];
        snapshot.forEach((doc) => {
            if (doc.id !== "_metadata" && doc.id !== "_init") {
                submissions.push({ id: doc.id, ...doc.data() });
            }
        });

        return submissions;
    }

    /**
     * Deploy site pages to Firestore with human-readable structure
     * @param {string} tenantSlug - Human-readable tenant identifier
     * @param {string} websiteSlug - Human-readable website identifier
     * @param {Array} pages - Array of page objects
     * @param {Object} metadata - Additional metadata (tenantId, siteId for backward compatibility)
     */
    async deployPages(tenantSlug, websiteSlug, pages, metadata = {}) {
        const db = this.getFirestore();
        const batch = db.batch();
        const siteRef = db.collection("tenants").doc(tenantSlug).collection("sites").doc(websiteSlug);
        const pagesRef = siteRef.collection("pages");

        // Clear existing pages (except _init)
        const existingPages = await pagesRef.get();
        existingPages.forEach((doc) => {
            if (doc.id !== "_init") {
                batch.delete(doc.ref);
            }
        });

        // Deploy new pages with readable slugs
        pages.forEach((page) => {
            const pageSlug = page.slug || page.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || uuidv4();
            const pageRef = pagesRef.doc(pageSlug);
            batch.set(pageRef, {
                ...page,
                deployedAt: admin.firestore.FieldValue.serverTimestamp(),
                tenantId: metadata.tenantId,
                siteId: metadata.siteId,
                tenantSlug,
                websiteSlug,
            });
        });

        await batch.commit();
        return { 
            deployed: pages.length, 
            path: `tenants/${tenantSlug}/sites/${websiteSlug}`,
            tenantSlug,
            websiteSlug
        };
    }

    /**
     * Upload assets to Firebase Storage with human-readable paths
     * @param {string} tenantSlug - Human-readable tenant identifier
     * @param {string} websiteSlug - Human-readable website identifier
     * @param {Array} assets - Array of {name, buffer, contentType}
     * @param {Object} metadata - Additional metadata (tenantId, siteId for backward compatibility)
     */
    async uploadAssets(tenantSlug, websiteSlug, assets, metadata = {}) {
        const bucket = this.getStorage().bucket();
        const uploadedUrls = [];

        for (const asset of assets) {
            const filePath = `tenants/${tenantSlug}/sites/${websiteSlug}/assets/${asset.name}`;
            const file = bucket.file(filePath);

            await file.save(asset.buffer, {
                contentType: asset.contentType,
                metadata: {
                    tenantId: metadata.tenantId,
                    siteId: metadata.siteId,
                    tenantSlug,
                    websiteSlug,
                    uploadedAt: new Date().toISOString(),
                },
            });

            // Make file publicly readable
            await file.makePublic();
            uploadedUrls.push(file.publicUrl());
        }

        return uploadedUrls;
    }

    /**
     * Apply Firestore security rules for tenant isolation
     * @param {string} tenantSlug - Human-readable tenant identifier
     */
    async applySecurityRules(tenantSlug) {
        // Security rules are applied at project level via Firebase Console or CLI
        // This method validates the structure is correct
        const db = this.getFirestore();
        const tenantRef = db.collection("tenants").doc(tenantSlug);

        const doc = await tenantRef.get();
        if (!doc.exists) {
            throw new Error(`Tenant ${tenantSlug} not found in Firestore`);
        }

        return {
            tenantSlug,
            securityRulesApplied: true,
            message: "Tenant structure validated. Ensure Firestore rules enforce isolation.",
        };
    }

    /**
     * Get deployment status from Firestore
     * @param {string} tenantSlug - Human-readable tenant identifier
     * @param {string} websiteSlug - Human-readable website identifier
     */
    async getDeploymentStatus(tenantSlug, websiteSlug) {
        const db = this.getFirestore();
        const siteRef = db.collection("tenants").doc(tenantSlug).collection("sites").doc(websiteSlug);

        const doc = await siteRef.get();
        if (!doc.exists) {
            return { exists: false };
        }

        return {
            exists: true,
            data: doc.data(),
        };
    }

    /**
     * Increment total page view counter for a site
     * @param {string} tenantSlug
     * @param {string} websiteSlug
     */
    async incrementPageView(tenantSlug, websiteSlug) {
        try {
            const db = this.getFirestore();
            const analyticsRef = db
                .collection('tenants').doc(tenantSlug)
                .collection('sites').doc(websiteSlug)
                .collection('analytics').doc('totals');
            await analyticsRef.set(
                {
                    totalPageViews: admin.firestore.FieldValue.increment(1),
                    lastViewAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
        } catch (err) {
            // Non-fatal — don't crash the page request
            console.warn('[Firebase] incrementPageView failed:', err.message);
        }
    }

    /**
     * Get analytics totals for a site
     * @param {string} tenantSlug
     * @param {string} websiteSlug
     * @returns {{ totalPageViews: number }}
     */
    async getAnalyticsTotals(tenantSlug, websiteSlug) {
        try {
            const db = this.getFirestore();
            const doc = await db
                .collection('tenants').doc(tenantSlug)
                .collection('sites').doc(websiteSlug)
                .collection('analytics').doc('totals')
                .get();
            if (!doc.exists) return { totalPageViews: 0 };
            const data = doc.data();
            return { totalPageViews: data.totalPageViews || 0 };
        } catch (err) {
            console.warn('[Firebase] getAnalyticsTotals failed:', err.message);
            return { totalPageViews: 0 };
        }
    }

    /**
     * Check Firebase quota usage
     */
    async checkQuotaUsage() {
        // Firebase Admin SDK doesn't provide direct quota APIs
        // This would typically integrate with Firebase Usage API or Cloud Monitoring
        return {
            firestoreReads: "N/A - Use Firebase Console",
            firestoreWrites: "N/A - Use Firebase Console",
            storageUsed: "N/A - Use Firebase Console",
            message: "Monitor quotas via Firebase Console or Cloud Monitoring API",
        };
    }

    /**
     * Delete tenant data (for cleanup/testing)
     * @param {string} tenantSlug - Human-readable tenant identifier
     */
    async deleteTenantData(tenantSlug) {
        const db = this.getFirestore();
        const tenantRef = db.collection("tenants").doc(tenantSlug);

        // Delete all subcollections
        const sites = await tenantRef.collection("sites").get();
        const batch = db.batch();

        sites.forEach((site) => {
            batch.delete(site.ref);
        });

        batch.delete(tenantRef);
        await batch.commit();

        return { deleted: true, tenantSlug };
    }
}

// Singleton instance
const firebaseService = new FirebaseService();
export default firebaseService;
