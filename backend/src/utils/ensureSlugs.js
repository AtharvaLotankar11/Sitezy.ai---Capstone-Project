import Website from "../modules/website/website.model.js";
import Tenant from "../modules/tenant/tenant.model.js";

/**
 * Utility script to ensure all websites and tenants have slugs
 * Run this before migration to ensure data integrity
 * 
 * USAGE:
 * node backend/src/utils/ensureSlugs.js
 */

function generateSlug(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function ensureSlugs() {
    console.log("🔍 Checking for missing slugs...\n");
    
    try {
        // Check tenants
        const tenantsWithoutSlug = await Tenant.find({ 
            $or: [
                { slug: { $exists: false } },
                { slug: null },
                { slug: "" }
            ]
        });
        
        if (tenantsWithoutSlug.length > 0) {
            console.log(`📝 Found ${tenantsWithoutSlug.length} tenants without slugs`);
            
            for (const tenant of tenantsWithoutSlug) {
                const slug = generateSlug(tenant.name);
                
                // Check for duplicates
                let finalSlug = slug;
                let counter = 1;
                while (await Tenant.findOne({ slug: finalSlug, _id: { $ne: tenant._id } })) {
                    finalSlug = `${slug}-${counter}`;
                    counter++;
                }
                
                tenant.slug = finalSlug;
                await tenant.save();
                console.log(`   ✅ ${tenant.name} → ${finalSlug}`);
            }
        } else {
            console.log("✅ All tenants have slugs");
        }
        
        // Check websites
        const websitesWithoutSlug = await Website.find({ 
            $or: [
                { slug: { $exists: false } },
                { slug: null },
                { slug: "" }
            ]
        });
        
        if (websitesWithoutSlug.length > 0) {
            console.log(`\n📝 Found ${websitesWithoutSlug.length} websites without slugs`);
            
            for (const website of websitesWithoutSlug) {
                const slug = generateSlug(website.name);
                
                // Check for duplicates within same tenant
                let finalSlug = slug;
                let counter = 1;
                while (await Website.findOne({ 
                    slug: finalSlug, 
                    tenantId: website.tenantId,
                    _id: { $ne: website._id } 
                })) {
                    finalSlug = `${slug}-${counter}`;
                    counter++;
                }
                
                website.slug = finalSlug;
                await website.save();
                console.log(`   ✅ ${website.name} → ${finalSlug}`);
            }
        } else {
            console.log("✅ All websites have slugs");
        }
        
        console.log("\n✅ Slug check completed!");
        
    } catch (error) {
        console.error("❌ Error ensuring slugs:", error);
        throw error;
    }
}

// Export function
export { ensureSlugs };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    ensureSlugs()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}
