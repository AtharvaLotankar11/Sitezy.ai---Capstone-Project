import firebaseService from "../agents/services/firebaseService.js";
import Tenant from "../modules/tenant/tenant.model.js";
import Website from "../modules/website/website.model.js";
import admin from "firebase-admin";

/**
 * Migration Script: Convert Firestore from ID-based to Human-Readable Structure
 * 
 * OLD STRUCTURE:
 * /tenants/{mongoId}/sites/{mongoId}/submissions/{autoId}
 * 
 * NEW STRUCTURE:
 * /tenants/{tenantSlug}/sites/{websiteSlug}/contact_form_submissions/{readable-name-timestamp}
 * 
 * USAGE:
 * node -r esm backend/src/utils/migrateFirestoreStructure.js
 * 
 * OR from code:
 * import { migrateFirestoreStructure } from './utils/migrateFirestoreStructure.js';
 * await migrateFirestoreStructure();
 */

async function migrateFirestoreStructure() {
    console.log("🚀 Starting Firestore structure migration...");
    
    try {
        // Initialize Firebase
        firebaseService.initialize();
        const db = firebaseService.getFirestore();
        
        // Get all tenants from MongoDB
        const tenants = await Tenant.find({}).lean();
        console.log(`📊 Found ${tenants.length} tenants to migrate`);
        
        let migratedTenants = 0;
        let migratedSites = 0;
        let migratedSubmissions = 0;
        
        for (const tenant of tenants) {
            const oldTenantId = tenant._id.toString();
            const newTenantSlug = tenant.slug || oldTenantId;
            
            console.log(`\n👤 Migrating tenant: ${tenant.name} (${oldTenantId} → ${newTenantSlug})`);
            
            // Get old tenant ref
            const oldTenantRef = db.collection("tenants").doc(oldTenantId);
            const oldTenantDoc = await oldTenantRef.get();
            
            if (!oldTenantDoc.exists) {
                console.log(`   ⚠️  No Firestore data found for tenant ${oldTenantId}, skipping...`);
                continue;
            }
            
            // Create new tenant structure
            const newTenantRef = db.collection("tenants").doc(newTenantSlug);
            await newTenantRef.set({
                ...oldTenantDoc.data(),
                tenantId: oldTenantId,
                tenantSlug: newTenantSlug,
                migratedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            
            migratedTenants++;
            
            // Get all websites for this tenant
            const websites = await Website.find({ tenantId: tenant._id }).lean();
            console.log(`   📄 Found ${websites.length} websites`);
            
            for (const website of websites) {
                const oldSiteId = website._id.toString();
                const newWebsiteSlug = website.slug || website.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || oldSiteId;
                
                console.log(`      🌐 Migrating website: ${website.name} (${oldSiteId} → ${newWebsiteSlug})`);
                
                // Get old site ref
                const oldSiteRef = oldTenantRef.collection("sites").doc(oldSiteId);
                const oldSiteDoc = await oldSiteRef.get();
                
                if (!oldSiteDoc.exists) {
                    console.log(`         ⚠️  No Firestore data found, skipping...`);
                    continue;
                }
                
                // Create new site structure
                const newSiteRef = newTenantRef.collection("sites").doc(newWebsiteSlug);
                await newSiteRef.set({
                    ...oldSiteDoc.data(),
                    siteId: oldSiteId,
                    tenantId: oldTenantId,
                    websiteSlug: newWebsiteSlug,
                    websiteName: website.name,
                    migratedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                
                migratedSites++;
                
                // Migrate pages
                const oldPagesSnapshot = await oldSiteRef.collection("pages").get();
                if (!oldPagesSnapshot.empty) {
                    console.log(`         📑 Migrating ${oldPagesSnapshot.size} pages...`);
                    const batch = db.batch();
                    oldPagesSnapshot.forEach(doc => {
                        if (doc.id !== "_init") {
                            const newPageRef = newSiteRef.collection("pages").doc(doc.id);
                            batch.set(newPageRef, {
                                ...doc.data(),
                                tenantSlug: newTenantSlug,
                                websiteSlug: newWebsiteSlug,
                                migratedAt: admin.firestore.FieldValue.serverTimestamp(),
                            });
                        }
                    });
                    await batch.commit();
                }
                
                // Migrate submissions (old: submissions, new: contact_form_submissions)
                const oldSubmissionsSnapshot = await oldSiteRef.collection("submissions").get();
                if (!oldSubmissionsSnapshot.empty) {
                    console.log(`         📝 Migrating ${oldSubmissionsSnapshot.size} form submissions...`);
                    const batch = db.batch();
                    
                    oldSubmissionsSnapshot.forEach(doc => {
                        if (doc.id !== "_init" && doc.id !== "_metadata") {
                            const data = doc.data();
                            
                            // Generate human-readable ID
                            const timestamp = data.submittedAt?.toMillis() || Date.now();
                            const nameSlug = (data.name || data.email || "anonymous")
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, '-')
                                .substring(0, 30);
                            const newSubmissionId = `${nameSlug}-${timestamp}`;
                            
                            const newSubmissionRef = newSiteRef.collection("contact_form_submissions").doc(newSubmissionId);
                            batch.set(newSubmissionRef, {
                                ...data,
                                tenantSlug: newTenantSlug,
                                websiteSlug: newWebsiteSlug,
                                migratedAt: admin.firestore.FieldValue.serverTimestamp(),
                            });
                            
                            migratedSubmissions++;
                        }
                    });
                    
                    await batch.commit();
                }
                
                // Migrate metadata
                const oldMetadataDoc = await oldSiteRef.collection("submissions").doc("_metadata").get();
                if (oldMetadataDoc.exists) {
                    await newSiteRef.collection("contact_form_submissions").doc("_metadata").set({
                        ...oldMetadataDoc.data(),
                        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
                
                console.log(`         ✅ Website migrated successfully`);
            }
            
            console.log(`   ✅ Tenant migrated successfully`);
        }
        
        console.log("\n" + "=".repeat(60));
        console.log("✅ MIGRATION COMPLETED SUCCESSFULLY!");
        console.log("=".repeat(60));
        console.log(`📊 Summary:`);
        console.log(`   - Tenants migrated: ${migratedTenants}`);
        console.log(`   - Websites migrated: ${migratedSites}`);
        console.log(`   - Form submissions migrated: ${migratedSubmissions}`);
        console.log("\n⚠️  IMPORTANT NEXT STEPS:");
        console.log("   1. Verify data in Firebase Console");
        console.log("   2. Deploy new Firestore security rules:");
        console.log("      firebase deploy --only firestore:rules");
        console.log("   3. Test form submissions on generated websites");
        console.log("   4. Once verified, you can delete old structure:");
        console.log("      node backend/src/utils/cleanupOldFirestoreData.js");
        
    } catch (error) {
        console.error("❌ Migration failed:", error);
        throw error;
    }
}

// Cleanup script to remove old data after verification
async function cleanupOldFirestoreData() {
    console.log("🧹 Starting cleanup of old Firestore structure...");
    console.log("⚠️  WARNING: This will DELETE old data. Make sure migration was successful!");
    console.log("⚠️  Press Ctrl+C within 10 seconds to cancel...");
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    try {
        firebaseService.initialize();
        const db = firebaseService.getFirestore();
        
        const tenants = await Tenant.find({}).lean();
        
        for (const tenant of tenants) {
            const oldTenantId = tenant._id.toString();
            const oldTenantRef = db.collection("tenants").doc(oldTenantId);
            
            // Check if this is an old ID-based structure (not a slug)
            if (oldTenantId.match(/^[0-9a-f]{24}$/i)) {
                console.log(`🗑️  Deleting old tenant structure: ${oldTenantId}`);
                
                // Delete all subcollections
                const sites = await oldTenantRef.collection("sites").get();
                for (const siteDoc of sites.docs) {
                    const siteRef = siteDoc.ref;
                    
                    // Delete pages
                    const pages = await siteRef.collection("pages").get();
                    for (const pageDoc of pages.docs) {
                        await pageDoc.ref.delete();
                    }
                    
                    // Delete submissions
                    const submissions = await siteRef.collection("submissions").get();
                    for (const submissionDoc of submissions.docs) {
                        await submissionDoc.ref.delete();
                    }
                    
                    // Delete site
                    await siteRef.delete();
                }
                
                // Delete tenant
                await oldTenantRef.delete();
                console.log(`   ✅ Deleted`);
            }
        }
        
        console.log("✅ Cleanup completed!");
        
    } catch (error) {
        console.error("❌ Cleanup failed:", error);
        throw error;
    }
}

// Export functions
export { migrateFirestoreStructure, cleanupOldFirestoreData };

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateFirestoreStructure()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}
