from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routes import auth, chat, files, projects, prompts


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Chatbot Platform API",
    description="Multi-user chatbot platform with customizable LLM providers",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(prompts.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(files.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
