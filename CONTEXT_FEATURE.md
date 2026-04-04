# Context-Aware AI Feature

## Overview
SuperBrowser now tracks your browsing context (searches, results, clicked pages) and uses it to provide more relevant AI responses.

## What Gets Tracked
- **Search Queries**: All queries you make in each tab
- **Search Results**: Top results from your searches  
- **Visited Pages**: Content from pages you click (limited to 5000 chars per page)

## How It Works

### Frontend (React)
- `useContextManager.js`: Hook that manages context storage per tab
- Tracks context in-memory (cleared on app close)
- Automatically sends context to backend for persistence

### Backend (FastAPI)
- `/api/context/*`: Endpoints for context management
- `/api/search/ai/contextual`: AI endpoint that accepts context
- `services/super_ai.py`: Formats context for AI consumption

## Features

### 1. Per-Tab Context
Each tab maintains its own browsing context:
```javascript
{
  queries: ["react hooks", "useEffect"],
  results: [{url, title, snippet, content}],
  visited_pages: [{url, title, content, timestamp}]
}
```

### 2. Context-Aware AI
When you ask a question in AI mode, the system:
1. Retrieves context from current tab
2. Formats it (last 5 queries, top 10 results, last 3 visited pages)
3. Sends to AI with your question
4. AI responds with contextual awareness

### 3. Visual Indicators
- **Context Badge**: Shows when AI has context
- Displays: "Context: X searches, Y results"
- Click to view context details

## API Endpoints

### Add Query to Context
```http
POST /api/context/add_query
{
  "session_id": "uuid",
  "tab_id": "uuid",
  "query": "react hooks",
  "mode": "seo"
}
```

### Add Results to Context
```http
POST /api/context/add_results
{
  "session_id": "uuid",
  "tab_id": "uuid",
  "results": [{url, title, snippet, content}]
}
```

### Get Tab Context
```http
GET /api/context/get/{session_id}/{tab_id}
```

### Clear Tab Context
```http
DELETE /api/context/clear/{session_id}/{tab_id}
```

### AI with Context
```http
POST /api/search/ai/contextual
{
  "query": "How do I fix this?",
  "persona": "chatgpt",
  "context": {
    "queries": [...],
    "results": [...],
    "visited_pages": [...]
  }
}
```

## Usage Example

1. **User searches** "react hooks" in SEO mode
   - Query tracked: "react hooks"
   - Results saved to context

2. **User searches** "useEffect" in SEO mode
   - Query tracked: "useEffect"
   - Results added to context

3. **User switches to AI mode** and asks "How do I use these together?"
   - AI receives context of previous searches
   - Response: "Based on your searches about react hooks and useEffect..."

## Future Enhancements (with SQLite)
- Persistent history across sessions
- Search through past contexts
- Export browsing history
- "Use context from yesterday" feature

## Testing

### Test Context Tracking
1. Search for something in SEO mode
2. Switch to AI mode
3. Look for context indicator (should show "Context: 1 searches, X results")
4. Ask AI a follow-up question
5. AI should reference your previous search

### Test Multi-Tab Context
1. Open multiple tabs
2. Search different things in each
3. Switch to AI mode in each tab
4. Each should have independent context

## Notes
- Context stored in-memory (RAM)
- Cleared when app/server restarts
- No database required for basic functionality
- Each tab = isolated context
- Maximum limits: 20 queries, 50 results, 10 visited pages per tab
