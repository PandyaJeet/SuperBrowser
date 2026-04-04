import os
from typing import Any

import httpx


SERPAPI_SEARCH_URL = "https://serpapi.com/search.json"
SERPAPI_TIMEOUT = 10.0
MAX_RESULTS_PER_ENGINE = 10


def _get_serpapi_key() -> str | None:
    # Support both names so existing deployments do not break.
    return os.getenv("SERPAPI_API_KEY") or os.getenv("SERP_API_KEY")


def _build_params(engine: str, query: str, api_key: str, gl: str | None = None) -> dict[str, str]:
    """
    Build search parameters for SerpAPI.
    
    When gl is None, no region parameter is added - uses natural CDN/default behavior.
    When gl is specified (e.g., "us", "in"), adds region filtering for localized results.
    """
    if engine == "google":
        params = {
            "engine": "google",
            "q": query,
            "num": str(MAX_RESULTS_PER_ENGINE),
            "hl": "en",
            "api_key": api_key,
        }
        # Only add region if explicitly specified (for AI mode)
        if gl:
            params["gl"] = gl
        return params

    if engine == "bing":
        params = {
            "engine": "bing",
            "q": query,
            "count": str(MAX_RESULTS_PER_ENGINE),
            "api_key": api_key,
        }
        # Only add country code if explicitly specified
        if gl:
            params["cc"] = gl.upper()
        return params

    # DuckDuckGo
    params = {
        "engine": "duckduckgo",
        "q": query,
        "api_key": api_key,
    }
    # Only add locale if explicitly specified
    if gl:
        params["kl"] = f"{gl}-en"
    return params


def _normalize_snippet(value: Any) -> str:
    if isinstance(value, str):
        return value

    if isinstance(value, list):
        return " ".join(str(part) for part in value if part)

    return ""


def _normalize_result(item: dict[str, Any], source: str) -> dict[str, str] | None:
    title = item.get("title", "")
    url = item.get("link") or item.get("url") or ""
    snippet = _normalize_snippet(item.get("snippet"))

    if not snippet:
        snippet = _normalize_snippet(item.get("snippet_highlighted_words"))

    if not (title or url):
        return None

    return {
        "title": title,
        "url": url,
        "snippet": snippet,
        "source": source,
    }


async def search_serpapi_engine(query: str, engine: str, gl: str | None = None) -> dict[str, list]:
    """
    Fetch and normalize SerpAPI organic results and shopping results for one engine.
    
    When gl is None, uses natural CDN/default behavior (no region filtering).
    When gl is specified, fetches region-specific results.
    """
    api_key = _get_serpapi_key()
    if not api_key:
        return {"organic": [], "shopping": []}

    try:
        async with httpx.AsyncClient(timeout=SERPAPI_TIMEOUT) as client:
            response = await client.get(
                SERPAPI_SEARCH_URL,
                params=_build_params(engine, query, api_key, gl=gl),
            )
            response.raise_for_status()
    except (httpx.RequestError, httpx.HTTPStatusError):
        return {"organic": [], "shopping": []}

    data = response.json()
    organic_results = data.get("organic_results", [])
    shopping_results = data.get("shopping_results", [])
    if not isinstance(organic_results, list):
        organic_results = []
    if not isinstance(shopping_results, list):
        shopping_results = []

    normalized: list[dict] = []
    for item in organic_results:
        if not isinstance(item, dict):
            continue

        result = _normalize_result(item, source=engine)
        if not result:
            continue

        normalized.append(result)
        if len(normalized) >= MAX_RESULTS_PER_ENGINE:
            break

    return {"organic": normalized, "shopping": shopping_results}


async def search_google_serpapi(query: str, gl: str | None = None) -> dict[str, list]:
    return await search_serpapi_engine(query, "google", gl=gl)


async def search_bing_serpapi(query: str, gl: str | None = None) -> dict[str, list]:
    return await search_serpapi_engine(query, "bing", gl=gl)


async def search_duckduckgo_serpapi(query: str, gl: str | None = None) -> dict[str, list]:
    return await search_serpapi_engine(query, "duckduckgo", gl=gl)