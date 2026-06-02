import sqlite3
import json
import os

DB_PATH = 'tasks.db'
JSON_PATH = 'init_data.json'

def init_database():
    if os.path.exists(DB_PATH):
        print(f"[БАЗА ДАННЫХ] Файл '{DB_PATH}' обнаружен. Инициализация не требуется.")
        return

    print(f"[БАЗА ДАННЫХ] Файл '{DB_PATH}' не найден. Начинаю автоматическое развертывание...")

    if not os.path.exists(JSON_PATH):
        print(f"[ОШИБКА] Не удалось создать БД: отсутствует конфигурационный файл '{JSON_PATH}'!")
        return

    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        source_data = json.load(f)
    
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('PRAGMA foreign_keys = ON')

        # Создание таблиц
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                svg_icon TEXT NOT NULL
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                difficulty INTEGER NOT NULL,
                FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'user'
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                task_id INTEGER NOT NULL,
                status TEXT DEFAULT 'saved',
                date_added TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
            )
        ''')

        categories_to_insert = [
            (cat['slug'], cat['name'], cat['icon_file'])
            for cat in source_data['categories']
        ]
        cursor.executemany('INSERT INTO categories (slug, name, svg_icon) VALUES (?, ?, ?)', categories_to_insert)

        cursor.execute("SELECT id, slug FROM categories")
        cat_mapping = {slug: cat_id for cat_id, slug in cursor.fetchall()}

        tasks_to_insert = [
            (cat_mapping[task['category_slug']], task['title'], task['description'], task['difficulty'])
            for task in source_data['tasks']
        ]
        cursor.executemany('INSERT INTO tasks (category_id, title, description, difficulty) VALUES (?, ?, ?, ?)', tasks_to_insert)

        initial_users = [
            ('admin', 'admin123', 'admin'),
            ('user', 'user123', 'user')
        ]
        cursor.executemany('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', initial_users)

        print("[УСПЕХ] База данных успешно развернута.")