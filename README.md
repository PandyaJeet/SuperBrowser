<div align="center">

# 🌐 SuperBrowser

### An AI-native browser that searches across engines, understands what you're researching, and answers with context.

SuperBrowser pairs a **multi-engine search aggregator** with a **context-aware AI** that remembers what you've searched and read — per tab — to deliver smarter, grounded answers. It ships as both a **web app** and a **cross-platform desktop app**.

<br/>

[![Live Demo](https://img.shields.io/badge/Live-Demo-22c55e?style=for-the-badge&logo=firefox-browser&logoColor=white)](https://superbrowser-d6441.web.app/)
[![Download Desktop](https://img.shields.io/badge/Download-Desktop_App-3b82f6?style=for-the-badge&logo=electron&logoColor=white)](https://superbrowser-d6441.web.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge)](./LICENSE)

![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.8+-3776AB?style=flat-square&logo=python&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-2C2E3B?style=flat-square&logo=electron&logoColor=9FEAF9)
![TailwindCSS](https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-F55036?style=flat-square&logo=groq&logoColor=white)

</div>

---

## 🚀 Quick Links

| | |
|---|---|
| 🌐 **Live Web App** | [superbrowser-d6441.web.app](https://superbrowser-d6441.web.app/) |
| 💾 **Desktop App** | Download `.exe` / `.dmg` / `.AppImage` from the [live website](https://superbrowser-d6441.web.app/) |
| 📦 **Repository** | [github.com/PandyaJeet/SuperBrowser](https://github.com/PandyaJeet/SuperBrowser) |
| 🤝 **Contributing** | [CONTRIBUTING.md](./CONTRIBUTING.md) · [Code of Conduct](./CODE_OF_CONDUCT.md) |

---

## 📋 Table of Contents :

- [Why SuperBrowser?](#-why-superbrowser)
- [Features](#-features)
- [How It Works](#-how-it-works)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [Running the Desktop App](#-running-the-desktop-app)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [License](#-license)

---

## 💡 Why SuperBrowser?

Traditional search hands you ten blue links and forgets everything the moment you click away. SuperBrowser does three things differently:

1. **🔎 One query, many engines.** It searches Google, Bing, and DuckDuckGo at once — with automatic scraper fallbacks if an API call fails — so you get broader, deduplicated results from a single box.
2. **🧠 It remembers your research.** Every query you run and every page you open is captured into a **per-tab context**. Open a new tab and you get a clean slate; stay in one and your trail compounds.
3. **🤖 The AI uses that context.** When you switch to AI mode and ask a follow-up, the assistant already knows what you've been looking at — so answers are grounded in *your* session, not generic.

The result is a research loop: **Search → Context captured → Ask AI → Smarter answer.**

---

## ✨ Features

### 🔍 SuperSEO — Multi-Engine Search
- **Aggregated results** from Google, Bing, and DuckDuckGo behind one search box.
- **Resilient fallback:** if [SerpAPI](https://serpapi.com) returns nothing or errors, SuperBrowser transparently switches to direct web scrapers (BeautifulSoup) for the same engine.
- **Deduplication & ranking** across sources, plus **Google Shopping** results for product queries.
- **Response caching** with `X-Cache: HIT/MISS` headers to keep repeat searches fast.

### 🤖 SuperAI — Persona-Based, Context-Aware Chat
- **Five answer styles:** `default`, `chatgpt`, `gemini`, `perplexity`, and `claude`, each driven by its own system prompt.
- **Smart live-data routing:** a lightweight classifier decides whether your question needs *fresh web data* (prices, comparisons, news) or can be answered from the model's *general knowledge* — and only scrapes when it helps.
- **Grounded in your session:** the assistant references your recent searches and visited pages for relevant, personalized answers.
- Powered by **Groq** for low-latency inference across Llama 3.1/3.3, Mixtral, and Gemma models.

### 🗣️ Community Insights
- Pulls real discussion from **Stack Overflow, Reddit, Hacker News, and Dev.to**.
- AI-summarized into consensus, tips, debates, and warnings — so you skip the doom-scroll.

### 🧠 Per-Tab Context Engine
- Automatically tracks your **queries**, **results**, and **visited-page content** (first ~5,000 chars).
- **Isolated per tab** — each tab is its own research thread.
- **Visual context badge** shows what's being tracked (`🧠 Context: X searches, Y results`).
- **One-click JSON export** of an entire session for archival or sharing.

### 🖥️ Modern, Dual-Platform UI
- **Tab-based browsing** with independent state per tab.
- **Dark / Light themes**, persisted across sessions.
- Smooth motion via **Framer Motion**, 3D accents via **Three.js**, and **Markdown export** of results.
- Runs in the **browser** *or* as a native **Electron desktop app** (Windows / macOS / Linux).

---

## ⚙️ How It Works

```
   ┌──────────────┐   1. Search "react hooks"      ┌──────────────────────┐
   │   You type   │ ─────────────────────────────► │  Multi-engine search │
   │   a query    │                                │  (SerpAPI ↔ scrapers)│
   └──────────────┘ ◄───────────────────────────── └──────────────────────┘
          │              results returned + cached
          │
          ▼  2. Query + results auto-saved to this tab's context
   ┌──────────────────────────────────────────────────────────────┐
   │   🧠 Per-Tab Context:  queries · results · visited pages       │
   └──────────────────────────────────────────────────────────────┘
          │
          ▼  3. Switch to AI mode, pick a persona, ask a follow-up
   ┌──────────────┐    classify → (scrape if needed) → synthesize   ┌────────┐
   │   SuperAI    │ ◄───────────────────────────────────────────── │  Groq  │
   │  (context-   │                                                 │  LLMs  │
   │   aware)     │ ──► "Based on your searches about react hooks…" └────────┘
   └──────────────┘
```

---

## 🏗️ Architecture

SuperBrowser is a **decoupled two-tier app**: a React/Vite frontend talks to a FastAPI backend over REST. In desktop mode, Electron bundles and supervises the Python backend locally.

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND — React 19 + Vite (web)  ·  Electron 39 (desktop)          │
│  ┌───────────┐  ┌────────────┐  ┌─────────────────────────────────┐ │
│  │  Tab Mgr  │  │ Search Bar │  │ useContextManager (per-tab hook)│ │
│  └───────────┘  └────────────┘  └─────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  REST  (http://localhost:8000/api/…)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND — FastAPI (Uvicorn, async)                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │ /search/seo  │ │ /search/ai   │ │ /search/     │ │ /context/*  │ │
│  │              │ │ /contextual  │ │ community    │ │ (per tab)   │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │
│  query classifier · persona engine · summarizers · caching layer    │
└───────────────┬───────────────────────────────────┬─────────────────┘
                │                                     │
                ▼                                     ▼
        ┌───────────────┐                    ┌────────────────────┐
        │  SerpAPI      │  ── fallback ──►    │  Web Scrapers      │
        │  Groq LLM API │                     │  (BeautifulSoup)   │
        └───────────────┘                    └────────────────────┘
```

> **Note:** Context is held **in memory** on the backend (no database), scoped per `session_id` → `tab_id`, with a 1-hour idle TTL. It persists for the life of the server process and can be exported to JSON at any time.

---

## 🧰 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, TailwindCSS, Framer Motion, Three.js / React Three Fiber, Recharts |
| **Desktop** | Electron 39, electron-builder (NSIS · DMG · AppImage) |
| **Backend** | Python 3.8+, FastAPI, Uvicorn, httpx, BeautifulSoup4, cachetools |
| **AI & Search** | Groq (Llama 3.1/3.3, Mixtral, Gemma), SerpAPI, custom scrapers |
| **Hosting / CI** | Firebase Hosting, GitHub Actions |

---

## 🛠️ Getting Started

### Prerequisites

- **Node.js** ≥ 16 and **npm**
- **Python** ≥ 3.8 and **pip**
- API keys for [**SerpAPI**](https://serpapi.com) and [**Groq**](https://console.groq.com) (see [Configuration](#-configuration))

### 1. Clone the repo

```bash
git clone https://github.com/PandyaJeet/SuperBrowser.git
cd SuperBrowser
```

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt

# create your .env (see Configuration below), then run:
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at **http://localhost:8000**, with interactive docs at **http://localhost:8000/docs**.

> **Port already in use?** `lsof -ti:8000 | xargs kill -9`

### 3. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open **http://localhost:5173** in your browser. The frontend auto-detects its API base (local, Codespaces, or Electron), so no extra config is needed for local dev.

---

## 🔐 Configuration

Create a `.env` file inside the **`backend/`** directory:

```env
# Required — powers SuperSEO search across Google, Bing & DuckDuckGo
SERPAPI_API_KEY=your_serpapi_key

# Required — powers all SuperAI responses & summaries
GROQ_API_KEY=your_groq_key

# Optional — CORS allow-list (comma-separated). Defaults to http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
```

| Variable | Required | Purpose | Get a key |
|---|:---:|---|---|
| `SERPAPI_API_KEY` *(or `SERP_API_KEY`)* | ✅ | Live search results for SuperSEO | [serpapi.com](https://serpapi.com) |
| `GROQ_API_KEY` | ✅ | LLM inference for SuperAI & summaries | [console.groq.com](https://console.groq.com) |
| `ALLOWED_ORIGINS` | ⬜ | CORS origins for the backend | — |

**Frontend overrides** (optional, via Vite env): `VITE_API_BASE` and `VITE_API_BASE_ELECTRON` let you point the UI at a custom backend URL.

> If any SerpAPI engine fails or returns nothing, SuperSEO automatically falls back to the matching web scraper — so search keeps working even without a perfect API response.

---

## 🖥️ Running the Desktop App

SuperBrowser can run as a native Electron app that **spawns and supervises the Python backend for you**.

```bash
cd frontend

# Dev: runs Vite + Electron together with hot reload
npm run dev:electron

# Build distributables
npm run dist:win     # Windows  → NSIS installer
npm run dist:mac     # macOS    → .dmg
npm run dist:linux   # Linux    → .AppImage
```

In desktop mode the app talks to the backend over `http://127.0.0.1:8000` and cleanly terminates the backend process on exit. A single-instance lock prevents duplicate windows.

---

## 📚 API Reference

All routes are served under **`http://localhost:8000`**. Full interactive docs (Swagger UI) live at **`/docs`**.

### Search

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/search/seo?q={query}` | Multi-engine search with scraper fallback. |
| `GET` | `/api/search/ai?q={query}&persona={p}&gl={region}` | AI answer (persona-styled, region-aware). |
| `POST` | `/api/search/ai/contextual` | AI answer using full browsing context *(body below)*. |
| `GET` | `/api/search/community?q={query}` | Summarized insights from SO, Reddit, HN, Dev.to. |

<details>
<summary><b>Example — contextual AI request</b></summary>

```http
POST /api/search/ai/contextual
Content-Type: application/json

{
  "query": "How do I use these together?",
  "persona": "perplexity",
  "context": {
    "queries": ["react hooks", "useEffect"],
    "results": [ { "title": "...", "url": "...", "snippet": "..." } ],
    "visited_pages": [ { "url": "...", "content": "..." } ]
  }
}
```

`persona` is one of: `default` · `chatgpt` · `gemini` · `perplexity` · `claude`.
</details>

### Context Management

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/context/session/start` | Start a browsing session. |
| `POST` | `/api/context/add_query` | Add a query to a tab's context. |
| `POST` | `/api/context/add_results` | Add search results to a tab's context. |
| `POST` | `/api/context/add_visited_page` | Add visited-page content to context. |
| `GET` | `/api/context/get/{session_id}/{tab_id}` | Fetch a tab's context. |
| `GET` | `/api/context/export/{session_id}` | Export the full session context as JSON. |
| `POST` | `/api/context/chat` | Chat with the AI about your browsing context. |
| `DELETE` | `/api/context/clear/{session_id}/{tab_id}` | Clear one tab's context. |

For deeper detail see [CONTEXT_FEATURE.md](./CONTEXT_FEATURE.md) and [TESTING.md](./TESTING.md).

---

## 📂 Project Structure

```
SuperBrowser/
├── backend/                 # FastAPI app
│   ├── main.py              # App entry point & router mounting
│   ├── routers/             # seo · ai · community · context endpoints
│   ├── services/            # groq, super_ai, query_classifier, personas, summarizers
│   ├── scrapers/            # Google/Bing/DDG + SO/Reddit/HN/Dev.to scrapers
│   ├── utils/               # caching helpers
│   └── requirements.txt
├── frontend/                # React + Vite + Electron
│   ├── src/
│   │   ├── App.jsx          # App shell, tabs, search dispatch
│   │   ├── components/      # AiInput, CommunityResults, ProductCarousel, …
│   │   ├── config/apiBase.js# API base resolution (web/Codespaces/Electron)
│   │   └── useContextManager.js
│   └── electron/            # main.cjs, preload.cjs (desktop runtime)
├── systemprompt/            # Persona system prompts (perplexity, sonnet, …)
└── .github/workflows/       # CI: star-check, auto-label
```

---

## 🤝 Contributing

Contributions are welcome! Please read **[CONTRIBUTING.md](./CONTRIBUTING.md)** for setup, issue-claim, branch-naming, and PR conventions, and review our **[Code of Conduct](./CODE_OF_CONDUCT.md)**.

For **GSSoC** contributions, comment your proposed approach on an issue and wait for assignment before coding.

> ⭐ **Please star this repository before submitting a pull request.** Starring is required for your PR to be merged. A `star-check` workflow reports whether the PR author has starred the repo, and maintainers will not merge unstarred contributions.

---

## 📄 License

Released under the **[MIT License](./LICENSE)**.

---

## 👨‍💻 Authors

| Profile | Name | GitHub |
| :---: | :--- | :--- |
| <img src="https://github.com/PandyaJeet.png" width="50px" style="border-radius:50%;" alt="Jeet Pandya"/> | **Jeet Pandya** | [@PandyaJeet](https://github.com/PandyaJeet) |
| <img src="https://github.com/Princepatel-027.png" width="50px" style="border-radius:50%;" alt="Prince Patel"/> | **Prince Patel** | [@Princepatel-027](https://github.com/Princepatel-027) |


## Contributors

<!-- CONTRIBUTORS_START -->
<a href="https://github.com/Akanksha-73"><img src="https://github.com/Akanksha-73.png" width="50px" loading="lazy" title="Akanksha-73" style="border-radius:50%;margin:5px;" alt="Akanksha-73" /></a><a href="https://github.com/Antra1705"><img src="https://github.com/Antra1705.png" width="50px" loading="lazy" title="Antra1705" style="border-radius:50%;margin:5px;" alt="Antra1705" /></a><a href="https://github.com/Himanshujha7"><img src="https://github.com/Himanshujha7.png" width="50px" loading="lazy" title="Himanshujha7" style="border-radius:50%;margin:5px;" alt="Himanshujha7" /></a><a href="https://github.com/Krishtiy"><img src="https://github.com/Krishtiy.png" width="50px" loading="lazy" title="Krishtiy" style="border-radius:50%;margin:5px;" alt="Krishtiy" /></a><a href="https://github.com/Nicks-19"><img src="https://github.com/Nicks-19.png" width="50px" loading="lazy" title="Nicks-19" style="border-radius:50%;margin:5px;" alt="Nicks-19" /></a><a href="https://github.com/PandyaJeet"><img src="https://github.com/PandyaJeet.png" width="50px" loading="lazy" title="PandyaJeet" style="border-radius:50%;margin:5px;" alt="PandyaJeet" /></a><a href="https://github.com/YashKrTripathi"><img src="https://github.com/YashKrTripathi.png" width="50px" loading="lazy" title="YashKrTripathi" style="border-radius:50%;margin:5px;" alt="YashKrTripathi" /></a><a href="https://github.com/goyalpreeti009"><img src="https://github.com/goyalpreeti009.png" width="50px" loading="lazy" title="goyalpreeti009" style="border-radius:50%;margin:5px;" alt="goyalpreeti009" /></a><a href="https://github.com/harshapriyag123"><img src="https://github.com/harshapriyag123.png" width="50px" loading="lazy" title="harshapriyag123" style="border-radius:50%;margin:5px;" alt="harshapriyag123" /></a><a href="https://github.com/itsdakshjain"><img src="https://github.com/itsdakshjain.png" width="50px" loading="lazy" title="itsdakshjain" style="border-radius:50%;margin:5px;" alt="itsdakshjain" /></a><a href="https://github.com/khushboo-khatoon"><img src="https://github.com/khushboo-khatoon.png" width="50px" loading="lazy" title="khushboo-khatoon" style="border-radius:50%;margin:5px;" alt="khushboo-khatoon" /></a><a href="https://github.com/mittalsonal"><img src="https://github.com/mittalsonal.png" width="50px" loading="lazy" title="mittalsonal" style="border-radius:50%;margin:5px;" alt="mittalsonal" /></a><a href="https://github.com/pranavv2707"><img src="https://github.com/pranavv2707.png" width="50px" loading="lazy" title="pranavv2707" style="border-radius:50%;margin:5px;" alt="pranavv2707" /></a><a href="https://github.com/rishit537"><img src="https://github.com/rishit537.png" width="50px" loading="lazy" title="rishit537" style="border-radius:50%;margin:5px;" alt="rishit537" /></a><a href="https://github.com/saurabhhhcodes"><img src="https://github.com/saurabhhhcodes.png" width="50px" loading="lazy" title="saurabhhhcodes" style="border-radius:50%;margin:5px;" alt="saurabhhhcodes" /></a><a href="https://github.com/shriyashkulkarni4-oss"><img src="https://github.com/shriyashkulkarni4-oss.png" width="50px" loading="lazy" title="shriyashkulkarni4-oss" style="border-radius:50%;margin:5px;" alt="shriyashkulkarni4-oss" /></a><a href="https://github.com/toufiq00007"><img src="https://github.com/toufiq00007.png" width="50px" loading="lazy" title="toufiq00007" style="border-radius:50%;margin:5px;" alt="toufiq00007" /></a><a href="https://github.com/vipul674"><img src="https://github.com/vipul674.png" width="50px" loading="lazy" title="vipul674" style="border-radius:50%;margin:5px;" alt="vipul674" /></a><a href="https://github.com/vishal-kushwaha-9912"><img src="https://github.com/vishal-kushwaha-9912.png" width="50px" loading="lazy" title="vishal-kushwaha-9912" style="border-radius:50%;margin:5px;" alt="vishal-kushwaha-9912" /></a>
<!-- CONTRIBUTORS_END -->

Updates automatically as new contributors merge pull requests. 
Start contributing and see your profile here?

<div align="center">
<br/>
<sub>Built using React, FastAPI, and AI.</sub>
<br/>
<b>⭐ If SuperBrowser helps you, give it a star!</b>
</div>


