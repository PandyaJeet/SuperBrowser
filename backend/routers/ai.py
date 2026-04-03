from fastapi import APIRouter

from services.super_ai import get_ai_consensus

router = APIRouter()


@router.get("/ai")
async def get_ai(q: str, session_id: str = "", persona: str = "default"):
    return await get_ai_consensus(query=q, persona=persona)
