from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List

from services.community_summarizer import get_community_insights
from utils.cache import cache_key, get_cached, set_cached
from utils.sanitize import sanitize_query

router = APIRouter()


# ── Response Models (NEW) ───────────────────────────────────
class CommunityPost(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    snippet: Optional[str] = None
    source: Optional[str] = None
    score: Optional[int] = None

class CommunityResponse(BaseModel):
    results: Optional[List[CommunityPost]] = []
    query: Optional[str] = None


# ── Endpoint ────────────────────────────────────────────────
@router.get(
    "/community",
    response_model=CommunityResponse,
    summary="Get community insights for a query",
    description="Searches community platforms like Reddit and returns summarized insights and discussions related to the query."
)
async def get_community(q: str = Query(default=None)):
    if not q:
        return JSONResponse(
            status_code=400,
            content={"error": "query param q is required"}
        )

    q = sanitize_query(q)
    key = cache_key(q, "all", "community")
    cached = get_cached(key)
    if cached is not None:
        return JSONResponse(content=cached, headers={"X-Cache": "HIT"})

    results = await get_community_insights(q)
    set_cached(key, results)
    return JSONResponse(content=results, headers={"X-Cache": "MISS"})