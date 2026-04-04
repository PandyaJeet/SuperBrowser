import asyncio
from typing import Dict, Optional

from services.groq_service import ask_groq
from services.personas import get_persona
from services.query_classifier import classify_query

# Import scrapers for live-data pipeline
from scrapers.google_scraper import scrape_google
from scrapers.bing import scrape_bing
from scrapers.duckduckgo import scrape_duckduckgo
from services.serpapi_search import (
    search_google_serpapi,
    search_bing_serpapi,
    search_duckduckgo_serpapi,
)


DEFAULT_SUPERAI_MODEL = "llama-3.1-8b-instant"

DEFAULT_SUPERAI_SYSTEM_PROMPT = (
    "You are SuperAI, a neutral synthesis assistant. "
    "In default mode, summarize all provided user context accurately without persona styling. "
    "Prioritize factual consolidation, deduplication, and clarity. "
    "If context is incomplete or conflicting, state that explicitly."
)

LIVE_DATA_SYSTEM_PROMPT = (
    "You are SuperAI Product Analyst, a highly skilled comparison and recommendation engine. "
    "You have been given REAL, LIVE search results scraped from multiple search engines. "
    "Your job is to synthesize these results into a clear, actionable answer. "
    "CRITICAL RULES:\n"
    "1. DEDUPLICATE: If the same product/item appears across multiple sources, merge them into one entry.\n"
    "2. COMPARE: Present products/items in a structured comparison format.\n"
    "3. BE SPECIFIC: Include real prices, model names, and specifications from the scraped data.\n"
    "4. RANK: Order recommendations by value/relevance to the user's specific need.\n"
    "5. CITE: Mention which sources/websites the information came from.\n"
    "6. DO NOT INVENT: Only use information present in the provided search results. "
    "If data is insufficient, say so honestly."
)


def _build_persona_prompt(query: str, context_str: str) -> str:
    return f"""Based on the user's browsing history and context below, provide a comprehensive answer to their query.

Query: {query}

## Browsing Context:
{context_str}

Please provide:
1. A concise summary (2-3 sentences)
2. Key points and details
3. Any relevant caveats or considerations

If the browsing context is relevant to the query, reference it in your answer to show contextual awareness.
"""


def _build_default_summary_prompt(query: str, context: Optional[Dict], context_str: str) -> str:
    query_count = len(context.get("queries", [])) if context else 0
    result_count = len(context.get("results", [])) if context else 0
    visited_count = len(context.get("visited_pages", [])) if context else 0

    return f"""Create a reliable default SuperAI summary from ALL available context.

User Query:
{query}

Context Stats:
- Previous searches: {query_count}
- Recent results: {result_count}
- Visited pages: {visited_count}

Context Details:
{context_str}

Output format (in this exact order):
1) Overall Summary: 3-5 bullet points that synthesize all major themes found across the context.
2) Direct Answer: a concise answer to the user query, grounded in the context.
3) Evidence Highlights: 4-8 short bullets with concrete supporting points from the context.
4) Gaps or Uncertainty: mention missing/conflicting information briefly.
5) Next Actions: up to 3 practical follow-up checks/searches.

Rules:
- Do not imitate any persona in this mode.
- Do not invent facts not present in the context.
- Merge duplicates and avoid repeating near-identical points.
"""


def _build_live_data_prompt(query: str, scraped_results: list[dict]) -> str:
    """Build a prompt that feeds all scraped web results to the AI for synthesis."""
    results_text = []
    for idx, result in enumerate(scraped_results, 1):
        title = result.get("title", "Untitled")
        url = result.get("url", "")
        snippet = result.get("snippet", "")
        source = result.get("source", "unknown")
        results_text.append(
            f"{idx}. [{source.upper()}] {title}\n"
            f"   URL: {url}\n"
            f"   {snippet}"
        )

    all_results = "\n\n".join(results_text)

    return f"""The user is looking for: "{query}"

Below are REAL search results scraped from Google, Bing, and DuckDuckGo just now.
Analyze them and provide a comprehensive answer.

## Live Search Results ({len(scraped_results)} results from multiple engines):

{all_results}

---

## Your Task:
Based on the above real search results, provide a thorough answer to: "{query}"

Format your response as:
1) **Quick Answer** — 2-3 sentence direct recommendation
2) **Top Picks** — List the best options with real names, prices, and key specs (deduplicated across sources)
3) **Comparison** — Brief pros/cons or feature comparison if applicable
4) **Where to Buy** — Mention specific stores/websites from the results
5) **Verdict** — Final 1-2 sentence recommendation

Remember: ONLY use information from the search results above. Deduplicate products that appear multiple times.
"""


async def _scrape_all_engines(query: str, gl: str = "us") -> list[dict]:
    """Scrape Google, Bing, and DuckDuckGo in parallel, merge and deduplicate results.
    
    Uses region-specific results based on gl parameter for AI mode.
    """

    # Run all scrapers concurrently for speed
    google_task = asyncio.create_task(_scrape_with_api_fallback(query, "google", gl=gl))
    bing_task = asyncio.create_task(_scrape_with_api_fallback(query, "bing", gl=gl))
    ddg_task = asyncio.create_task(_scrape_with_api_fallback(query, "duckduckgo", gl=gl))

    google_results, bing_results, ddg_results = await asyncio.gather(
        google_task, bing_task, ddg_task,
        return_exceptions=True
    )

    # Flatten all results, handling exceptions gracefully
    all_results = []
    for engine_results in [google_results, bing_results, ddg_results]:
        if isinstance(engine_results, list):
            all_results.extend(engine_results)
        elif isinstance(engine_results, Exception):
            print(f"[live_data] scraper exception: {engine_results}")

    # Deduplicate by URL
    seen_urls = set()
    deduplicated = []
    for result in all_results:
        url = result.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            deduplicated.append(result)

    print(f"[live_data] total scraped: {len(all_results)}, after dedup: {len(deduplicated)} (region: {gl})")
    return deduplicated


