# SitePilot — Local Setup Guide

AI website builder with a deep-learning **SEO / engagement / design-flaw** engine.

## Stack
- **frontend/** — React + Vite
- **backend/** — Node/Express + MongoDB (+ Firebase, Socket.IO)
- **ai_engine/** — Python Flask ML microservice (port 5050): layout recommender + DL SEO/design/engagement models
- **LLMs** — Ollama (`qwen3.5:4b`) locally, with Google Gemini as fallback

## Prerequisites
- **Node.js 18+** and npm
- **Python 3.10+** and pip
- **MongoDB** (local or Atlas connection string)
- **Ollama** — https://ollama.com — then: `ollama pull qwen3.5:4b`
- (optional) A Gemini API key and Unsplash API keys

## 1. Clone
```bash
git clone https://github.com/shaktisankpal/SitePilot.git
cd SitePilot
git checkout ronit      # the branch with the DL SEO engine
```

## 2. Backend
```bash
cd backend
npm install
cp .env.example .env     # then fill in the values (see below)
npm run dev              # starts on the PORT in .env (default 5000)
```
Fill `.env` with at least: `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `OLLAMA_HOST=http://127.0.0.1:11434`.
Optional but recommended: `GEMINI_API_KEY`, `UNSPLASH_ACCESS_KEY`, Firebase + Razorpay keys.

## 3. Frontend
```bash
cd ../frontend
npm install
npm run dev              # Vite dev server (proxies /api to the backend)
```

## 4. AI engine (Python ML service)
```bash
cd ../ai_engine
pip install -r requirements.txt

# Train the small DL models (one-time; they are committed, so this is optional):
python train_seo_model.py        # -> seo_mlp.pt
python dump_templates.mjs         # -> templates_seed.json  (needs node)
python train_design_model.py     # -> design_ae.pt, design_if.pkl, design_norm.json
python train_gru_model.py         # -> gru.pt

python ai_service.py             # serves on http://localhost:5050
```
> **Note on `layout_model.pkl`:** the 467 MB RandomForest layout recommender is **not** in git
> (exceeds GitHub's 100 MB limit). The service runs fine without it — `/generate-layout`
> falls back to a sensible default block set, and the SEO/design/engagement engines are
> unaffected. To use the full recommender, obtain that file separately (or via Git LFS).

## 5. Start Ollama
```bash
ollama serve            # if not already running
ollama pull qwen3.5:4b  # one-time
```

## Run order (4 terminals)
1. `ollama serve` (or it's already running)
2. `cd ai_engine && python ai_service.py`
3. `cd backend && npm run dev`
4. `cd frontend && npm run dev` → open the printed localhost URL

## Using the DL SEO engine
Open a project in the builder → click the **SEO** button (top toolbar) → the panel offers:
- **SEO score** + weak-factor hints + **Auto-Improve with AI** (preview → Apply)
- **Engagement** suggestions with one-click **Apply** (reorder for conversion)
- **Design Health** score + flaws + **Auto-fix** (e.g. contrast)
