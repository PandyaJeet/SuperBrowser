import os
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

# Run database setup if database/context_db.py does not exist
backend_dir = Path(__file__).parent
sys.path.append(str(backend_dir))
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


@app.get("/")
async def root():
    return {"message": "Welcome to SuperBrowser API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "SuperBrowser API"}
