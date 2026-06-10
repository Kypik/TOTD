from fastapi import APIRouter, HTTPException
import aiosqlite

router = APIRouter(prefix="/api", tags=["Личный кабинет и авторизация"])

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
                
            return {
                "status": "success",
                "message": f"Пользователь {name} успешно вошел в аккаунт",
                "user_id": user["id"],
                "username": user["username"],
                "role": user["role"]
            }

@router.post("/user/tasks/save")
async def save_task_to_profile(user_id: int, task_id: int):
    async with aiosqlite.connect(DATABASE_URL) as db:
        async with db.execute("SELECT status FROM user_tasks WHERE user_id = ? and task_id = ?", (user_id, task_id)) as cursor:
            existing = await cursor.fetchone()
        if existing is not None:
            raise HTTPException(status_code=400, detail="Данная задача уже добавлена в личный кабинет")
        
        await db.execute("INSERT INTO user_tasks (user_id, task_id, status) VALUES (?, ?, ?)", (user_id, task_id, "saved"))
        await db.commit()

        return {"status": "success",
                "message": f"Задача {task_id} успешно добавлена в личный кабинет"}
    
@router.patch("/user/task/complete")
async def complete_task(user_id: int, task_id: int):
    async with aiosqlite.connect(DATABASE_URL) as db:
        async with db.execute("SELECT status FROM user_tasks WHERE user_id = ? AND task_id = ?", (user_id, task_id)) as cursor:
            task_status = await cursor.fetchone()

            if task_status is None:
                raise HTTPException(status_code=404, detail="Задача не найдена в вашем личном кабинете")
            
            await db.execute("UPDATE user_tasks SET status = 'completed' WHERE user_id = ? AND task_id = ?", (user_id, task_id))
            await db.commit()
            
            return {"status": "success",
                "message": f"Задача {task_id} успешно отмечена как выполненная"}
        
@router.delete("/user/task/delete")
async def delete_task(user_id: int, task_id: int):
    async with aiosqlite.connect(DATABASE_URL) as db:
        async with db.execute("SELECT status FROM user_tasks WHERE user_id = ? and task_id = ?", (user_id, task_id)) as cursor:
            existing = await cursor.fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Задача не найдена в вашем личном кабинете")
        
        await db.execute("DELETE FROM user_tasks WHERE user_id = ? AND task_id = ?", (user_id, task_id))
        await db.commit()
        
        return {"status": "success",
                "message": f"Задача {task_id} успешно удалена из личного кабинета"}
    
@router.patch("/user/task/not_complete")
async def not_complete_task(user_id: int, task_id: int):
    async with aiosqlite.connect(DATABASE_URL) as db:
        async with db.execute("SELECT status FROM user_tasks WHERE user_id = ? and task_id = ?", (user_id, task_id)) as cursor:
            existing = await cursor.fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Задача не найдена в вашем личном кабинете")

        await db.execute("UPDATE user_tasks SET status = 'saved' WHERE user_id = ? AND task_id = ?", (user_id, task_id))
        await db.commit()
        
        return {"status": "success",
                "message": f"Задача {task_id} успешно отмечена как невыполненная"}
    

@router.get("/user/profile")
async def get_user_profile(user_id: int):
     async with aiosqlite.connect(DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""SELECT
                                    users.username, users.role, 
                                    COUNT(user_tasks.task_id) as total_saved, 
                                    COUNT(CASE WHEN user_tasks.status = 'completed' THEN 1 END) as total_completed 
                                FROM users LEFT JOIN user_tasks ON users.id = user_tasks.user_id WHERE users.id = ? GROUP BY users.id""", 
                            (user_id,)) as cursor:
            profile = await cursor.fetchone()

        if profile is None:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        return dict(profile)

@router.get("/user/tasks")
async def get_user_tasks(user_id: int, status: str):
    async with aiosqlite.connect(DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""SELECT
                                    tasks.id,
                                    tasks.title,      
                                    tasks.description,
                                    tasks.difficulty,
                                    categories.name,
                                    categories.icon
                              FROM user_tasks
                              JOIN tasks ON user_tasks.task_id = tasks.id
                              JOIN categories ON tasks.category_id = categories.id
                              WHERE user_tasks.user_id = ? AND user_tasks.status = ?
                              """,
                            (user_id, status)) as cursor:

            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

