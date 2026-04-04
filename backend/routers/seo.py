import asyncio
from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from scrapers.ad_filter import score_and_rank
from scrapers.bing import scrape_bing
from scrapers.duckduckgo import scrape_duckduckgo
from scrapers.google_scraper import scrape_google
from services.serpapi_search import (
    search_bing_serpapi,
    search_duckduckgo_serpapi,
    search_google_serpapi,
)

router = APIRouter()


async def _search_with_immediate_fallback(
    query: str,
    engine_name: str,
    api_search: Callable,
    scraper_search: Callable[[str], Awaitable[list[dict]]],
) -> dict:
    """
    Start API and scraper paths together, then prefer API results.
    If API fails/returns empty, scraper fallback is already in progress.
    
    No region parameter - uses natural CDN/default behavior.
    """
    scraper_task = asyncio.create_task(scraper_search(query))

    api_results: dict = {}
    try:
        api_results = await api_search(query)
    except Exception:
        api_results = {}

    organic_results = api_results.get("organic", [])
    shopping_results = api_results.get("shopping", [])

    if organic_results:
        if not scraper_task.done():
            scraper_task.cancel()
            try:
                await scraper_task
            except asyncio.CancelledError:
                pass

        print(f"[seo] {engine_name}: using SerpAPI results={len(organic_results)}")
        return {"organic": organic_results, "shopping": shopping_results}

    try:
        fallback_results = await scraper_task
    except Exception:
        fallback_results = []

    print(f"[seo] {engine_name}: SerpAPI failed/empty, using scraper results={len(fallback_results)}")
    return {"organic": fallback_results, "shopping": []}


@router.get("/seo")
async def get_seo(q: str = Query(default=None)):
    """
    SEO search endpoint - returns natural results from CDN/default behavior.
    No region filtering - search engines return results based on their default logic.
    """
    if not q:
        return JSONResponse(
            status_code=400,
            content={"error": "query param q is required"}
        )

    print(f"[seo] searching with natural CDN delivery")

    google_results, bing_results, ddg_results = await asyncio.gather(
        _search_with_immediate_fallback(q, "google", search_google_serpapi, scrape_google),
        _search_with_immediate_fallback(q, "bing", search_bing_serpapi, scrape_bing),
        _search_with_immediate_fallback(q, "duckduckgo", search_duckduckgo_serpapi, scrape_duckduckgo),
    )

    # Score and rank combined results
    ranked_organic = score_and_rank([
        google_results["organic"], 
        bing_results["organic"], 
        ddg_results["organic"]
    ])
    
    shopping = google_results.get("shopping", [])
    
    return {
        "results": ranked_organic,
        "shopping_results": shopping
    }
