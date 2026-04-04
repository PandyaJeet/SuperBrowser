# 🌐 SuperBrowser

> An intelligent browser powered by AI, combining advanced search capabilities with context-aware AI interactions.

[![Live Demo](https://img.shields.io/badge/Live-Demo-success?style=for-the-badge)](https://superbrowser-d6441.web.app/)
[![Download](https://img.shields.io/badge/Download-EXE-blue?style=for-the-badge)](https://superbrowser-d6441.web.app/)

## 🚀 Quick Links

- **🌐 Live Website**: [https://superbrowser-d6441.web.app/](https://superbrowser-d6441.web.app/)
- **💾 Download EXE**: Visit the [live website](https://superbrowser-d6441.web.app/) to download the desktop application

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)

---

## ✨ Features

### 🔍 SuperSEO - Multi-Engine Search
- **Multiple Search Engines**: Google, Bing, DuckDuckGo
- **Smart Fallback**: Automatically falls back to scrapers if API fails
- **Real-time Results**: Fast and accurate search results
- **Unified Interface**: One search box, multiple sources

### 🤖 SuperAI - Context-Aware AI
- **Multiple AI Personas**: ChatGPT, Claude, Gemini, and more
- **Context Tracking**: Remembers your searches and browsing history per tab
- **Smart Responses**: AI uses your browsing context for better answers
- **Per-Tab Intelligence**: Each tab maintains independent context

### 🎯 Smart Context Management
- Tracks search queries automatically
- Stores search results and visited pages
- Provides context-aware AI responses
- Per-tab context isolation
- Visual context indicators

### 🖥️ Modern UI/UX
- Tab-based browsing interface
- Dark/Light theme support
- Responsive design
- Smooth animations and transitions

---

## 🏗️ Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────────┐   │
│  │   Tabs   │  │  Search  │  │   Context Manager       │   │
│  │  Manager │  │   Bar    │  │  (useContextManager)    │   │
│  └──────────┘  └──────────┘  └─────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                         │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │  SuperSEO  │  │  SuperAI   │  │  Context Service     │  │
│  │  Service   │  │  Service   │  │                      │  │
│  └────────────┘  └────────────┘  └──────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    External APIs                             │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │  SerpAPI   │  │  GROQ API  │  │   Web Scrapers       │  │
│  │  (Search)  │  │  (AI)      │  │                      │  │
│  └────────────┘  └────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
User Query
    │
    ▼
┌─────────────────┐
│   Search Bar    │
│   (Frontend)    │
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │  Mode? │
    └───┬────┘
        │
    ┌───┴───┐
    │       │
    ▼       ▼
┌──────┐ ┌──────┐
│ SEO  │ │  AI  │
└───┬──┘ └──┬───┘
    │       │
    ▼       ▼
┌────────┐ ┌─────────────┐
│SerpAPI/│ │Context +    │
│Scraper │ │GROQ API     │
└───┬────┘ └──┬──────────┘
    │         │
    ▼         ▼
┌────────────────────┐
│   Store Context    │
│  (Per Tab/Session) │
└────────────────────┘
```

### Context Tracking Flow

```
1. User searches "react hooks" (SEO mode)
   └─> Query stored in context
   └─> Results stored in context

2. User searches "useEffect" (SEO mode)
   └─> Query added to context
   └─> Results added to context

3. User switches to AI mode
   └─> Asks: "How do I use these together?"
   └─> AI receives full context
   └─> Response: "Based on your searches about react hooks and useEffect..."
```

---

## 🛠️ Installation

### Prerequisites
- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher)
- **pip** (Python package manager)
- **npm** or **yarn**

### Backend Setup

```bash
cd backend/
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Kill port (if needed):**
```bash
lsof -ti:8000 | xargs kill -9
```

### Frontend Setup

```bash
cd frontend/
npm install
npm run dev -- --host 0.0.0.0
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file inside `backend/` directory:

```env
SERPAPI_API_KEY=your_serpapi_key
GROQ_API_KEY=your_groq_key
```

#### API Keys

**SERPAPI_API_KEY** (or `SERP_API_KEY`)
- Powers SuperSEO search for:
  - Google
  - Bing
  - DuckDuckGo
- Get your key at: [serpapi.com](https://serpapi.com)

**GROQ_API_KEY**
- Powers SuperAI responses
- Get your key at: [console.groq.com](https://console.groq.com)

> **Note**: If any SerpAPI engine fails or returns no results, SuperSEO automatically falls back to the matching web scraper.

---

## 💡 Usage

### Basic Search (SEO Mode)
1. Select **SuperSEO** mode
2. Choose search engine (Google/Bing/DuckDuckGo)
3. Enter your query
4. Browse results

### AI Interaction (AI Mode)
1. Select **SuperAI** mode
2. Choose AI persona (ChatGPT/Claude/Gemini)
3. Ask your question
4. AI responds with context awareness

### Context-Aware Features
- Context is tracked automatically per tab
- Switch between tabs to maintain separate contexts
- View context badge to see tracked information
- AI uses your browsing history for better responses

---

## 📚 API Documentation

### SuperSEO Endpoints

#### Search
```http
POST /api/search/seo
Content-Type: application/json

{
  "query": "react hooks",
  "engine": "google",
  "num_results": 10
}
```

### SuperAI Endpoints

#### AI Query with Context
```http
POST /api/search/ai/contextual
Content-Type: application/json

{
  "query": "How do I use React hooks?",
  "persona": "chatgpt",
  "context": {
    "queries": ["react hooks", "useEffect"],
    "results": [...],
    "visited_pages": [...]
  }
}
```

### Context Management Endpoints

#### Add Query to Context
```http
POST /api/context/add_query
{
  "session_id": "uuid",
  "tab_id": "uuid",
  "query": "react hooks",
  "mode": "seo"
}
```

#### Get Tab Context
```http
GET /api/context/get/{session_id}/{tab_id}
```

#### Clear Context
```http
DELETE /api/context/clear/{session_id}/{tab_id}
```

For more detailed API documentation, see [CONTEXT_FEATURE.md](./CONTEXT_FEATURE.md) and [TESTING.md](./TESTING.md).

---

## 🧪 Testing

See [TESTING.md](./TESTING.md) for comprehensive testing guidelines.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the MIT License.

---

## 🔗 Links

- **Live Demo**: [https://superbrowser-d6441.web.app/](https://superbrowser-d6441.web.app/)
- **Download Desktop App**: Available on the [live website](https://superbrowser-d6441.web.app/)
- **Repository**: [GitHub](https://github.com/PandyaJeet/SuperBrowser)

---

## 👨‍💻 Author

**Jeet Pandya**
- GitHub: [@PandyaJeet](https://github.com/PandyaJeet)

---

<div align="center">
  <p>Made with ❤️ using React, FastAPI, and AI</p>
  <p>⭐ Star this repo if you find it useful!</p>
</div>