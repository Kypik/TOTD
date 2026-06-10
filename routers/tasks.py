from fastapi import APIRouter, HTTPException, Query
import aiosqlite
import random

router = APIRouter(prefix="/api", tags=["Задачи"])

DATABASE_URL = "tasks.db"

@router.get("/categories")
async def get_categories():
    async with aiosqlite.connect(DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT id, slug, name, icon FROM categories") as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

@router.get("/tasks/random")
async def get_random_task(category_slug: str = Query(None), difficulty: int = Query(None)):
    async with aiosqlite.connect(DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        
        query = """
            SELECT tasks.id, tasks.title, tasks.description, tasks.difficulty, 
                   categories.name as category_name, categories.icon
            FROM tasks
            JOIN categories ON tasks.category_id = categories.id
            WHERE 1=1
        """
        params = []
        
        if category_slug:
            query += " AND categories.slug = ?"
            params.append(category_slug)
            
        if difficulty:
            query += " AND tasks.difficulty = ?"
            params.append(difficulty)
            
        async with db.execute(query, params) as cursor:
            tasks = await cursor.fetchall()
            if not tasks:
                raise HTTPException(status_code=404, detail="Заданий не найдено.")
            
            return dict(random.choice(tasks))
        
@router.get("/tasks/count_saved")
async def get_count_saved(task_id: int, status: str = "saved"):
    async with aiosqlite.connect(DATABASE_URL) as db:
        async with db.execute("""SELECT COUNT(*) FROM user_tasks WHERE task_id = ? AND status = ?""", (task_id, status)) as cursor:
            count = await cursor.fetchone()

        return {"count_saved_task": count[0]}
