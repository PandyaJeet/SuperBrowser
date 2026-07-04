from fastapi import APIRouter, Body
from pydantic import BaseModel
from typing import List, Dict, Optional

from services.super_ai import get_ai_consensus

router = APIRouter()


# ── Request Model ──────────────────────────────────────────
class ContextualAIRequest(BaseModel):
    """Request model for AI queries with context"""
    query: str
    persona: str = "default"
    context: Optional[Dict] = None
    region: str = "us"
    model: Optional[str] = "llama-3.1-8b-instant"


# ── Response Models ───────────────────────────────────────
class AISource(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    snippet: Optional[str] = None

class AIResponse(BaseModel):
    answer: Optional[str] = None
    sources: Optional[List[AISource]] = []
    persona: Optional[str] = None
    region: Optional[str] = None


# ── Endpoints ───────────────────────────────────────────────
@router.get(
    "/ai",
    response_model=AIResponse,
    summary="Get AI-powered search answer",
    description="Legacy endpoint that returns an AI-generated answer for a given query using the selected persona and region."
)
async def get_ai(q: str, session_id: str = "", persona: str = "default", gl: str = "us", model: str = "llama-3.1-8b-instant"):
    """Legacy endpoint for backward compatibility"""
    return await get_ai_consensus(query=q, persona=persona, gl=gl, model=model)


@router.post(
    "/ai/contextual",
    response_model=AIResponse,
    summary="Get AI answer with browsing context",
    description="Advanced AI endpoint that accepts query, persona, and browsing context such as previous queries, results, and visited pages."
)
async def get_ai_with_context(request: ContextualAIRequest):
    """
    AI endpoint with browsing context support
    Accepts: query, persona, browsing context, and model
    """
    return await get_ai_consensus(
        query=request.query,
        persona=request.persona,
        context=request.context,
        gl=request.region,
        model=request.model
    )
