import os
import sys
from pathlib import Path

# Support launching from the repository root with
# `python -m uvicorn backend.main:app`.
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from utils.context_persistence import load_all_contexts
from routers import pages  # ← This might already exist, check if it's missing

from dotenv import load_dotenv
load_dotenv()

# Run database setup if database/context_db.py does not exist
db_file = backend_dir / "database" / "context_db.py"
if not db_file.exists():
    import setup_database

# 1. Added Depends here to handle authentication middleware
from fastapi import FastAPI, Depends 
from fastapi.middleware.cors import CORSMiddleware

from routers import seo, ai, community, context
# 2. Extract the specific validation function to use as a global route guard
from routers.context import verify_token 

app = FastAPI(title="SuperBrowser API")

def get_allowed_origins() -> list[str]:
    origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in origins.split(",") if origin.strip()]


# CORS configuration - restrict credentialed requests to configured origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers - Protected search routes with verify_token dependencies
app.include_router(seo.router, prefix="/api/search", tags=["SEO"], dependencies=[Depends(verify_token)])
app.include_router(ai.router, prefix="/api/search", tags=["AI"], dependencies=[Depends(verify_token)])
app.include_router(community.router, prefix="/api/search", tags=["Community"], dependencies=[Depends(verify_token)])

# Context router already enforces its own inner dependencies or mounts under context directly
app.include_router(context.router, prefix="/api", tags=["Context"])
app.include_router(pages.router, prefix="/api", tags=["Pages"])

@app.on_event("startup")
async def warn_if_session_token_missing():
    """
    verify_token fails closed: with no SUPERBROWSER_SESSION_TOKEN configured it
    rejects every /api/search/* and /api/context/* request with HTTP 500
    ("Server authentication not configured"). That is intentional, but a bare
    500 gives no clue why, so say so loudly at startup instead.

    The token itself is never logged.
    """
    if os.getenv("SUPERBROWSER_SESSION_TOKEN"):
        print("[Startup] SUPERBROWSER_SESSION_TOKEN is configured.")
        return

    print("=" * 78)
    print("[Startup] WARNING: SUPERBROWSER_SESSION_TOKEN is not set.")
    print("")
    print("  Every /api/search/* and /api/context/* request will fail with")
    print('  HTTP 500 "Server authentication not configured" until you set it.')
    print("")
    print("  Generate a token:")
    print("    python -c \"import secrets; print(secrets.token_urlsafe(32))\"")
    print("")
    print("  Then set SUPERBROWSER_SESSION_TOKEN in backend/.env, and set the")
    print("  frontend's VITE_SUPERBROWSER_SESSION_TOKEN to the SAME value.")
    print("  See the Configuration section of README.md.")
    print("=" * 78)


@app.on_event("startup")
async def load_persisted_contexts():
    """
    On startup, load any contexts that were persisted to disk
    from a previous server run. This ensures users returning after
    a Render sleep find their research sessions intact.
    """
    persisted = load_all_contexts()
    if persisted:
        # Import _context_store from context module
        from routers.context import _context_store
        for session_id, tabs in persisted.items():
            for tab_id, context_data in tabs.items():
                # Populate the in-memory store with persisted data
                if session_id not in _context_store:
                    _context_store[session_id] = {}
                _context_store[session_id][tab_id] = context_data
        total_tabs = sum(len(tabs) for tabs in persisted.values())
        print(f"[Startup] Restored {total_tabs} tab context(s) from disk.")
    else:
        print("[Startup] No persisted contexts to restore.")

@app.get("/")
async def root():
    return {"message": "Welcome to SuperBrowser API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "SuperBrowser API"}
