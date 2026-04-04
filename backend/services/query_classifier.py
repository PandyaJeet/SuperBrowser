"""
Lightweight AI-powered query classifier.

Uses a tiny Groq prompt to determine whether a user query requires
live web data (products, comparisons, prices, current events) or can
be answered from general knowledge alone.
"""

from services.groq_service import ask_groq


CLASSIFIER_MODEL = "llama-3.1-8b-instant"

CLASSIFIER_PROMPT = """You are a query classifier. Your ONLY job is to output exactly one word.

Classify the following user query into one of two categories:

"live_data" — The query asks about specific PRODUCTS to buy, product PRICES, product COMPARISONS,
product RECOMMENDATIONS, or product RANKINGS where the user clearly wants to compare or purchase items.
Examples of live_data: "best laptop under 20k", "top smartphones 2026", "cheapest flight to Tokyo",
"best wireless headphones for gym", "iPhone vs Samsung comparison", "best budget gaming mouse"

"general" — EVERYTHING else. This includes:
- Date/time questions ("what is today's date", "what time is it")
- General knowledge ("what is machine learning", "explain recursion")
- How-to questions ("how to make pasta", "how does photosynthesis work")
- History/science/math ("who invented the telephone", "what is 2+2")
- Current events that are NOT about buying products ("who won the election")
- Opinions/advice ("should I learn Python or Java")
- Coding help ("write a Python function to sort a list")

IMPORTANT: If the query is about a general topic, date, time, definition, explanation, or anything
that is NOT specifically about comparing/buying/pricing PRODUCTS, classify it as "general".

USER QUERY: {query}

Respond with ONLY the single word "live_data" or "general". Nothing else."""


async def classify_query(query: str) -> str:
    """
    Classify a query as needing live data or being answerable from general knowledge.
    Returns 'live_data' or 'general'.
    """
    try:
        response = await ask_groq(
            prompt=CLASSIFIER_PROMPT.format(query=query),
            model=CLASSIFIER_MODEL,
            system_prompt="You are a classification bot. Respond with exactly one word only.",
        )

        # Parse the response — we expect exactly "live_data" or "general"
        cleaned = response.strip().lower().replace('"', '').replace("'", "")

        if "live_data" in cleaned:
            return "live_data"
        elif "general" in cleaned:
            return "general"
        else:
            # If the model returned something unexpected, default to general
            print(f"[classifier] unexpected response: '{response}', defaulting to general")
            return "general"

    except Exception as e:
        print(f"[classifier] error: {e}, defaulting to general")
        return "general"
