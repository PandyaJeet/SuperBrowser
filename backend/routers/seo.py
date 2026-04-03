import asyncio

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from scrapers.ad_filter import score_and_rank
from scrapers.brave import scrape_brave
from scrapers.duckduckgo import scrape_duckduckgo

router = APIRouter()


@router.get("/seo")
async def get_seo(q: str = Query(default=None)):
    if not q:
        return JSONResponse(
            status_code=400,
            content={"error": "query param q is required"}
        )
    
    # Run both scrapers in parallel
    ddg_results, brave_results = await asyncio.gather(
        scrape_duckduckgo(q),
        scrape_brave(q),
    )
    
    # Score and rank combined results
    ranked_results = score_and_rank([ddg_results, brave_results])
    return ranked_results
