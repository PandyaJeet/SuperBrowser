from fastapi import APIRouter, Body
from pydantic import BaseModel
from typing import List, Dict, Optional

from services.super_ai import get_ai_consensus

router = APIRouter()


class ContextualAIRequest(BaseModel):
    """Request model for AI queries with context"""
    query: str
    persona: str = "default"
    context: Optional[Dict] = None


@router.get("/ai")
async def get_ai(q: str, session_id: str = "", persona: str = "default"):
    """Legacy endpoint for backward compatibility"""
    return await get_ai_consensus(query=q, persona=persona)


@router.post("/ai/contextual")
async def get_ai_with_context(request: ContextualAIRequest):
    """
    AI endpoint with browsing context support
    Accepts: query, persona, and browsing context (queries, results, visited pages)
    """
    return await get_ai_consensus(
        query=request.query,
        persona=request.persona,
        context=request.context
    )
