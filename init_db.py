import sqlite3

def init_database():
    conn = sqlite3.connect('tasks.db')
    cursor = conn.cursor()

if __name__ == '__main__':
    init_database()