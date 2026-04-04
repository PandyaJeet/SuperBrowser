import os
from typing import Any

import httpx


SERPAPI_SEARCH_URL = "https://serpapi.com/search.json"
SERPAPI_TIMEOUT = 10.0
MAX_RESULTS_PER_ENGINE = 10


def _get_serpapi_key() -> str | None:
    # Support both names so existing deployments do not break.
    return os.getenv("SERPAPI_API_KEY") or os.getenv("SERP_API_KEY")


def _build_params(engine: str, query: str, api_key: str) -> dict[str, str]:
    if engine == "google":
        return {
            "engine": "google",
            "q": query,
            "num": str(MAX_RESULTS_PER_ENGINE),
            "hl": "en",
            "api_key": api_key,
        }

    if engine == "bing":
        return {
            "engine": "bing",
            "q": query,
            "count": str(MAX_RESULTS_PER_ENGINE),
            "api_key": api_key,
        }

    return {
        "engine": "duckduckgo",
        "q": query,
        "api_key": api_key,
    }


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


async def search_serpapi_engine(query: str, engine: str) -> list[dict]:
    """Fetch and normalize SerpAPI organic results for one engine."""
    api_key = _get_serpapi_key()
    if not api_key:
        return []

    try:
        async with httpx.AsyncClient(timeout=SERPAPI_TIMEOUT) as client:
            response = await client.get(
                SERPAPI_SEARCH_URL,
                params=_build_params(engine, query, api_key),
            )
            response.raise_for_status()
    except (httpx.RequestError, httpx.HTTPStatusError):
        return []

    data = response.json()
    organic_results = data.get("organic_results", [])
    if not isinstance(organic_results, list):
        return []

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

    return normalized


async def search_google_serpapi(query: str) -> list[dict]:
    return await search_serpapi_engine(query, "google")


async def search_bing_serpapi(query: str) -> list[dict]:
    return await search_serpapi_engine(query, "bing")


async def search_duckduckgo_serpapi(query: str) -> list[dict]:
    return await search_serpapi_engine(query, "duckduckgo")