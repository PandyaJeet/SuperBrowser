from fastapi import APIRouter

router = APIRouter()


@router.get("/community")
async def get_community():
    return {"status": "ok", "module": "community"}