async def _scrape_with_api_fallback(query: str, engine: str, gl: str = "us") -> list[dict]:
    """Try SerpAPI first, fall back to direct scraper.
    
    Uses region-specific results based on gl parameter.
    """
    api_funcs = {
        "google": search_google_serpapi,
        "bing": search_bing_serpapi,
        "duckduckgo": search_duckduckgo_serpapi,
    }
    scraper_funcs = {
        "google": scrape_google,
        "bing": scrape_bing,
        "duckduckgo": scrape_duckduckgo,
    }

    # Try API first with region parameter
    try:
        api_result = await api_funcs[engine](query, gl=gl)
        organic = api_result.get("organic", []) if isinstance(api_result, dict) else api_result
        if organic:
            return organic
    except Exception:
        pass

    # Fall back to scraper (scrapers don't support region, but still useful as fallback)
    try:
        return await scraper_funcs[engine](query)
    except Exception:
        return []


def format_context_for_ai(context: Optional[Dict]) -> str:
    """Format browsing context into a readable string for the AI"""
    if not context:
        return "No browsing context provided."
    
    formatted = []
    
    # Add previous queries
    if "queries" in context and context["queries"]:
        formatted.append("## Previous Searches:")
        for idx, q in enumerate(context["queries"][-5:], 1):  # Last 5 queries
            formatted.append(f'{idx}. "{q}"')
        formatted.append("")
    
    # Add search results context
    if "results" in context and context["results"]:
        formatted.append("## Recent Search Results:")
        for idx, result in enumerate(context["results"][:10], 1):  # Top 10 results
            title = result.get("title", "Untitled")
            snippet = result.get("snippet", "")
            url = result.get("url", "")
            formatted.append(f"{idx}. {title}")
            if snippet:
                formatted.append(f"   {snippet[:200]}...")
            if url:
                formatted.append(f"   URL: {url}")
            formatted.append("")
    
    # Add visited pages content
    if "visited_pages" in context and context["visited_pages"]:
        formatted.append("## Content from Visited Pages:")
        for idx, page in enumerate(context["visited_pages"][:3], 1):  # Last 3 visited
            title = page.get("title", "Untitled")
            content = page.get("content", "")
            formatted.append(f"{idx}. {title}")
            if content:
                # Take first 500 chars of content
                formatted.append(f"   {content[:500]}...")
            formatted.append("")
    
    return "\n".join(formatted) if formatted else "No significant context available."


async def get_ai_consensus(query: str, context: Optional[Dict] = None, persona: str = "default", gl: str = "us") -> dict:
    """Get AI-generated consensus answer using the specified persona and browsing context."""
    normalized_persona = (persona or "default").strip().lower()
    persona_config = get_persona(normalized_persona)
    
    # ─── Step 1: Classify the query ───────────────────────────────
    query_category = await classify_query(query)
    print(f"[super_ai] query='{query}' classified as: {query_category} (region: {gl})")

    # ─── Step 2: Live-data pipeline ───────────────────────────────
    if query_category == "live_data":
        print(f"[super_ai] LIVE DATA mode activated — scraping all engines with region: {gl}...")
        
        # AI mode uses region-specific results
        scraped_results = await _scrape_all_engines(query, gl=gl)
        
        if scraped_results:
            prompt = _build_live_data_prompt(query, scraped_results)
            
            answer = await ask_groq(
                prompt=prompt,
                model=DEFAULT_SUPERAI_MODEL,
                system_prompt=LIVE_DATA_SYSTEM_PROMPT,
            )

            return {
                "query": query,
                "answer": answer,
                "persona_used": "SuperAI Product Analyst",
                "model_used": DEFAULT_SUPERAI_MODEL,
                "context_used": True,
                "live_data": True,
                "sources_scraped": len(scraped_results),
                "region": gl,  # Indicate which region was used
                "status": "success",
            }
        else:
            print("[super_ai] scraping returned no results, falling back to general mode")

    # ─── Step 3: General knowledge pipeline (existing flow) ───────
    context_str = format_context_for_ai(context)

    use_default_summary = normalized_persona == "default" or persona_config.get("label") == "Default"

    if use_default_summary:
        model = DEFAULT_SUPERAI_MODEL
        system_prompt = DEFAULT_SUPERAI_SYSTEM_PROMPT
        prompt = _build_default_summary_prompt(query, context, context_str)
        persona_used = "SuperAI Default Summary"
    else:
        model = persona_config["model"]
        system_prompt = persona_config["system_prompt"]
        prompt = _build_persona_prompt(query, context_str)
        persona_used = persona_config["label"]

    answer = await ask_groq(
        prompt=prompt,
        model=model,
        system_prompt=system_prompt,
    )

    return {
        "query": query,
        "answer": answer,
        "persona_used": persona_used,
        "model_used": model,
        "context_used": bool(context),
        "live_data": False,
        "status": "success",
    }
