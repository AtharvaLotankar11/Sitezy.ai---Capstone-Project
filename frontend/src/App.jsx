import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Provider } from "react-redux";
import { Toaster } from "react-hot-toast";
import store from "./store/store.js";

import PublicLayout from "./layouts/PublicLayout.jsx";
import ProtectedLayout from "./layouts/ProtectedLayout.jsx";
import LoginPage from "./features/auth/LoginPage.jsx";
import RegisterPage from "./features/auth/RegisterPage.jsx";
import DashboardPage from "./features/dashboard/DashboardPage.jsx";
import WebsitesPage from "./features/dashboard/WebsitesPage.jsx";
import AnalyticsPage from "./features/dashboard/AnalyticsPage.jsx";
import BuilderPage from "./features/builder/BuilderPage.jsx";
import AIGeneratorPage from "./features/ai/AIGeneratorPage.jsx";
import SettingsPage from "./features/settings/SettingsPage.jsx";
import SubscriptionPage from "./features/subscription/SubscriptionPage.jsx";
import PublicSiteRenderer from "./features/publicSite/PublicSiteRenderer.jsx";
import TemplatePreviewPage from "./features/publicSite/TemplatePreviewPage.jsx";
import HomePage from "./features/home/HomePage.jsx";

export default function App() {
  const hostname = window.location.hostname;

  // Identify if we are viewing a published site via subdomain or custom domain
  const isSaasApp =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "sitezy.ai.com" ||
    hostname === "www.sitezy.ai.com" ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) ||
    hostname.includes("ngrok") ||
    hostname.includes("onrender.com");

  if (!isSaasApp) {
    return (
      <Provider store={store}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicSiteRenderer />} />
            <Route path="/:pageSlug" element={<PublicSiteRenderer />} />
          </Routes>
        </BrowserRouter>
      </Provider>
    );
  }

  return (
    <Provider store={store}>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
            error: { iconTheme: { primary: "#f87171", secondary: "#fff" } },
          }}
        />
        <Routes>
          {/* Public pages — share Navbar + Footer via PublicLayout */}
          <Route element={<PublicLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Dev-only template preview (no backend) */}
          <Route path="/preview" element={<TemplatePreviewPage />} />
          <Route path="/preview/:templateId" element={<TemplatePreviewPage />} />

          {/* Public site rendering (no shared layout) */}
          <Route path="/site/:tenantSlug" element={<PublicSiteRenderer />} />
          <Route path="/site/:tenantSlug/:pageSlug" element={<PublicSiteRenderer />} />

          {/* Protected app routes */}
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/websites" element={<WebsitesPage />} />
            <Route path="/websites/:websiteId/analytics" element={<AnalyticsPage />} />
            <Route path="/websites/:websiteId/builder" element={<BuilderPage />} />
            <Route path="/websites/:websiteId/builder/:pageId" element={<BuilderPage />} />
            <Route path="/ai" element={<AIGeneratorPage />} />
            <Route path="/subscription" element={<SubscriptionPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}
