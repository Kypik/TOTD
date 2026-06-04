from fastapi import APIRouter, HTTPException
import aiosqlite
import logging
import os

router = APIRouter(prefix="/api", tags=["Панель администрации"])
logger = logging.getLogger("admin")

ICONS_DIR = "static/icons"
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
async def post_new_category(user_id: int, slug: str, name: str, icon: str):
    async with aiosqlite.connect(DATABASE_URL) as db:
        async with db.execute("SELECT role FROM users WHERE id = ?", (user_id,)) as cursor:
            role = await cursor.fetchone()

        if role is None or "admin" not in role:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
        
        await db.execute("INSERT INTO categories (slug, name, icon) VALUES (?, ?, ?)", (slug, name, icon))
        await db.commit()
    
        return {"status": "success",
                "message": f"Категория '{name}' успешно создана"}
    
@router.get("/icons")
async def get_available_icons():
    """Возвращает список всех иконок из папки static/icon/"""
    allowed_extensions = ('.svg')
    
    if not os.path.exists(ICONS_DIR):
        return []
    
    icons = []
    for filename in sorted(os.listdir(ICONS_DIR)):
        if filename.lower().endswith(allowed_extensions):
            icons.append({
                "filename": filename,
                "path": f"/static/icon/{filename}"
            })
    
    return icons