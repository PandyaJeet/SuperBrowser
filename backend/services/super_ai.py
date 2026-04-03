from services.groq_service import ask_groq
from services.personas import get_persona


async def get_ai_consensus(query: str, context: str = "", persona: str = "default") -> dict:
    """Get AI-generated consensus answer using the specified persona."""
    persona_config = get_persona(persona)

    prompt = f"""Based on the following search results and context, provide a comprehensive answer to the query.

Query: {query}

Context:
{context if context else "No additional context provided."}

Please provide:
1. A concise summary (2-3 sentences)
2. Key points and details
3. Any relevant caveats or considerations
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
        "status": "success",
    }
