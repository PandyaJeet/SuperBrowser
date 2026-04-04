"""
Context API Router - Handles context tracking and retrieval
"""
from fastapi import APIRouter, Body
from pydantic import BaseModel
from typing import List, Dict, Optional

router = APIRouter()

# In-memory context storage (cleared on server restart)
# Structure: {session_id: {tab_id: context_data}}
_context_store: Dict[str, Dict[str, Dict]] = {}


class QueryRecord(BaseModel):
    """Model for a search query"""
    query: str
    mode: str
    timestamp: str


class ResultRecord(BaseModel):
    """Model for a search result"""
    url: str
    title: str
    snippet: str
    content: Optional[str] = ""


class VisitedPage(BaseModel):
    """Model for a visited/clicked page"""
    url: str
    title: str
    content: str
    timestamp: str


class ContextUpdate(BaseModel):
    """Model for updating tab context"""
    session_id: str
    tab_id: str
    queries: Optional[List[str]] = None
    results: Optional[List[ResultRecord]] = None
    visited_pages: Optional[List[VisitedPage]] = None


@router.post("/context/update")
async def update_context(update: ContextUpdate):
    """Update context for a specific tab"""
    session_id = update.session_id
    tab_id = update.tab_id
    
    # Initialize session if not exists
    if session_id not in _context_store:
        _context_store[session_id] = {}
    
    # Initialize tab if not exists
    if tab_id not in _context_store[session_id]:
        _context_store[session_id][tab_id] = {
            "queries": [],
            "results": [],
            "visited_pages": []
        }
    
    # Update context
    tab_context = _context_store[session_id][tab_id]
    
    if update.queries is not None:
        tab_context["queries"] = update.queries
    
    if update.results is not None:
        tab_context["results"] = [r.dict() for r in update.results]
    
    if update.visited_pages is not None:
        tab_context["visited_pages"] = [p.dict() for p in update.visited_pages]
    
    return {
        "status": "success",
        "message": "Context updated",
        "context_size": {
            "queries": len(tab_context["queries"]),
            "results": len(tab_context["results"]),
            "visited_pages": len(tab_context["visited_pages"])
        }
    }


@router.get("/context/get/{session_id}/{tab_id}")
async def get_context(session_id: str, tab_id: str):
    """Get context for a specific tab"""
    if session_id not in _context_store:
        return {
            "queries": [],
            "results": [],
            "visited_pages": []
        }
    
    if tab_id not in _context_store[session_id]:
        return {
            "queries": [],
            "results": [],
            "visited_pages": []
        }
    
    return _context_store[session_id][tab_id]


@router.get("/context/session/{session_id}")
async def get_session_context(session_id: str):
    """Get all context for a session (all tabs)"""
    if session_id not in _context_store:
        return {"tabs": {}}
    
    return {"tabs": _context_store[session_id]}


@router.delete("/context/clear/{session_id}/{tab_id}")
async def clear_tab_context(session_id: str, tab_id: str):
    """Clear context for a specific tab"""
    if session_id in _context_store and tab_id in _context_store[session_id]:
        del _context_store[session_id][tab_id]
        return {"status": "success", "message": "Tab context cleared"}
    
    return {"status": "success", "message": "No context to clear"}


@router.delete("/context/clear/{session_id}")
async def clear_session_context(session_id: str):
    """Clear all context for a session"""
    if session_id in _context_store:
        del _context_store[session_id]
        return {"status": "success", "message": "Session context cleared"}
    
    return {"status": "success", "message": "No context to clear"}


@router.post("/context/add_query")
async def add_query_to_context(
    session_id: str = Body(...),
    tab_id: str = Body(...),
    query: str = Body(...),
    mode: str = Body(...)
):
    """Add a query to tab context"""
    # Initialize if needed
    if session_id not in _context_store:
        _context_store[session_id] = {}
    if tab_id not in _context_store[session_id]:
        _context_store[session_id][tab_id] = {
            "queries": [],
            "results": [],
            "visited_pages": []
        }
    
    # Add query
    _context_store[session_id][tab_id]["queries"].append(query)
    
    return {"status": "success", "message": "Query added to context"}


@router.post("/context/add_results")
async def add_results_to_context(
    session_id: str = Body(...),
    tab_id: str = Body(...),
    results: List[ResultRecord] = Body(...)
):
    """Add search results to tab context"""
    # Initialize if needed
    if session_id not in _context_store:
        _context_store[session_id] = {}
    if tab_id not in _context_store[session_id]:
        _context_store[session_id][tab_id] = {
            "queries": [],
            "results": [],
            "visited_pages": []
        }
    
    # Add results (keep last 50)
    _context_store[session_id][tab_id]["results"] = [r.dict() for r in results][-50:]
    
    return {"status": "success", "message": "Results added to context"}


@router.post("/context/add_visited_page")
async def add_visited_page_to_context(
    session_id: str = Body(...),
    tab_id: str = Body(...),
    page: VisitedPage = Body(...)
):
    """Add a visited page to tab context"""
    # Initialize if needed
    if session_id not in _context_store:
        _context_store[session_id] = {}
    if tab_id not in _context_store[session_id]:
        _context_store[session_id][tab_id] = {
            "queries": [],
            "results": [],
            "visited_pages": []
        }
    
    # Add page (keep last 20)
    _context_store[session_id][tab_id]["visited_pages"].append(page.dict())
    _context_store[session_id][tab_id]["visited_pages"] = _context_store[session_id][tab_id]["visited_pages"][-20:]
    
    return {"status": "success", "message": "Visited page added to context"}
