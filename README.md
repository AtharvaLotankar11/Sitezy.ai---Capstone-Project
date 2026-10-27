# 🚀 Sitezy.ai

**AI-Powered, Multi-Tenant Website Builder — design, generate, edit, deploy, and export production-ready sites from one governed SaaS platform.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white)](#)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)](#)
[![Python ML](https://img.shields.io/badge/AI_Engine-PyTorch_%2B_Flask-EE4C2C?logo=pytorch&logoColor=white)](#)

---

## 📖 Overview

Sitezy.ai is a multi-tenant SaaS website builder for non-technical teams. Describe what you want in plain language and the platform's AI generates a complete, multi-page site — copy, layout, colours, fonts, and imagery. You then refine it in a real-time visual builder, run on-device deep-learning checks for SEO/engagement/design, publish to a subdomain or custom domain, and even **export the whole thing as a clean static site**.

Every organisation ("tenant") is fully isolated, governed by role-based access and subscription limits, and monitored with Prometheus metrics.

---

## ✨ Feature Tour

### 🤖 AI Playground — generate a full site from a prompt
- **Describe your concept** in natural language and generate a complete multi-page site (Home / About / Contact) with real copy, sections, colours and images.
- **AI auto-configure** — let the AI pick the base template, tone, audience, theme, purpose and brand colours from your description.
- **Base templates** (Ivory Editorial, Neon Pop, Midnight Cobalt, Forest Heritage, Charcoal Volt, and more), **Tone / Audience / Theme Mode / Website Purpose** controls, **brand colours**, and selectable **Required Blocks** (Hero, Gallery, Pricing, FAQ, Contact, etc.).
- **Basic AI** (fast, local) or **Pro AI** (higher quality, more relevant images).
- **Voice input** and **multilingual prompts** (English / Hindi / Marathi) translated on-device before generation.
- Relevant photography is auto-sourced from **Unsplash** and injected into the layout.

### 🏗️ Visual Builder
- **Page layers** with drag-and-drop reordering, inline editing, and per-section styling (background, text & accent colours, fonts).
- **Section library:** Navbar, Hero, Text, Gallery, CTA, Contact Form, **Dynamic Form**, Footer, Button, Image, Spacer.
- **Dynamic form builder** — add/remove fields and choose the type: text, email, tel, number, date, textarea, **dropdown, radio, checkbox** (with editable options).
- **Multi-page management** — add pages with an **AI "Add Page"** that picks a matching template, writes fresh copy, and **auto-links the new page into every navbar**.
- **Auto-interconnected navbars** — links resolve to your real pages automatically (no manual URL filling); clicking a nav item in the editor switches pages.
- **Real-time collaboration** (Socket.io) with live cursors, plus **version history** to snapshot and roll back.

### 🧠 Deep-Learning SEO, Engagement & Design Suite
A Python ML microservice powers an in-builder **"SEO & Insights"** panel:
- **SEO scoring** — a PyTorch MLP rates 15 on-page factors (keyword density, heading hierarchy, readability, alt coverage, structured data, etc.) and a **regression-safe Auto-Improve** rewrites weak copy with the LLM (never lowering the score), plus one-click **meta description + JSON-LD** generation.
- **Engagement readiness** — an explainable score (CTA placement, conversion form, structure, balance) complemented by a **GRU** conversion-likelihood signal and ablation-based suggestions.
- **Design health** — an **autoencoder + Isolation Forest + rubric** flags contrast, hierarchy and structural issues with one-click fixes.
- **Layout recommender** — a RandomForest + zero-shot (MiniLM) model suggests the right blocks for a business type.

### 🌐 Publishing, Domains & Export
- Auto-generated **subdomains** + **custom domain** mapping (add / verify / **rename** / open live).
- **Deployment snapshots** with full history and **rollback**.
- **One-click code export** — downloads a **pixel-exact static copy of your live preview** (rendered through the same components), zipped in the browser, with interconnected multi-page navigation, baked-in colours/fonts/copy/images and SEO meta.

### 📊 Analytics & Forms
- Live & total visitor counts, **form-submission inbox**, and **AI-generated business insights** from real form data.
- Public-site **dynamic forms** persist submissions to **Firebase Firestore**; published sites include an **AI Q&A chat widget** grounded in the site's content.

### 🏢 Multi-Tenancy, RBAC & Billing
- Strict per-tenant isolation of data, users, assets and branding.
- **Roles:** Owner, Admin, Editor, Developer — enforced across billing, domains and content.
- **Subscription tiers** (Razorpay) cap websites, pages, AI usage, domains, etc., with seamless upgrade/downgrade.
- **Prometheus** metrics for usage/observability.

### 🪄 In-App AI Help Assistant
A floating assistant on the dashboard and in the builder answers "how do I…/what is…" questions (what a Navbar/CTA is, what SEO does, how to add a page or edit an image, etc.) with concise, step-by-step, platform-accurate guidance.

---

## 🧱 Architecture

Three services run together:

| Service | Stack | Port | Responsibility |
| --- | --- | --- | --- |
| **Frontend** | React 19, Vite, Redux Toolkit, React Router 7, Tailwind 4, @hello-pangea/dnd, socket.io-client | `5173` | Dashboard, AI Playground, visual builder, published-site renderer, in-browser export |
| **Backend API** | Node.js, Express, Mongoose, Socket.io, JWT, Prometheus, Firebase Admin, Razorpay | `5000` | Auth/tenancy, builder & pages, AI orchestration, domains, analytics, payments |
| **AI Engine** | Python, Flask, PyTorch, scikit-learn, Transformers | `5050` | SEO MLP, GRU engagement, design autoencoder/Isolation Forest, RandomForest layout recommender |

**LLMs:** the backend uses **Ollama (`qwen3.5:4b`)** locally with a Google **Gemini** cloud fallback for layout generation, auto-configure, SEO rewrites, the visitor chatbot, and the help assistant.

```
SitePilot/
├── frontend/        # React 19 + Vite SPA (builder, playground, renderer, export)
├── backend/         # Express API, Socket.io, MongoDB models, AI orchestration
│   └── src/modules/ # auth, tenant, website, builder, ai, domain, analytics,
│                    #   deployment, forms, payment, upload, admin
├── ai_engine/       # Flask ML microservice + train_*.py + model artifacts
├── Dockerfile       # Production image
└── prometheus.yml   # Metrics scrape config
```

---

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite 7, Redux Toolkit, React Router 7, Tailwind CSS 4, @hello-pangea/dnd, lucide-react, socket.io-client, react-hot-toast
- **Backend:** Node.js (ESM), Express, Mongoose/MongoDB, Socket.io, JWT, Joi, Helmet, express-rate-limit, prom-client, Firebase Admin, Razorpay, Multer
- **AI Engine:** Python, Flask, PyTorch, scikit-learn, Transformers (MiniLM zero-shot), NumPy/Pandas
- **LLMs:** Ollama (`qwen3.5:4b`) + Google Generative AI (Gemini) fallback
- **Media:** Unsplash API · **Forms/Storage:** Firebase · **Payments:** Razorpay · **Deploy:** Docker

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 20+** and **npm**
- **MongoDB** (local or Atlas)
- **Python 3.10+** (for the AI engine)
- **[Ollama](https://ollama.com/)** with the model pulled: `ollama pull qwen3.5:4b` (optional — Gemini is used as a fallback)
- Optional keys: **Gemini**, **Unsplash**, **Razorpay**, **Firebase** service account

### 1) Clone
```bash
git clone https://github.com/shaktisankpal/SitePilot.git
cd SitePilot
```

### 2) Backend
```bash
cd backend
npm install
# create .env (see variables below)
npm run dev          # starts API on http://localhost:5000
# optional: seed subscription plans / demo data
npm run seed:plans
```

### 3) Frontend
```bash
cd frontend
npm install
npm run dev          # starts the app on http://localhost:5173
```

### 4) AI Engine (deep-learning service)
```bash
cd ai_engine
pip install -r requirements.txt
# (first run only) train the small models that ship as artifacts:
python train_seo_model.py && python train_design_model.py && python train_gru_model.py
python ai_service.py     # serves ML endpoints on http://localhost:5050
```

> The SEO/engagement/design panel and the layout recommender call the AI engine. If it's offline, those features degrade gracefully; the rest of the app keeps working.

### Environment Variables (`backend/.env`)

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Auth token signing secret |
| `PORT` | API port (default `5000`) |
| `NODE_ENV` | `development` / `production` |
| `AI_ENGINE_URL` | Python ML service URL (default `http://localhost:5050`) |
| `OLLAMA_HOST` | Ollama host (default `http://127.0.0.1:11434`) |
| `GEMINI_API_KEY` | Google Generative AI key (LLM fallback) |
| `UNSPLASH_ACCESS_KEY` | Unsplash image search |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Subscription payments |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` / `FIREBASE_STORAGE_BUCKET` | Form submissions, storage |

The frontend talks to the API at `http://localhost:5000` in dev.

### 🐳 Docker (production)
```bash
docker build -t sitezy-app .
docker run -d --name sitezy -p 5001:5000 --env-file backend/.env -e NODE_ENV=production sitezy-app
```

---

## 🔌 API Surface (high level)

`/api/auth` · `/api/tenant` · `/api/websites` · `/api/builder/websites/:websiteId/pages` · `/api/ai` (generate, auto-configure, SEO score/auto-improve/generate-meta, design health, engagement, help) · `/api/domains` · `/api/analytics` · `/api/publish` · `/api/forms` & `/api/public/forms` · `/api/public/unsplash` · `/api/upload` · `/api/payment` · `/api/admin`

---

## 🧪 The AI Engine in detail (`ai_engine/`)

| File | Model | Output |
| --- | --- | --- |
| `seo_features.py` + `train_seo_model.py` + `seo_engine.py` | MLP (15→64→32→1) | 0–100 SEO score + per-factor diagnostics |
| `design_features.py` + `train_design_model.py` + `design_engine.py` | Autoencoder (20→…→4) + Isolation Forest + rubric | Design health score + flaws + fixes |
| `gru_features.py` + `train_gru_model.py` + `gru_engine.py` | Dual GRU (12→64→32) | Conversion likelihood + ablation suggestions |
| `ai_service.py` (`/generate-layout`) | RandomForest + MiniLM zero-shot | Recommended section blocks |

All extra models train deterministically on synthetic/bootstrapped data via the `train_*.py` scripts and ship as small `.pt` / `.pkl` / `.json` artifacts.

---

## 📜 License

MIT.
