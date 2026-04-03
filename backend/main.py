from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import seo, ai, community

app = FastAPI(title="SuperBrowser API")

# CORS configuration - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(seo.router, prefix="/api/search", tags=["SEO"])
app.include_router(ai.router, prefix="/api/search", tags=["AI"])
app.include_router(community.router, prefix="/api/search", tags=["Community"])


@app.get("/")
async def root():
    return {"message": "Welcome to SuperBrowser API"}
