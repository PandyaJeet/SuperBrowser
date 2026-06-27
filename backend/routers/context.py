"""
Context API Router - Handles context tracking, session lifecycle, chat, and export.
"""

import time
import os
import secrets
from datetime import datetime, timezone
from typing import Dict, List, Optional, Annotated
import uuid

from fastapi import APIRouter, Body
from pydantic import BaseModel, Field
from fastapi import APIRouter, Body, Header, HTTPException, Depends
from pydantic import BaseModel

from services.groq_service import ask_groq
from database import get_context_db
from services.personas import get_persona

VALID_TOKEN = os.environ.get("SUPERBROWSER_SESSION_TOKEN", secrets.token_urlsafe(32))

def verify_token(x_session_token: str = Header(default="")):
    if not VALID_TOKEN or not secrets.compare_digest(x_session_token, VALID_TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized")

router = APIRouter(dependencies=[Depends(verify_token)])

_context_store: Dict[str, Dict[str, Dict]] = {}
_session_store: Dict[str, Dict[str, Optional[str]]] = {}
_chat_history: Dict[str, List[Dict[str, str]]] = {}

SESSION_TTL_SECONDS = 3600


# ── Existing Request Models ─────────────────────────────────
class QueryRecord(BaseModel):
    """Model for a search query"""
    query: str = Field(..., max_length=1000)
    mode: str = Field(..., max_length=50)
    timestamp: str = Field(..., max_length=50)


class ResultRecord(BaseModel):
    """Model for a search result"""
    url: str = Field(..., max_length=2048)
    title: str = Field(..., max_length=500)
    snippet: str = Field(..., max_length=2000)
    content: Optional[str] = Field(default="", max_length=50000)


class VisitedPage(BaseModel):
    """Model for a visited/clicked page"""
    url: str = Field(..., max_length=2048)
    title: str = Field(..., max_length=500)
    content: str = Field(..., max_length=100000)
    timestamp: str = Field(..., max_length=50)


class ContextUpdate(BaseModel):
    """Model for updating tab context"""
    session_id: str = Field(..., max_length=100)
    tab_id: str = Field(..., max_length=100)
    queries: Optional[List[Annotated[str, Field(max_length=1000)]]] = Field(default=None, max_length=20)
    results: Optional[List[ResultRecord]] = Field(default=None, max_length=20)
    visited_pages: Optional[List[VisitedPage]] = Field(default=None, max_length=50)


class ChatSessionCreate(BaseModel):
    tab_id: str
    session_id: Optional[str] = None


# ── NEW Response Models ─────────────────────────────────────
class SessionStats(BaseModel):
    tab_count: int
    query_count: int
    result_count: int
    visited_count: int


class SessionInfo(BaseModel):
    session_id: str
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    status: Optional[str] = None
    last_accessed: Optional[float] = None


class SessionResponse(BaseModel):
    status: str
    session: Optional[SessionInfo] = None
    stats: Optional[SessionStats] = None
    message: Optional[str] = None
    session_id: Optional[str] = None


class ContextSizeResponse(BaseModel):
    queries: int
    results: int
    visited_pages: int


class UpdateContextResponse(BaseModel):
    status: str
    message: str
    context_size: ContextSizeResponse


class TabContextResponse(BaseModel):
    queries: List[str] = []
    results: List[dict] = []
    visited_pages: List[dict] = []


class SessionContextResponse(BaseModel):
    session: Optional[SessionInfo] = None
    tabs: dict = {}
    stats: SessionStats


class ExportSessionResponse(BaseModel):
    status: str
    session_id: Optional[str] = None
    session: Optional[SessionInfo] = None
    tabs: dict = {}
    stats: SessionStats


class ClearResponse(BaseModel):
    status: str
    message: str


class AddQueryResponse(BaseModel):
    status: str
    message: str
    mode: str


class ChatSessionResponse(BaseModel):
    status: str
    session_id: str


class ChatSessionItem(BaseModel):
    session_id: str
    tab_id: Optional[str] = None
    created_at: Optional[str] = None


class ChatSessionsListResponse(BaseModel):
    status: str
    sessions: List[dict] = []


class ChatMessageItem(BaseModel):
    id: str
    text: str
    sender: str
    model: Optional[str] = None
    created_at: Optional[str] = None


class ChatMessagesResponse(BaseModel):
    status: str
    messages: List[ChatMessageItem] = []


class ChatResponse(BaseModel):
    status: str
    response: str
    model_used: str
    context_available: bool


class ModelInfo(BaseModel):
    id: str
    name: str
    description: str
    provider: str


class ModelsResponse(BaseModel):
    status: str
    models: List[ModelInfo]
    default: str


# ── Helper Functions ────────────────────────────────────────
def evict_expired_sessions():
    now = time.time()
    expired = [k for k, v in _session_store.items()
               if now - v.get("last_accessed", 0) > SESSION_TTL_SECONDS]
    for k in expired:
        _context_store.pop(k, None)
        _session_store.pop(k, None)
        _chat_history.pop(k, None)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_session(session_id: str) -> None:
    evict_expired_sessions()
    now = time.time()
    if session_id not in _session_store:
        _session_store[session_id] = {
            "session_id": session_id,
            "started_at": _utc_now_iso(),
            "ended_at": None,
            "status": "active",
            "last_accessed": now,
        }
    else:
        _session_store[session_id]["last_accessed"] = now
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
    return {
        "tab_count": len(tabs),
        "query_count": sum(len(tab.get("queries", [])) for tab in tabs.values()),
        "result_count": sum(len(tab.get("results", [])) for tab in tabs.values()),
        "visited_count": sum(len(tab.get("visited_pages", [])) for tab in tabs.values()),
    }


def _build_context_summary(session_id: str) -> str:
    if session_id not in _context_store:
        return "No context available yet. The user hasn't performed any searches."
    tabs = _context_store[session_id]
    summary_parts = []
    for tab_id, tab_data in tabs.items():
        queries = tab_data.get("queries", [])
        results = tab_data.get("results", [])
        visited = tab_data.get("visited_pages", [])
        if queries or results or visited:
            tab_summary = f"\n--- Tab Context ---"
            if queries:
                tab_summary += f"\nRecent searches: {', '.join(queries[-5:])}"
            if results:
                tab_summary += f"\nSearch results ({len(results)} items):"
                for r in results[:5]:
                    tab_summary += f"\n  - {r.get('title', 'Untitled')}: {r.get('snippet', '')[:100]}..."
            if visited:
                tab_summary += f"\nVisited pages ({len(visited)} items):"
                for p in visited[-3:]:
                    tab_summary += f"\n  - {p.get('title', 'Untitled')} ({p.get('url', '')})"
                    content = p.get('content', '')[:200]
                    if content:
                        tab_summary += f"\n    Content preview: {content}..."
            summary_parts.append(tab_summary)
    if not summary_parts:
        return "No context available yet. The user hasn't performed any searches."
    return "\n".join(summary_parts)


# ── Endpoints ───────────────────────────────────────────────
@router.post(
    "/context/session/start",
    response_model=SessionResponse,
    summary="Start a context session",
    description="Starts a new session or resumes an existing one using the provided session ID."
)
async def start_session(session_id: str = Body(..., embed=True)):
    _ensure_session(session_id)
    session = _session_store[session_id]
    if session.get("status") != "active":
        session["status"] = "active"
        session["ended_at"] = None
    return {"status": "success", "session": session, "stats": _session_stats(session_id)}


@router.post(
    "/context/session/stop/{session_id}",
    response_model=SessionResponse,
    summary="Stop a context session",
    description="Stops an active session and records the end time."
)
async def stop_session(session_id: str):
    if session_id not in _session_store and session_id not in _context_store:
        return {
            "status": "success",
            "message": "Session not found",
            "session_id": session_id,
            "stats": {"tab_count": 0, "query_count": 0, "result_count": 0, "visited_count": 0},
        }
    _ensure_session(session_id)
    session = _session_store[session_id]
    session["status"] = "stopped"
    if not session.get("ended_at"):
        session["ended_at"] = _utc_now_iso()
    return {"status": "success", "session": session, "stats": _session_stats(session_id)}


@router.get(
    "/context/export/{session_id}",
    response_model=ExportSessionResponse,
    summary="Export session context",
    description="Exports all browsing context for a session including queries, results, and visited pages as a JSON payload."
)
async def export_session_context(session_id: str):
    if session_id not in _session_store and session_id not in _context_store:
        return {
            "status": "not_found",
            "session_id": session_id,
            "session": None,
            "tabs": {},
            "stats": {"tab_count": 0, "query_count": 0, "result_count": 0, "visited_count": 0},
        }
    _ensure_session(session_id)
    return {
        "status": "success",
        "session_id": session_id,
        "session": _session_store[session_id],
        "tabs": _context_store.get(session_id, {}),
        "stats": _session_stats(session_id),
    }


@router.post(
    "/context/update",
    response_model=UpdateContextResponse,
    summary="Update tab context",
    description="Updates the browsing context for a specific tab including queries, results, and visited pages."
)
async def update_context(update: ContextUpdate):
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


@router.get(
    "/context/get/{session_id}/{tab_id}",
    response_model=TabContextResponse,
    summary="Get tab context",
    description="Returns the current browsing context for a specific tab including queries, results, and visited pages."
)
async def get_context(session_id: str, tab_id: str):
    if session_id not in _context_store or tab_id not in _context_store[session_id]:
        return {"queries": [], "results": [], "visited_pages": []}
    return _context_store[session_id][tab_id]


@router.get(
    "/context/session/{session_id}",
    response_model=SessionContextResponse,
    summary="Get full session context",
    description="Returns all browsing context across all tabs for a given session."
)
async def get_session_context(session_id: str):
    if session_id not in _context_store and session_id not in _session_store:
        return {
            "session": None,
            "tabs": {},
            "stats": {"tab_count": 0, "query_count": 0, "result_count": 0, "visited_count": 0},
        }
    _ensure_session(session_id)
    return {
        "session": _session_store[session_id],
        "tabs": _context_store.get(session_id, {}),
        "stats": _session_stats(session_id),
    }


@router.delete(
    "/context/clear/{session_id}/{tab_id}",
    response_model=ClearResponse,
    summary="Clear tab context",
    description="Clears all stored context data for a specific tab within a session."
)
async def clear_tab_context(session_id: str, tab_id: str):
    if session_id in _context_store and tab_id in _context_store[session_id]:
        del _context_store[session_id][tab_id]
        return {"status": "success", "message": "Tab context cleared"}
    return {"status": "success", "message": "No context to clear"}


@router.delete(
    "/context/clear/{session_id}",
    response_model=ClearResponse,
    summary="Clear session context",
    description="Clears all context data for an entire session including all tabs."
)
async def clear_session_context(session_id: str):
    if session_id in _context_store:
        del _context_store[session_id]
    if session_id in _session_store:
        del _session_store[session_id]
    return {"status": "success", "message": "Session context cleared"}


@router.post(
    "/context/add_query",
    response_model=AddQueryResponse,
    summary="Add query to context",
    description="Appends a new search query to the tab context. Keeps only the last 20 queries."
)
async def add_query_to_context(
    session_id: str = Body(...),
    tab_id: str = Body(...),
    query: str = Body(...),
    mode: str = Body(...),
):
    tab_context = _ensure_tab_context(session_id, tab_id)
    tab_context["queries"].append(query)
    tab_context["queries"] = tab_context["queries"][-20:]
    return {"status": "success", "message": "Query added to context", "mode": mode}


@router.post(
    "/context/add_results",
    response_model=ClearResponse,
    summary="Add search results to context",
    description="Stores the latest search results in the tab context. Keeps only the last 50 results."
)
async def add_results_to_context(
    session_id: str = Body(...),
    tab_id: str = Body(...),
    results: List[ResultRecord] = Body(...),
):
    tab_context = _ensure_tab_context(session_id, tab_id)
    tab_context["results"] = [r.dict() for r in results][-50:]
    return {"status": "success", "message": "Results added to context"}


@router.post(
    "/context/add_visited_page",
    response_model=ClearResponse,
    summary="Add visited page to context",
    description="Records a page visited by the user in the tab context. Keeps only the last 20 visited pages."
)
async def add_visited_page_to_context(
    session_id: str = Body(...),
    tab_id: str = Body(...),
    page: VisitedPage = Body(...),
):
    tab_context = _ensure_tab_context(session_id, tab_id)
    tab_context["visited_pages"].append(page.dict())
    tab_context["visited_pages"] = tab_context["visited_pages"][-20:]
    return {"status": "success", "message": "Visited page added to context"}


@router.post(
    "/context/chat/session",
    response_model=ChatSessionResponse,
    summary="Create chat session",
    description="Creates a new persistent chat session linked to a specific browser tab."
)
async def create_chat_session(payload: ChatSessionCreate):
    session_id = payload.session_id or str(uuid.uuid4())
    db = get_context_db()
    db.create_chat_session(session_id, payload.tab_id)
    return {"status": "success", "session_id": session_id}


@router.get(
    "/context/chat/sessions/{tab_id}",
    response_model=ChatSessionsListResponse,
    summary="Get chat sessions",
    description="Returns all chat sessions associated with a specific browser tab."
)
async def get_chat_sessions(tab_id: str):
    db = get_context_db()
    sessions = db.get_chat_sessions(tab_id)
    return {"status": "success", "sessions": sessions}


@router.delete(
    "/context/chat/session/{session_id}",
    response_model=ClearResponse,
    summary="Delete chat session",
    description="Permanently deletes a chat session and all its messages."
)
async def delete_chat_session(session_id: str):
    db = get_context_db()
    db.delete_chat_session(session_id)
    return {"status": "success", "message": "Chat session deleted"}


@router.get(
    "/context/chat/messages/{session_id}",
    response_model=ChatMessagesResponse,
    summary="Get chat messages",
    description="Returns all messages in a chat session formatted with sender info and timestamps."
)
async def get_chat_messages(session_id: str):
    db = get_context_db()
    messages = db.get_chat_messages(session_id)
    formatted = []
    for msg in messages:
        formatted.append({
            "id": msg["id"],
            "text": msg["content"],
            "sender": "user" if msg["role"] == "user" else "ai",
            "model": msg["model"],
            "created_at": msg["created_at"]
        })
    return {"status": "success", "messages": formatted}


@router.post(
    "/context/chat",
    response_model=ChatResponse,
    summary="Chat with AI using browsing context",
    description="Sends a message to the AI which has full access to the user's browsing context including searches, results, and visited pages."
)
async def chat_with_context(
    session_id: str = Body(...),
    message: str = Body(...),
    tab_id: Optional[str] = Body(None),
    model: str = Body("default"),
    app_session_id: Optional[str] = Body(None),
):
    db = get_context_db()
    user_msg_id = f"msg_{datetime.now().timestamp()}_{uuid.uuid4().hex[:6]}"
    db.save_chat_message(user_msg_id, session_id, "user", message, model)
    history = db.get_chat_messages(session_id)
    recent_history = history[-10:]
    groq_messages = []
    for msg in recent_history:
        content = msg["content"] or ""
        if len(content) > 4000:
            content = content[:4000] + "\n[Content truncated to prevent token overflow...]"
        groq_messages.append({"role": msg["role"], "content": content})
    context_session_id = app_session_id or session_id
    context_summary = _build_context_summary(context_session_id)

    persona_config = get_persona(model)
    actual_model = persona_config.get("model") or "llama-3.1-8b-instant"
    persona_prompt = persona_config.get("system_prompt")

    # System prompt with context
    system_prompt = f"""You are Super AI, an intelligent assistant for the SuperBrowser application.
You help users understand and analyze their browsing context - the searches they've made, 
the results they've found, and the pages they've visited.

Current Session Context:
{context_summary}

Guidelines:
- Be helpful, concise, and informative
- Reference specific searches, results, or pages when relevant
- If the user asks about something not in the context, acknowledge that
- You can suggest related searches or help analyze patterns in their browsing
- Keep responses focused and under 200 words unless the user asks for more detail"""

    if persona_prompt:
        system_prompt += f"\n\nAdditional instructions for your personality:\n{persona_prompt}"

    # Call Groq API with selected model and message history
    response = await ask_groq(model=actual_model, system_prompt=system_prompt, messages=groq_messages)

    # Save assistant response to persistent DB
    assistant_msg_id = f"msg_{datetime.now().timestamp()}_{uuid.uuid4().hex[:6]}"
    db.save_chat_message(assistant_msg_id, session_id, "assistant", response, model)
    return {
        "status": "success",
        "response": response,
        "model_used": model,
        "context_available": context_session_id in _context_store and len(_context_store[context_session_id]) > 0
    }


AVAILABLE_MODELS = [
    {
        "id": "default",
        "name": "Llama 3.1 8B (Default)",
        "description": "Raw Groq - no persona",
        "provider": "Meta"
    },
    {
        "id": "chatgpt",
        "name": "ChatGPT (GPT-4o)",
        "description": "Helpful, concise, friendly & practical",
        "provider": "OpenAI"
    },
    {
        "id": "gemini",
        "name": "Gemini 1.5 Pro",
        "description": "Analytical & connect ideas broadly",
        "provider": "Google"
    },
    {
        "id": "claude",
        "name": "Claude 3.5 Sonnet",
        "description": "Nuanced, careful & detailed analysis",
        "provider": "Anthropic"
    },
    {
        "id": "perplexity",
        "name": "Perplexity AI",
        "description": "Factual, search-style & cited",
        "provider": "Perplexity"
    },
]


@router.get(
    "/context/models",
    response_model=ModelsResponse,
    summary="Get available AI models",
    description="Returns a list of all available AI models that can be used for context-aware chat."
)
async def get_available_models():
    return {
        "status": "success",
        "models": AVAILABLE_MODELS,
        "default": "default"
    }


@router.delete(
    "/context/chat/clear/{session_id}",
    response_model=ClearResponse,
    summary="Clear chat history",
    description="Clears all chat messages for a given session from the database."
)
async def clear_chat_history(session_id: str):
    db = get_context_db()
    db.clear_chat_history(session_id)
    return {"status": "success", "message": "Chat history cleared"}