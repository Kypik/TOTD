from fastapi import APIRouter, HTTPException, Query
import aiosqlite
import logging

router = APIRouter(prefix="/api", tags=["Личный кабинет и авторизация"])
logger = logging.getLogger("AUTH")

DATABASE_URL = "tasks.db"

@router.post("/register")
async def register_user(name: str, password: str):
    async with aiosqlite.connect(DATABASE_URL) as db:
        async with db.execute("SELECT id FROM USERS WHERE username = ?", (name,)) as cursor:
            existing_user = await cursor.fetchone()
            if existing_user is not None:
                raise HTTPException(status_code=400, detail="Пользователь с таким именем уже зарегистрирован")
            await db.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", (name, password, "user"))
            await db.commit()

            return {"status": "success",
                    "message": f"Пользователь {name} успешно зарегестрирован"}

@router.post("/login")
async def login_user(name: str, password: str):
    async with aiosqlite.connect(DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM USERS WHERE username = ?", (name,)) as cursor:
            user = await cursor.fetchone()
            if user is None:
                raise HTTPException(status_code=401, detail="Неверное имя пользователя!")
            if user["password_hash"] != password:
                raise HTTPException(status_code=401, detail="Неверный пароль!")
                
            return {"status": "success",
                    "message": f"Пользователь {name} успешно вошел в аккаунт"}

@router.post("/user/tasks/save")
async def save_task_to_profile(user_id: int, task_id: int):
    async with aiosqlite.connect(DATABASE_URL) as db:
        async with db.execute("SELECT status FROM user_tasks WHERE user_id = ? and task_id = ?", (user_id, task_id)) as cursor:
            existing = await cursor.fetchone()
        if existing is not None:
            raise HTTPException(status_code=400, detail="Данная задача уже добавлена в личный кабинет")
        
        await db.execute("ISERT INTO user_tasks (user_id, task_id, status) VALUES (?, ?, ?)", (user_id, task_id, "saved"))
        await db.commit()

        return {"status": "success",
                "message": f"Задача {task_id} успешно добавлена в личный кабинет"}