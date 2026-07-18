from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.process import router as process_router
from app.api.evaluate import router as evaluate_router
from app.api.materials import router as materials_router
from app.api.sessions import router as sessions_router
from app.api.attempts import router as attempts_router

app = FastAPI(title="Shadowing English Teacher API", version="0.1.0")

app.include_router(health_router)
app.include_router(process_router)
app.include_router(evaluate_router)
app.include_router(materials_router)
app.include_router(sessions_router)
app.include_router(attempts_router)


@app.get("/")
async def root():
    return {"service": "shadowing-backend", "version": "0.1.0"}
