from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from contextlib import asynccontextmanager
import logging

from init_db import init_database
from routers import tasks, users, admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s (%(filename)s:%(lineno)d) - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("app.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("MAIN")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("Запуск сервера RandomTask API...")
    logger.info("=" * 60)
    try:
        init_database()
        logger.info("Инициализация базы данных успешно завершена.")
    except Exception as e:
        logger.critical(f"Критическая ошибка при старте базы данных: {e}", exc_info=True)
    yield
    logger.info("Сервер останавливается. До свидания!")


app = FastAPI(
    title="Random Task Generator API",
    description="Бэкенд для генератора случайных задач",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router)
app.include_router(users.router)
app.include_router(admin.router)

@app.middleware("http")
async def redirect_html_requests(request: Request, call_next):
    path = request.url.path.lower()
    
    if "index.html" in path:
        return RedirectResponse(url="/", status_code=302)
        
    elif "auth.html" in path:
        return RedirectResponse(url="/auth", status_code=302)
        
    elif "profile.html" in path:
        return RedirectResponse(url="/profile", status_code=302)
    
    elif "admin.html" in path:
        return RedirectResponse(url="/admin", status_code=302)
        
    return await call_next(request)

@app.get("/")
async def read_index():
    return FileResponse("static/index.html")

@app.get("/auth")
async def read_auth():
    return FileResponse("static/auth.html")

@app.get("/profile")
async def read_profile():
    return FileResponse("static/profile.html")

@app.get("/admin")
async def read_profile():
    return FileResponse("static/admin.html")


@app.get("/api/health")
async def health_check():
    logger.info("Health check запрос получен")
    return {
        "status": "working",
        "message": "RandomTask API работает нормально",
        "version": "1.0.0"
    }

app.mount("/static", StaticFiles(directory="static"), name="static")
