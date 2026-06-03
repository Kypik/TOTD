from fastapi import APIRouter, HTTPException, Query
import aiosqlite
import logging

router = APIRouter(prefix="/api", tags=["Панель администрации"])
logger = logging.getLogger("admin")

DATABASE_URL = "tasks.db"

@router.post("/admin/tasks")
async def post_new_task(user_id: int, category_id: int, title: str, description: str, difficulty: int):
    async with aiosqlite.connect(DATABASE_URL) as db:
        async with db.execute("SELECT role FROM users WHERE id = ?", (user_id,)) as cursor:
            role = await cursor.fetchone()
            if role is None or "admin" not in role:
                raise HTTPException(status_code=403, detail="Доступ запрещен")
            
            await db.execute("INSERT INTO tasks (category_id, title, description, difficulty) VALUES (?, ?, ?, ?)", (category_id, title, description, difficulty))
            await db.commit()

            return {"status": "success",
                    "message": f"Задача {title} успешно добавлена"}
        
@router.post("/admin/category")
async def post_new_category(user_id: int, name: str, icon: str):
    async with aiosqlite.connect(DATABASE_URL) as db:
        async with db.execute("SELECT role FROM users WHERE id = ?", (user_id,)) as cursor:
            role = await cursor.fetchone()
            if role is None or "admin" not in role:
                raise HTTPException(status_code=403, detail="Доступ запрещен")
        
            await db.execute("INSERT INTO categories (name, icon) VALUES (?, ?)", (name, icon))
            await db.commit()
        
            return {
                "status": "success",
                "message": f"Категория '{name}' успешно создана"
            }