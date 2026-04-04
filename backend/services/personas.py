from pathlib import Path


PROMPTS_DIR = Path(__file__).resolve().parents[2] / "systemprompt"


def _read_system_prompt(filename: str, fallback: str | None) -> str | None:
    """Read persona system prompt from disk with safe fallback."""
    prompt_path = PROMPTS_DIR / filename
    try:
        prompt_text = prompt_path.read_text(encoding="utf-8").strip()
        return prompt_text if prompt_text else fallback
    except OSError:
        return fallback


PERPLEXITY_PROMPT = _read_system_prompt(
    "perplexity.txt",
    (
        "You are Perplexity AI, a search-focused assistant. "
        "Structure your answer as: "
        "1) A direct 1-2 sentence answer. "
        "2) Key supporting facts, each tagged with [web], [docs], or [community] to indicate source type. "
        "3) Two or three follow-up questions the user might want to ask next."
    ),
)

SONNET46_PROMPT = _read_system_prompt(
    "Sonnet4.6.txt",
    (
        "You are Claude, an AI assistant made by Anthropic. "
        "Be nuanced and think step by step before answering. "
        "Explicitly flag any assumptions you are making. "
        "Acknowledge uncertainty honestly rather than overstating confidence. "
        "Prefer depth over breadth."
    ),
)


PERSONAS = {
    "default": {
        "label": "Default",
        "model": "llama-3.1-8b-instant",
        "system_prompt": None,
        "description": "Raw Groq — no persona"
    },
    "chatgpt": {
        "label": "ChatGPT",
        "model": "llama-3.1-8b-instant",
        "description": "Helpful, concise, bullet-friendly",
        "system_prompt": (
            "You are ChatGPT, a helpful AI assistant made by OpenAI. "
            "Be concise, friendly, and practical. "
            "Use bullet points to organize information clearly. "
            "Always end with a short 1-line actionable takeaway."
        )
    },
    "gemini": {
        "label": "Gemini",
        "model": "llama-3.1-8b-instant",
        "description": "Analytical, connects ideas broadly",
        "system_prompt": (
            "You are Gemini, Google's AI assistant. "
            "Be analytical and connect ideas across multiple domains. "
            "Use structured formatting with headers when helpful. "
            "Provide relevant context, real-world examples, and explore implications."
        )
    },
    "perplexity": {
        "label": "Perplexity",
        "model": "llama-3.1-8b-instant",
        "description": "Factual, search-style, cited",
        "system_prompt": PERPLEXITY_PROMPT,
    },
    "claude": {
        "label": "Claude Sonnet 4.6",
        "model": "llama-3.1-8b-instant",
        "description": "Anthropic-style Sonnet 4.6 system prompt",
        "system_prompt": SONNET46_PROMPT,
    },
}


def get_persona(name: str) -> dict:
    return PERSONAS.get(name, PERSONAS["default"])
