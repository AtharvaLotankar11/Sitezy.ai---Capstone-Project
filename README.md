# 🚀 Sitezy.ai
**AI-Powered Multi-Tenant Website Builder Platform**

*Empowering organizations to create, customize, deploy, and manage their websites within a governed SaaS ecosystem.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Made with React](https://img.shields.io/badge/Made_with-React-61DAFB?logo=react&logoColor=white)](#)
[![Powered by Node.js](https://img.shields.io/badge/Powered_by-Node.js-339933?logo=nodedotjs&logoColor=white)](#)
[![Database: MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?logo=mongodb&logoColor=white)](#)

---

## 📖 Overview

**Problem Statement 2: Web Development**

Sitezy.ai is a robust, scalable multi-tenant SaaS platform that enables multiple non-technical users, independent organizations, and businesses to host and manage their own branded websites via a shared unified infrastructure. Taking inspiration from systems where independent teams operate under one governing structure, Sitezy.ai provides a centralized platform that ensures high governance, operational consistency, and intelligent automation while allowing complete logical isolation among tenants. 

With Sitezy.ai, building professional-quality websites is a breeze! AI-assisted creation automates layout generation, content structuring, and component formulation. All tenant operations—from onboarding, plan subscription, real-time collaboration, and monitoring—are streamlined.

---

## ✨ Key Features

### 🏢 Multi-Tenant Architecture and Isolation
Strict logical isolation keeps every tenant's data, assets, users, and branding strictly self-contained. The platform maintains a structured ecosystem wherein configurations and limits adjust according to exactly what the tenant's current subscription enables.

### 🤖 AI-Powered Website Builder
Leveraging state-of-the-art Artificial Intelligence to massively cut down on manual labor:
- Automatically generate entire website layouts and structures using basic text prompts.
- Recommend UI components, hierarchical organizations, and accessibility configurations based on the business type.
- Empowers non-technical users to quickly deploy stunning, professional-grade websites effortlessly.

### 🏗️ Structured Site Creation & Content Workflow
Using an intuitive drag-and-drop workflow:
- Build modular pages utilizing a variety of customizable, reusable components.
- Keep the workflow organized with support for drafts, editing, and publishing stages.
- Automated safeguards strictly enforce responsive layouts and limits according to the tenant’s selected tier.

### 🎨 Branding and Asset Customization
Total control over tenant identities:
- Define global palettes, typography, logos, and media to apply consistently across entire site portfolios.
- Centralized media asset management with tier-specific storage allowances and automated accessibility checks.

### 🌐 Domain Management & Deployment Workflow
Launch to the world efficiently:
- Automatically generated default subdomains paired with support for **custom domain mapping**.
- Full deployment history logs updates, helping you roll back easily and move safely between preview drafts and production visibility.

### 🔐 Role-Based Access Control (RBAC)
Robust security workflows that support collaboration mapping:
- Defines multiple hierarchical roles within organizations (Owner, Admin, Editor, Developer).
- Precise enforcement preventing unauthorized users from accessing billing details, sensitive content editing, or domain configurations.

### 💳 Subscription Plans & Automated Lifecycle Management
An integrated built-in economy engine:
- Flexible SaaS subscription tiers restricting websites, pages, AI prompts, custom domains, and components.
- Seamless upgrade and downgrade capabilities linked automatically to active limits without harming existing data.
- Streamlined automated tenant onboarding and offboarding.

---

## 🏆 Brownie Points Achieved

1. **Real-Time Collaboration & Version Control** 
   - Multiple users within a single tenant can co-create and edit a website *simultaneously* via **Socket.io**.
   - Built-in historical versioning to track iterative changes, allowing you to instantly roll back to an older version seamlessly.

2. **Usage Monitoring & Observability**
   - Prometheus integration effectively monitors all vital website metrics, traffic, and resource consumption tracking.
   - Distinct metric-rich tenant dashboards proactively advise users when they approach thresholds or when they should consider upgrading their plans.

---

## 🛠️ Technology Stack

| Stack       | Technologies Used |
| ----------- | ----------------- |
| **Frontend** | React 19, Vite, Tailwind CSS, Redux Toolkit, Socket.io-client, Dnd (Drag-and-Drop) |
| **Backend** | Node.js, Express, Mongoose, Socket.io (WebSockets), Firebase Admin, Prometheus |
| **AI** | Google Generative AI / OpenAI Integration |
| **Payments**| Razorpay |
| **Database**| MongoDB |
| **Deployment**| Docker |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+)
- MongoDB instance (local or Atlas)
- Docker (optional for production deployment)

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/sitezy.ai.git
cd sitezy.ai
```

### 2. Environment Variables Setup
Create `.env` files in both the `frontend` and `backend` directories using the provided example models (`.env.example`).
```bash
# In backend
cp .env.example .env
# Fill in your API keys (Gemini, Razorpay, MongoDB URI, JWT Secrets, etc.)
```

### 3. Install Dependencies
```bash
# Terminal 1 - Backend
cd backend
npm install
npm run dev

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

### 4. Docker Deployment
```bash
# Build the production image with Docker
docker build -t sitezy.ai-app .

# Run the application (mapped to port 5001 to avoid dev conflict)
docker run -d --name sitezy.ai-container -p 5001:5000 --env-file backend/.env -e NODE_ENV=production sitezy.ai-app
```

---

> **BUILT BY: npm i asmr**
