from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.process import router as process_router

app = FastAPI(title="Shadowing English Teacher API", version="0.1.0")

app.include_router(health_router)
app.include_router(process_router)


@app.get("/")
async def root():
    return {"service": "shadowing-backend", "version": "0.1.0"}
