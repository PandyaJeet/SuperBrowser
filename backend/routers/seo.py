import asyncio
import os
from collections.abc import Awaitable, Callable

import httpx
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List

from scrapers.ad_filter import score_and_rank
from scrapers.bing import scrape_bing
from scrapers.brave import scrape_brave
from scrapers.duckduckgo import scrape_duckduckgo
from scrapers.google_scraper import scrape_google
from services.serpapi_search import (
    search_bing_serpapi,
    search_duckduckgo_serpapi,
    search_google_serpapi,
)
from services.instant_results import create_instant_results

from utils.cache import cache_key, get_cached, set_cached


router = APIRouter()
SEO_TARGET_RESULTS = 10
SEO_FAST_RESPONSE_TIMEOUT = 0.8
SEO_EXTRA_WAIT_TIMEOUT = 0.2
ENGINE_API_GRACE_TIMEOUT = 0.15
WIKIPEDIA_FALLBACK_TIMEOUT = 0.6


# ── Response Models (NEW) ───────────────────────────────────
class SearchResult(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    snippet: Optional[str] = None
    source: Optional[str] = None
    trust_score: Optional[int] = None


class ShoppingResult(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    price: Optional[str] = None
    source: Optional[str] = None


class SeoResponse(BaseModel):
    results: List[dict] = []
    shopping_results: List[dict] = []


# ── Helper Function ─────────────────────────────────────────
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
    api_task = asyncio.create_task(api_search(query))
    scraper_task = asyncio.create_task(scraper_search(query))
    pending = {api_task, scraper_task}
    fallback_results: list[dict] = []

    try:
        while pending:
            done, pending = await asyncio.wait(
                pending,
                return_when=asyncio.FIRST_COMPLETED,
            )

            for task in done:
                try:
                    result = task.result()
                except Exception:
                    result = {} if task is api_task else []

                if task is api_task:
                    organic_results = result.get("organic", []) if isinstance(result, dict) else []
                    shopping_results = result.get("shopping", []) if isinstance(result, dict) else []
                    if organic_results:
                        print(f"[seo] {engine_name}: using SerpAPI results={len(organic_results)}")
                        return {"organic": organic_results, "shopping": shopping_results}
                    continue

                fallback_results = result if isinstance(result, list) else []
                if fallback_results:
                    if api_task in pending:
                        api_done, pending = await asyncio.wait(
                            pending,
                            timeout=ENGINE_API_GRACE_TIMEOUT,
                            return_when=asyncio.FIRST_COMPLETED,
                        )
                        for api_done_task in api_done:
                            try:
                                api_result = api_done_task.result()
                            except Exception:
                                api_result = {}
                            organic_results = api_result.get("organic", []) if isinstance(api_result, dict) else []
                            shopping_results = api_result.get("shopping", []) if isinstance(api_result, dict) else []
                            if organic_results:
                                print(f"[seo] {engine_name}: using SerpAPI results={len(organic_results)}")
                                return {"organic": organic_results, "shopping": shopping_results}

                    print(f"[seo] {engine_name}: using scraper results={len(fallback_results)}")
                    return {"organic": fallback_results, "shopping": []}

        print(f"[seo] {engine_name}: no results")
        return {"organic": fallback_results, "shopping": []}
    finally:
        for task in pending:
            task.cancel()


async def _search_scraper_only(query: str, engine_name: str, scraper_search: Callable[[str], Awaitable[list[dict]]]) -> dict:
    try:
      results = await scraper_search(query)
    except Exception:
      results = []
    print(f"[seo] {engine_name}: scraper-only results={len(results)}")
    return {"organic": results if isinstance(results, list) else [], "shopping": []}


async def _wikipedia_fallback_results(query: str) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=WIKIPEDIA_FALLBACK_TIMEOUT) as client:
            response = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "opensearch",
                    "search": query,
                    "limit": "8",
                    "namespace": "0",
                    "format": "json",
                },
                headers={
                    "User-Agent": "SuperBrowser/1.0 search fallback",
                    "Accept": "application/json",
                },
                follow_redirects=True,
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError):
        return []

    if not isinstance(payload, list) or len(payload) < 4:
        return []

    titles = payload[1] if isinstance(payload[1], list) else []
    snippets = payload[2] if isinstance(payload[2], list) else []
    urls = payload[3] if isinstance(payload[3], list) else []

    results: list[dict] = []
    for index, title in enumerate(titles):
        url = urls[index] if index < len(urls) else ""
        if not title or not url:
            continue

        results.append({
            "title": title,
            "url": url,
            "snippet": snippets[index] if index < len(snippets) else "",
            "source": "wikipedia",
            "trust_score": 1,
            "cross_validated": False,
        })

    return results


