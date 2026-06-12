import client from "prom-client";

// Create a custom registry to only expose product metrics (no CPU/RAM)
const registry = new client.Registry();

// Metric: Page views per website
export const websitePageViewsTotal = new client.Counter({
    name: "website_page_views_total",
    help: "Total page views per website",
    labelNames: ["tenantId", "websiteId"],
    registers: [registry],
});

// Metric: Publish events per website
export const websitePublishTotal = new client.Counter({
    name: "website_publish_total",
    help: "Total publish events per website",
    labelNames: ["tenantId", "websiteId"],
    registers: [registry],
});

// Metric: AI engine usage per website
export const aiUsageTotal = new client.Counter({
    name: "ai_usage_total",
    help: "Total AI engine usage per website",
    labelNames: ["tenantId", "websiteId"],
    registers: [registry],
});

// Optional: Number of websites created per tenant
export const tenantWebsitesTotal = new client.Counter({
    name: "tenant_websites_total",
    help: "Total websites created per tenant",
    labelNames: ["tenantId"],
    registers: [registry],
});

export { registry };
