from services.groq_service import ask_groq
from services.personas import get_persona
from typing import Dict, Optional


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
    persona_config = get_persona(persona)
    
    # Format context for the AI
    context_str = format_context_for_ai(context)
    
    prompt = f"""Based on the user's browsing history and context below, provide a comprehensive answer to their query.

Query: {query}

## Browsing Context:
{context_str}

Please provide:
1. A concise summary (2-3 sentences)
2. Key points and details
3. Any relevant caveats or considerations

If the browsing context is relevant to the query, reference it in your answer to show contextual awareness.
"""

    answer = await ask_groq(
        prompt=prompt,
        model=persona_config["model"],
        system_prompt=persona_config["system_prompt"],
    )

    return {
        "query": query,
        "answer": answer,
        "persona_used": persona_config["label"],
        "model_used": persona_config["model"],
        "context_used": bool(context),
        "status": "success",
    }
