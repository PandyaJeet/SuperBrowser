"""
Context API Router - Handles context tracking, session lifecycle, and export.
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Body
from pydantic import BaseModel

router = APIRouter()

# In-memory context storage (cleared on server restart)
# Structure: {session_id: {tab_id: context_data}}
_context_store: Dict[str, Dict[str, Dict]] = {}

# Session metadata storage
# Structure: {session_id: {session_id, started_at, ended_at, status}}
_session_store: Dict[str, Dict[str, Optional[str]]] = {}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_session(session_id: str) -> None:
    if session_id not in _session_store:
        _session_store[session_id] = {
            "session_id": session_id,
            "started_at": _utc_now_iso(),
            "ended_at": None,
            "status": "active",
        }

    if session_id not in _context_store:
        _context_store[session_id] = {}


def _ensure_tab_context(session_id: str, tab_id: str) -> Dict:
    _ensure_session(session_id)

    if tab_id not in _context_store[session_id]:
        _context_store[session_id][tab_id] = {
            "queries": [],
            "results": [],
            "visited_pages": [],
        }

    return _context_store[session_id][tab_id]


def _session_stats(session_id: str) -> Dict[str, int]:
    tabs = _context_store.get(session_id, {})
    query_count = sum(len(tab.get("queries", [])) for tab in tabs.values())
    result_count = sum(len(tab.get("results", [])) for tab in tabs.values())
    visited_count = sum(len(tab.get("visited_pages", [])) for tab in tabs.values())

    return {
        "tab_count": len(tabs),
        "query_count": query_count,
        "result_count": result_count,
        "visited_count": visited_count,
    }


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


@router.post("/context/session/start")
async def start_session(session_id: str = Body(..., embed=True)):
    """Start (or resume) a context session."""
    _ensure_session(session_id)
    session = _session_store[session_id]

    if session.get("status") != "active":
        session["status"] = "active"
        session["ended_at"] = None

    return {
        "status": "success",
        "session": session,
        "stats": _session_stats(session_id),
    }


@router.post("/context/session/stop/{session_id}")
async def stop_session(session_id: str):
    """Stop a context session."""
    if session_id not in _session_store and session_id not in _context_store:
        return {
            "status": "success",
            "message": "Session not found",
            "session_id": session_id,
            "stats": {
                "tab_count": 0,
                "query_count": 0,
                "result_count": 0,
                "visited_count": 0,
            },
        }

    _ensure_session(session_id)
    session = _session_store[session_id]
    session["status"] = "stopped"
    if not session.get("ended_at"):
        session["ended_at"] = _utc_now_iso()

    return {
        "status": "success",
        "session": session,
        "stats": _session_stats(session_id),
    }


@router.get("/context/export/{session_id}")
async def export_session_context(session_id: str):
    """Export all context for a session as JSON payload."""
    if session_id not in _session_store and session_id not in _context_store:
        return {
            "status": "not_found",
            "session_id": session_id,
            "session": None,
            "tabs": {},
            "stats": {
                "tab_count": 0,
                "query_count": 0,
                "result_count": 0,
                "visited_count": 0,
            },
        }

    _ensure_session(session_id)
    return {
        "status": "success",
        "session_id": session_id,
        "session": _session_store[session_id],
        "tabs": _context_store.get(session_id, {}),
        "stats": _session_stats(session_id),
    }


@router.post("/context/update")
async def update_context(update: ContextUpdate):
    """Update context for a specific tab."""
    tab_context = _ensure_tab_context(update.session_id, update.tab_id)

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
            "visited_pages": len(tab_context["visited_pages"]),
        },
    }


@router.get("/context/get/{session_id}/{tab_id}")
async def get_context(session_id: str, tab_id: str):
    """Get context for a specific tab."""
    if session_id not in _context_store or tab_id not in _context_store[session_id]:
        return {
            "queries": [],
            "results": [],
            "visited_pages": [],
        }

    return _context_store[session_id][tab_id]


@router.get("/context/session/{session_id}")
async def get_session_context(session_id: str):
    """Get all context for a session (all tabs)."""
    if session_id not in _context_store and session_id not in _session_store:
        return {
            "session": None,
            "tabs": {},
            "stats": {
                "tab_count": 0,
                "query_count": 0,
                "result_count": 0,
                "visited_count": 0,
            },
        }

    _ensure_session(session_id)
    return {
        "session": _session_store[session_id],
        "tabs": _context_store.get(session_id, {}),
        "stats": _session_stats(session_id),
    }


@router.delete("/context/clear/{session_id}/{tab_id}")
async def clear_tab_context(session_id: str, tab_id: str):
    """Clear context for a specific tab."""
    if session_id in _context_store and tab_id in _context_store[session_id]:
        del _context_store[session_id][tab_id]
        return {"status": "success", "message": "Tab context cleared"}

    return {"status": "success", "message": "No context to clear"}


@router.delete("/context/clear/{session_id}")
async def clear_session_context(session_id: str):
    """Clear all context for a session."""
    if session_id in _context_store:
        del _context_store[session_id]

    if session_id in _session_store:
        del _session_store[session_id]

    return {"status": "success", "message": "Session context cleared"}


@router.post("/context/add_query")
async def add_query_to_context(
    session_id: str = Body(...),
    tab_id: str = Body(...),
    query: str = Body(...),
    mode: str = Body(...),
):
    """Add a query to tab context."""
    tab_context = _ensure_tab_context(session_id, tab_id)

    tab_context["queries"].append(query)
    tab_context["queries"] = tab_context["queries"][-20:]

    return {"status": "success", "message": "Query added to context", "mode": mode}


@router.post("/context/add_results")
async def add_results_to_context(
    session_id: str = Body(...),
    tab_id: str = Body(...),
    results: List[ResultRecord] = Body(...),
):
    """Add search results to tab context."""
    tab_context = _ensure_tab_context(session_id, tab_id)
    tab_context["results"] = [r.dict() for r in results][-50:]

    return {"status": "success", "message": "Results added to context"}


@router.post("/context/add_visited_page")
async def add_visited_page_to_context(
    session_id: str = Body(...),
    tab_id: str = Body(...),
    page: VisitedPage = Body(...),
):
    """Add a visited page to tab context."""
    tab_context = _ensure_tab_context(session_id, tab_id)

    tab_context["visited_pages"].append(page.dict())
    tab_context["visited_pages"] = tab_context["visited_pages"][-20:]

    return {"status": "success", "message": "Visited page added to context"}
