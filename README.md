# SuperBrowser

Environment variables (backend)

Create a `.env` file inside `backend/` and set:

SERPAPI_API_KEY=your_serpapi_key
GROQ_API_KEY=your_groq_key

`SERPAPI_API_KEY` (or `SERP_API_KEY`) powers SuperSEO for:
- Google
- Bing
- DuckDuckGo

If any SerpAPI engine fails or returns no results, SuperSEO falls back to the matching scraper immediately.

Backend ::
cd /workspaces/SuperBrowser/backend
pip install -r requirements.txt  # only needed once
uvicorn main:app --reload --host 0.0.0.0 --port 8000

--Kil port :: lsof -ti:8000

Frontend :: 
cd /workspaces/SuperBrowser/frontend
npm install  # only needed once
npm run dev -- --host 0.0.0.0