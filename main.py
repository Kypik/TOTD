from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging  

from init_db import init_database
from routers import tasks, users

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
    logger.info("Запуск сервера. Начинаю проверку базы данных...")
    try:
        init_database()
        logger.info("Инициализация базы данных успешно завершена.")
    except Exception as e:
        logger.error(f"Критическая ошибка при старте базы данных: {e}", exc_info=True)
    yield
    logger.info("Сервер останавливается...")

app = FastAPI(title="Random Task Generator API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router)
app.include_router(users.router)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def root():
    logger.info("Пользователь зашел на главную страницу API (эндпоинт '/')")
    return {"status": "working", "message": "Добро пожаловать в API!"}