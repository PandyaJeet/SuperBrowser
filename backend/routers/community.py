from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from services.community_summarizer import get_community_insights

router = APIRouter()


@router.get("/community")
async def get_community(q: str = Query(default=None)):
    if not q:
        return JSONResponse(
            status_code=400,
            content={"error": "query param q is required"}
        )
    
    return await get_community_insights(q)
