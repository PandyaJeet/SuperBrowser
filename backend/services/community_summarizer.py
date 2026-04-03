import asyncio
import os

import httpx

from scrapers.stackexchange import scrape_stackexchange
from scrapers.reddit import scrape_reddit
from scrapers.hackernews import scrape_hackernews
from scrapers.devto import scrape_devto


async def get_community_insights(query: str) -> dict:
    """Fetch community insights from multiple platforms and summarize with AI."""

    # Fetch from all four sources in parallel
    stack_results, reddit_results, hn_results, devto_results = await asyncio.gather(
        scrape_stackexchange(query),
        scrape_reddit(query),
        scrape_hackernews(query),
        scrape_devto(query),
    )

    # Build context strings from all sources
    # Stack: up to 2 questions with answers
    stack_context = ""
    for q in stack_results[:2]:
        stack_context += f"Q: {q.get('title', '')}\n"
        for ans in q.get("answers", [])[:2]:
            stack_context += f"A (score {ans.get('score', 0)}): {ans.get('body', '')[:500]}\n"
        stack_context += "\n"

    if not stack_context.strip():
        stack_context = "No Stack Overflow results found."

    # Reddit: up to 2 threads with top comments
    reddit_context = ""
    for t in reddit_results[:2]:
        reddit_context += f"Thread: {t.get('title', '')} (r/{t.get('subreddit', '')})\n"
        for c in t.get("top_comments", [])[:2]:
            reddit_context += f"Comment (score {c.get('score', 0)}): {c.get('body', '')[:400]}\n"
        reddit_context += "\n"

    if not reddit_context.strip():
        reddit_context = "No Reddit results found."

    # HN: up to 2 stories with top comments
    hn_context = ""
    for s in hn_results[:2]:
        hn_context += f"Story: {s.get('title', '')} (score {s.get('score', 0)})\n"
        for c in s.get("top_comments", [])[:2]:
            hn_context += f"Comment: {c.get('text', '')[:400]}\n"
        hn_context += "\n"

    if not hn_context.strip():
        hn_context = "No Hacker News results found."

    # Dev.to: up to 2 articles with description
    devto_context = ""
    for a in devto_results[:2]:
        devto_context += f"Article: {a.get('title', '')} by {a.get('author', '')}\n"
        devto_context += f"Description: {a.get('description', '')}\n"
        devto_context += f"Tags: {', '.join(a.get('tags', []))}\n\n"

    if not devto_context.strip():
        devto_context = "No Dev.to results found."

    # Build prompt for AI summarization
    prompt = f"""
You are analyzing community discussions from multiple platforms about: {query}

STACKOVERFLOW:
{stack_context}

REDDIT:
{reddit_context}

HACKER NEWS:
{hn_context}

DEV.TO:
{devto_context}

Please provide:
1. Main consensus or recommended approach (2-3 sentences)
2. Key practical tips from the community
3. Interesting perspectives or debates you noticed
4. Common pitfalls or warnings

Keep it concise and practical.
"""

    # Call AI for summarization
    insights = await _call_ai_for_insights(prompt)

    # Calculate sources used
    sources_used = [
        s
        for s, r in [
            ("stackoverflow", stack_results),
            ("reddit", reddit_results),
            ("hackernews", hn_results),
            ("devto", devto_results),
        ]
        if r
    ]

    return {
        "query": query,
        "insights": insights,
        "stack_results": stack_results,
        "reddit_results": reddit_results,
        "hn_results": hn_results,
        "devto_results": devto_results,
        "sources_used": sources_used,
        "total_sources": len(sources_used),
        "status": "success",
    }


async def _call_ai_for_insights(prompt: str) -> str:
    """Call Groq API to generate insights from community discussions."""
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        return "AI summarization unavailable - no API key configured."

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 800,
                    "temperature": 0.7,
                },
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()

    except Exception as e:
        return f"AI summarization failed: {str(e)}"
