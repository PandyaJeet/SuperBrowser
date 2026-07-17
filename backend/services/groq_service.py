import os
import asyncio
from typing import Optional

import httpx


MAX_RETRIES = 5
INITIAL_BACKOFF = 1.0  # seconds


async def ask_groq(
    prompt: Optional[str] = None,
    model: str = "llama-3.1-8b-instant",
    system_prompt: Optional[str] = None,
    messages: Optional[list[dict[str, str]]] = None,
) -> str:
    """Call Groq API with optional system prompt, message history, and model selection.
    
    Includes retry logic with exponential backoff for rate limiting (429 errors).
    """
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        return "Groq API key not configured."

    # Build messages list
    if messages is not None:
        messages_list = list(messages)
        if system_prompt and (not messages_list or messages_list[0].get("role") != "system"):
            messages_list.insert(0, {"role": "system", "content": system_prompt})
    else:
        messages_list = []
        if system_prompt:
            messages_list.append({"role": "system", "content": system_prompt})
        if prompt:
            messages_list.append({"role": "user", "content": prompt})

    last_error = None
    backoff = INITIAL_BACKOFF

    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": messages_list,
                        "max_tokens": 1024,
                        "temperature": 0.7,
                    },
                    timeout=60,
                )
                
                # Handle rate limiting with retry
                if response.status_code == 429:
                    retry_after = float(response.headers.get("retry-after", backoff))
                    print(f"[groq] Rate limited (429), retrying in {retry_after:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})")
                    await asyncio.sleep(retry_after)
                    backoff = min(backoff * 2, 30)  # Exponential backoff, max 30s
                    continue
                
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"].strip()

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                print(f"[groq] Rate limited (429), retrying in {backoff:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30)
                last_error = e
                continue
            print(f"[groq] HTTPStatusError: {e}")
            return "Unable to generate a response at the moment."
        except Exception as e:
            last_error = e
            # For other errors, retry with backoff too
            if attempt < MAX_RETRIES - 1:
                print(f"[groq] Error: {e}, retrying in {backoff:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30)
                continue
            break

    print(f"[groq] Failed after {MAX_RETRIES} retries. Last error: {last_error}")
    return "Unable to generate a response at the moment after multiple attempts."
