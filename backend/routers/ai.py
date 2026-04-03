from fastapi import APIRouter

router = APIRouter()


@router.get("/ai")
async def get_ai():
    return {"status": "ok", "module": "ai"}
