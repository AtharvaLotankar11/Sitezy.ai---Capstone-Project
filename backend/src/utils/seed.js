import "dotenv/config";
import mongoose from "mongoose";
import Tenant from "../modules/tenant/tenant.model.js";
import User from "../modules/auth/user.model.js";
import Website from "../modules/website/website.model.js";
import Page from "../modules/builder/page.model.js";
import Domain from "../modules/domain/domain.model.js";

const seed = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    await Promise.all([
        Tenant.deleteMany({}),
        User.deleteMany({}),
        Website.deleteMany({}),
        Page.deleteMany({}),
        Domain.deleteMany({}),
    ]);
    console.log("🧹 Cleared existing data");

    // Tenant 1
    const tenant1 = await Tenant.create({
        name: "Acme Corp",
        slug: "acme",
        branding: {
            primaryColor: "#6366f1",
            secondaryColor: "#8b5cf6",
            font: "Inter",
        },
    });

    const owner1 = await User.create({
        tenantId: tenant1._id,
        name: "Alice Johnson",
        email: "alice@acme.com",
        password: "password123",
        role: "OWNER",
    });

    tenant1.ownerId = owner1._id;
    await tenant1.save();

    await User.create([
        { tenantId: tenant1._id, name: "Bob Admin", email: "bob@acme.com", password: "password123", role: "ADMIN", invitedBy: owner1._id },
        { tenantId: tenant1._id, name: "Carol Editor", email: "carol@acme.com", password: "password123", role: "EDITOR", invitedBy: owner1._id },
        { tenantId: tenant1._id, name: "Dave Dev", email: "dave@acme.com", password: "password123", role: "DEVELOPER", invitedBy: owner1._id },
    ]);

    const site1 = await Website.create({
        tenantId: tenant1._id,
        name: "Acme Main Site",
        description: "Our flagship website",
        status: "published",
        publishedAt: new Date(),
        createdBy: owner1._id,
        defaultDomain: "acme.localhost",
    });

    await Page.create({
        tenantId: tenant1._id,
        websiteId: site1._id,
        title: "Home",
        slug: "home",
        isHomePage: true,
        status: "published",
        createdBy: owner1._id,
        layoutConfig: {
            sections: [
                { id: "s1", type: "Navbar", props: { brand: "Acme Corp", links: ["Home", "About", "Services", "Contact"] }, order: 0 },
                { id: "s2", type: "Hero", props: { heading: "Build Better Websites", subheading: "Powered by Sitezy.ai AI", ctaText: "Get Started", ctaLink: "#", backgroundImage: "" }, order: 1 },
                { id: "s3", type: "Text", props: { heading: "About Acme", description: "We have been building exceptional digital experiences since 2010. Our team of experts delivers cutting-edge solutions." }, order: 2 },
                { id: "s4", type: "Gallery", props: { heading: "Our Work", items: ["Project Alpha", "Project Beta", "Project Gamma", "Project Delta"] }, order: 3 },
                { id: "s5", type: "CTA", props: { heading: "Ready to Get Started?", subheading: "Join hundreds of satisfied customers.", ctaText: "Contact Us", ctaLink: "#contact" }, order: 4 },
                { id: "s6", type: "ContactForm", props: { heading: "Get In Touch", fields: ["name", "email", "message"] }, order: 5 },
                { id: "s7", type: "Footer", props: { text: "© 2026 Acme Corp. All rights reserved." }, order: 6 },
            ],
        },
    });

    await Domain.create({ tenantId: tenant1._id, domain: "acme.localhost", verified: true, isDefault: true });

    // Tenant 2
    const tenant2 = await Tenant.create({
        name: "TechFlow Studio",
        slug: "techflow",
        branding: {
            primaryColor: "#0ea5e9",
            secondaryColor: "#38bdf8",
            font: "Roboto",
        },
    });

    const owner2 = await User.create({
        tenantId: tenant2._id,
        name: "Eve Smith",
        email: "eve@techflow.com",
        password: "password123",
        role: "OWNER",
    });

    tenant2.ownerId = owner2._id;
    await tenant2.save();

    await Domain.create({ tenantId: tenant2._id, domain: "techflow.localhost", verified: true, isDefault: true });

    console.log("\n🌱 Seed complete!\n");
    console.log("═══════════════════════════════════════");
    console.log("TENANT 1: Acme Corp");
    console.log("  Slug: acme");
    console.log("  Login: alice@acme.com / password123 (OWNER)");
    console.log("  Login: bob@acme.com / password123 (ADMIN)");
    console.log("  Login: carol@acme.com / password123 (EDITOR)");
    console.log("  Login: dave@acme.com / password123 (DEVELOPER)");
    console.log("  Domain: acme.localhost");
    console.log("\nTENANT 2: TechFlow Studio");
    console.log("  Slug: techflow");
    console.log("  Login: eve@techflow.com / password123 (OWNER)");
    console.log("  Domain: techflow.localhost");
    console.log("═══════════════════════════════════════\n");

    await mongoose.disconnect();
    process.exit(0);
};

seed().catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
});
