# AI Persona System Prompts

This directory contains the system prompt files used by SuperBrowser AI personas.

A persona controls the assistant's response style, structure, tone, and behavior. The backend loads persona prompt files from this directory and connects them to persona definitions in the application.

---

## Purpose

The `systemprompt/` directory is used to keep longer persona instructions outside the main backend code.

This makes persona prompts easier to:

* read
* edit
* review
* document
* reuse
* extend with new personas

Instead of placing every persona instruction directly inside Python code, prompt files can be stored as plain text files and loaded by the backend.

---

## Current Prompt Files

The current prompt files include:

```text
systemprompt/
├── perplexity.txt
└── Sonnet4.6.txt
```

These files define the behavior and response style for existing AI personas.

---

## How Prompts Are Loaded

Persona prompts are loaded by the backend service:

```text
backend/services/personas.py
```

The backend uses a helper function named:

```py
_read_system_prompt(filename, fallback)
```

This helper function reads a prompt file from the `systemprompt/` directory.

The general flow is:

```text
Prompt file in systemprompt/
        ↓
_read_system_prompt(filename, fallback)
        ↓
Prompt content loaded into backend persona config
        ↓
Persona selected from frontend
        ↓
AI response follows the selected persona style
```

If the prompt file cannot be read or is missing, the backend uses the fallback prompt defined in the code.

---

## Prompt File Format

Each persona prompt should be written as a plain text file with the `.txt` extension.

Recommended format:

```text
You are [Persona Name], an AI assistant with a specific role.

Your behavior:
- Follow the persona style.
- Structure answers clearly.
- Keep responses useful and relevant.
- Be honest when information is uncertain.
- Avoid unsupported claims.
```

Prompt files should be written as direct instructions to the AI model.

---

## Naming Convention

Use clear and descriptive file names.

Recommended examples:

```text
mistral.txt
llama.txt
research-assistant.txt
coding-helper.txt
```

Guidelines:

* Use `.txt` for prompt files.
* Use lowercase names for new files when possible.
* Use hyphens for multi-word names.
* Keep one persona per file.
* Do not store API keys or secrets in prompt files.

Existing files may keep their current names for compatibility.

---

## Registering a New Persona

To add a new persona, update both the backend and frontend.

---

### 1. Create a Prompt File

Create a new `.txt` file inside the `systemprompt/` directory.

Example:

```text
systemprompt/mistral.txt
```

Example prompt content:

```text
You are Mistral, a fast and practical AI assistant.

Your response style:
- Be concise and direct.
- Prioritize practical steps.
- Use simple explanations.
- Mention assumptions when needed.
- End with a clear next action.
```

---

### 2. Load the Prompt in the Backend

Open:

```text
backend/services/personas.py
```

Add a prompt loader using `_read_system_prompt`.

Example:

```py
MISTRAL_PROMPT = _read_system_prompt(
    "mistral.txt",
    (
        "You are Mistral, a fast and practical AI assistant. "
        "Be concise, direct, and action-oriented."
    ),
)
```

The second argument is the fallback prompt. It is used if the file is missing, empty, or cannot be read.

---

### 3. Add the Persona to the Backend `PERSONAS` Dictionary

In the same file, add a new entry to the `PERSONAS` dictionary.

Example:

```py
"mistral": {
    "label": "Mistral",
    "model": "llama-3.1-8b-instant",
    "description": "Fast, concise, and practical",
    "system_prompt": MISTRAL_PROMPT,
},
```

The persona key is important.

For example:

```py
"mistral"
```

This key must match the frontend persona `id`.

---

### 4. Add the Persona to the Frontend

Open:

```text
frontend/src/App.jsx
```

Find the frontend `PERSONAS` array and add a matching entry.

Example:

```js
{ id: "mistral", label: "Mistral", desc: "Fast & practical" },
```

The frontend `id` must match the backend persona key.

Backend:

```py
"mistral": {
    ...
}
```

Frontend:

```js
{ id: "mistral", label: "Mistral", desc: "Fast & practical" }
```

---

## End-to-End Example: Adding a Llama Persona

This example shows the complete process for adding a new Llama persona.

---

### Step 1: Create the Prompt File

Create:

```text
systemprompt/llama.txt
```

Add:

```text
You are Llama, an open and educational AI assistant.

Your response style:
- Explain concepts in a beginner-friendly way.
- Use examples when helpful.
- Keep the answer structured.
- Avoid overcomplicating simple topics.
- End with one useful learning tip.
```

---

### Step 2: Load the Prompt

In `backend/services/personas.py`, add:

```py
LLAMA_PROMPT = _read_system_prompt(
    "llama.txt",
    (
        "You are Llama, an open and educational AI assistant. "
        "Explain concepts clearly with beginner-friendly examples."
    ),
)
```

---

### Step 3: Register the Backend Persona

Add this entry to the backend `PERSONAS` dictionary:

```py
"llama": {
    "label": "Llama",
    "model": "llama-3.1-8b-instant",
    "description": "Educational and beginner-friendly",
    "system_prompt": LLAMA_PROMPT,
},
```

---

### Step 4: Register the Frontend Persona

Add this entry to the frontend `PERSONAS` array in `frontend/src/App.jsx`:

```js
{ id: "llama", label: "Llama", desc: "Educational & clear" },
```

---

### Step 5: Verify the Persona

After adding the backend and frontend entries:

1. Restart the backend server.
2. Restart the frontend development server.
3. Open the application.
4. Switch to the AI mode that uses personas.
5. Select the new persona.
6. Send a test prompt.
7. Confirm that the response follows the new persona style.

---

## Manual Testing Checklist

Use this checklist before opening a pull request.

```text
[ ] The new prompt file exists in systemprompt/.
[ ] The prompt file uses plain text format.
[ ] The backend loads the prompt with _read_system_prompt().
[ ] The backend PERSONAS dictionary includes the new persona.
[ ] The frontend PERSONAS array includes the matching persona id.
[ ] The frontend id matches the backend persona key.
[ ] The backend was restarted after editing personas.py.
[ ] The persona appears in the UI.
[ ] The AI response follows the selected persona style.
```

---

## Troubleshooting

### The persona does not appear in the UI

Check that the persona was added to the frontend `PERSONAS` array in:

```text
frontend/src/App.jsx
```

Also confirm that the frontend development server was restarted.

---

### The persona appears but does not change the response style

Check that:

* the frontend `id` matches the backend persona key
* the backend `PERSONAS` entry uses the correct `system_prompt`
* the prompt file exists in the `systemprompt/` directory
* the backend server was restarted after editing `personas.py`

---

### The app still works when a prompt file is missing

This is expected.

The backend uses the fallback prompt passed to `_read_system_prompt(filename, fallback)` when the prompt file cannot be loaded.

---

## Best Practices

When writing persona prompts:

* Keep instructions clear and specific.
* Define the expected tone and response structure.
* Avoid adding unrelated behavior.
* Avoid storing secrets, tokens, or API keys.
* Keep prompts easy to review in pull requests.
* Use fallback prompts for safer runtime behavior.

---

## Related Files

```text
systemprompt/
backend/services/personas.py
frontend/src/App.jsx
```

These files work together to define, load, register, and display AI personas in SuperBrowser.
