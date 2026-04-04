from typing import Dict, Optional

from services.groq_service import ask_groq
from services.personas import get_persona


DEFAULT_SUPERAI_MODEL = "llama-3.1-8b-instant"

DEFAULT_SUPERAI_SYSTEM_PROMPT = (
    "You are SuperAI, a neutral synthesis assistant. "
    "In default mode, summarize all provided user context accurately without persona styling. "
    "Prioritize factual consolidation, deduplication, and clarity. "
    "If context is incomplete or conflicting, state that explicitly."
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


def format_context_for_ai(context: Optional[Dict]) -> str:
    """Format browsing context into a readable string for the AI"""
    if not context:
        return "No browsing context provided."
    
    formatted = []
    
    # Add previous queries
    if "queries" in context and context["queries"]:
        formatted.append("## Previous Searches:")
        for idx, q in enumerate(context["queries"][-5:], 1):  # Last 5 queries
            formatted.append(f"{idx}. \"{q}\"")
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


async def get_ai_consensus(query: str, context: Optional[Dict] = None, persona: str = "default") -> dict:
    """Get AI-generated consensus answer using the specified persona and browsing context."""
    normalized_persona = (persona or "default").strip().lower()
    persona_config = get_persona(normalized_persona)
    
    # Format context for the AI
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
        "status": "success",
    }