# ── Endpoint ────────────────────────────────────────────────
@router.get(
    "/seo",
    response_model=SeoResponse,
    summary="Multi-engine web search",
    description="Searches Google, Bing, and DuckDuckGo simultaneously and returns ranked organic results and shopping results. Uses SerpAPI with scraper fallback."
)
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

    key = cache_key(q, "all", "seo-v4")
    cached = get_cached(key)
    if cached is not None:
        print(f"[seo] cache HIT for query={q!r}")
        return JSONResponse(content=cached, headers={"X-Cache": "HIT"})

    print(f"[seo] cache MISS - searching with natural CDN delivery")

    if not (os.getenv("SERPAPI_API_KEY") or os.getenv("SERP_API_KEY")):
        results = {
            "results": create_instant_results(q),
            "shopping_results": []
        }
        set_cached(key, results)
        return JSONResponse(content=results, headers={"X-Cache": "MISS"})

    engine_tasks = {
        "google": asyncio.create_task(_search_with_immediate_fallback(q, "google", search_google_serpapi, scrape_google)),
        "bing": asyncio.create_task(_search_with_immediate_fallback(q, "bing", search_bing_serpapi, scrape_bing)),
        "duckduckgo": asyncio.create_task(_search_with_immediate_fallback(q, "duckduckgo", search_duckduckgo_serpapi, scrape_duckduckgo)),
        "brave": asyncio.create_task(_search_scraper_only(q, "brave", scrape_brave)),
    }
    engine_results = {
        "google": {"organic": [], "shopping": []},
        "bing": {"organic": [], "shopping": []},
        "duckduckgo": {"organic": [], "shopping": []},
        "brave": {"organic": [], "shopping": []},
    }

    pending = set(engine_tasks.values())
    loop = asyncio.get_running_loop()
    deadline = loop.time() + SEO_FAST_RESPONSE_TIMEOUT

    while pending and loop.time() < deadline:
        done, pending = await asyncio.wait(
            pending,
            timeout=max(0.0, deadline - loop.time()),
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in done:
            engine_name = next(name for name, engine_task in engine_tasks.items() if engine_task is task)
            try:
                engine_results[engine_name] = task.result()
            except Exception:
                engine_results[engine_name] = {"organic": [], "shopping": []}

        organic_count = sum(len(result.get("organic", [])) for result in engine_results.values())
        if organic_count >= SEO_TARGET_RESULTS:
            break

    organic_count = sum(len(result.get("organic", [])) for result in engine_results.values())
    if pending and organic_count < SEO_TARGET_RESULTS:
        done, pending = await asyncio.wait(
            pending,
            timeout=SEO_EXTRA_WAIT_TIMEOUT,
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in done:
            engine_name = next(name for name, engine_task in engine_tasks.items() if engine_task is task)
            try:
                engine_results[engine_name] = task.result()
            except Exception:
                engine_results[engine_name] = {"organic": [], "shopping": []}

    for task in pending:
        task.cancel()

    google_results = engine_results["google"]
    bing_results = engine_results["bing"]
    ddg_results = engine_results["duckduckgo"]
    brave_results = engine_results["brave"]

    # Score and rank combined results
    ranked_organic = score_and_rank([
        google_results["organic"],
        bing_results["organic"],
        ddg_results["organic"],
        brave_results["organic"],
    ])

    shopping = google_results.get("shopping", [])
    if not ranked_organic:
        ranked_organic = create_instant_results(q)

    results = {
        "results": ranked_organic,
        "shopping_results": shopping
    }

    if ranked_organic:
        set_cached(key, results)
    return JSONResponse(content=results, headers={"X-Cache": "MISS"})
