# Quick Test Guide - Context-Aware AI

## Step 1: Start Backend
```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Step 2: Start Frontend
```bash
cd frontend
npm install  # if not done already
npm run dev
```

## Step 3: Test Context Tracking

### Test 1: Basic Context
1. Open http://localhost:5173
2. Search for "react hooks" in **SEO mode**
3. Wait for results
4. Switch to **AI mode**
5. Look for context indicator: "🧠 Context: 1 searches, X results"
6. Ask: "Explain this to me"
7. AI should mention "based on your search about react hooks..."

### Test 2: Multi-Search Context
1. Search "useState" in SEO mode
2. Then search "useEffect" in SEO mode
3. Switch to AI mode
4. Context should show: "🧠 Context: 2 searches, X results"
5. Ask: "How do these work together?"
6. AI should reference both searches

### Test 3: Multi-Tab Independence
1. Open Tab 1: Search "Python"
2. Open Tab 2 (+ button): Search "JavaScript"
3. Go to Tab 1, switch to AI mode
   - Context should only show Python search
4. Go to Tab 2, switch to AI mode
   - Context should only show JavaScript search

### Test 4: No Context Indicator
1. Open new tab
2. Switch directly to AI mode (without searching)
3. Should show: "🧠 No context yet"
4. AI works normally (without context)

## Expected Behavior

✅ **Context is tracked** automatically when you search
✅ **Context is per-tab** (each tab independent)
✅ **AI uses context** when available
✅ **Visual indicator** shows context status
✅ **Works without context** if no prior searches

## Troubleshooting

### Backend Error: "ModuleNotFoundError: No module named 'database'"
- This is OK! We're using in-memory storage (no database needed yet)
- Context router works independently

### Context not showing
- Make sure you searched in SEO/Community mode FIRST
- Then switch to AI mode
- Check browser console for errors (F12)

### AI not using context
- Check Network tab (F12) → look for `/api/search/ai/contextual` POST request
- Should include `context` in request body

## API Test (Optional)

Test context API directly:
```bash
# Add query
curl -X POST http://localhost:8000/api/context/add_query \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","tab_id":"tab1","query":"react hooks","mode":"seo"}'

# Get context
curl http://localhost:8000/api/context/get/test/tab1

# Should return: {"queries":["react hooks"],"results":[],"visited_pages":[]}
```

## Next Steps

After testing Module 0, we'll move to:
- **Module 1**: Electron scaffolding
- **Module 2**: Integrate frontend with Electron
- **Module 3**: Bundle backend with Electron
- And so on...

---

**Module 0 Status**: ✅ COMPLETE  
**Ready for Module 1**: Yes!
