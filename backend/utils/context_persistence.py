# backend/utils/context_persistence.py
#
# Filesystem persistence for per-tab browsing context.
#
# WHY: The backend runs on Render's free tier, which sleeps after 15 minutes
# of inactivity. A sleep = full process restart = all in-memory context lost.
# Persisting to the filesystem ensures research sessions survive restarts.
#
# HOW: Each (session_id, tab_id) pair gets its own JSON file.
# Files are read on startup and loaded into the in-memory cache.
# Files are written on every mutation (add_query, add_results, etc.).
# Files are deleted when the user explicitly clears context.
#
# NOTE: On Render free tier, /tmp is ephemeral between deploys but
# survives sleep/wake cycles within the same deploy. This is sufficient
# to fix the 15-minute sleep problem. For permanent persistence across
# deploys, set CONTEXT_STORE_DIR to a mounted volume.

import json
import logging
import os
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

# Where to store context files. Use the operating system's writable temp
# directory by default and allow deployments to override it with a volume.
CONTEXT_DIR = Path(
    os.environ.get("CONTEXT_STORE_DIR", str(Path(tempfile.gettempdir()) / "superbrowser_contexts"))
)


def save_context(session_id: str, tab_id: str, context: dict) -> None:
    """
    Persist a single tab's context to disk as a JSON file.

    Called after every mutation (add_query, add_results, add_visited_page)
    to ensure the latest state is always on disk.

    File path: CONTEXT_DIR/{session_id}_{tab_id}.json

    Args:
        session_id: The user's browsing session identifier.
        tab_id:     The specific tab identifier within the session.
        context:    The full context dict to persist.
    """
    try:
        CONTEXT_DIR.mkdir(parents=True, exist_ok=True)
        path = CONTEXT_DIR / f"{session_id}_{tab_id}.json"
        path.write_text(
            json.dumps(context, default=str, indent=2),
            encoding="utf-8"
        )
        logger.debug("Context saved: %s", path.name)
    except Exception as exc:
        # Never crash the main request path due to persistence failure.
        # Log the error and continue — the in-memory cache still works.
        logger.warning("Failed to save context to disk: %s", exc)


def load_all_contexts() -> dict[str, dict]:
    """
    Load all persisted contexts from disk on backend startup.

    Returns a dict structured as:
        { session_id: { tab_id: context_dict } }

    This dict is used to pre-populate the in-memory cache so users
    returning after a Render sleep find their research sessions intact.

    Corrupt files are removed automatically to prevent repeated failures.
    """
    if not CONTEXT_DIR.exists():
        logger.info("No persisted contexts found at %s — starting fresh.", CONTEXT_DIR)
        return {}

    contexts: dict[str, dict] = {}
    loaded = 0
    removed = 0

    for path in CONTEXT_DIR.glob("*_*.json"):
        # Filename format: {session_id}_{tab_id}.json
        # We split on the LAST underscore because session_id may contain underscores.
        stem = path.stem  # e.g. "sess123_tab1"
        try:
            session_id, tab_id = stem.rsplit("_", 1)
        except ValueError:
            # Filename doesn't match our pattern — skip it
            logger.warning("Skipping unexpected context file: %s", path.name)
            continue

        try:
            context = json.loads(path.read_text(encoding="utf-8"))
            contexts.setdefault(session_id, {})[tab_id] = context
            loaded += 1
        except (json.JSONDecodeError, OSError, ValueError) as exc:
            logger.warning("Removing corrupt context file %s: %s", path.name, exc)
            try:
                path.unlink()
                removed += 1
            except OSError:
                pass

    logger.info(
        "Context persistence: loaded %d session(s), removed %d corrupt file(s).",
        loaded,
        removed,
    )
    return contexts


def delete_context(session_id: str, tab_id: str | None = None) -> list[str]:
    """Delete persisted context and return the names of files that could not be removed."""
    try:
        paths = (
            [CONTEXT_DIR / f"{session_id}_{tab_id}.json"]
            if tab_id is not None
            else list(CONTEXT_DIR.glob(f"{session_id}_*.json"))
        )
    except OSError as exc:
        logger.warning("Failed to enumerate persisted context for %s: %s", session_id, exc)
        return [CONTEXT_DIR.name or "context directory"]

    failed_paths: list[str] = []
    for path in paths:
        try:
            path.unlink(missing_ok=True)
            logger.debug("Context deleted: %s", path.name)
        except OSError as exc:
            failed_paths.append(path.name)
            logger.warning("Failed to delete context file %s: %s", path.name, exc)

    return failed_paths