import sqlite3
import json
import os
import shutil
import zipfile
import tempfile
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
import requests

# Создаем приложение FastAPI
app = FastAPI(
    title="Student Orders API",
    description="API для системы управления заказами практических работ",
    version="1.0.0"
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://bbifather.ru", "https://www.bbifather.ru", "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Переменные окружения теперь передаются через docker-compose
# поэтому функция load_env() и ее вызов больше не нужны.

# Пути для данных и загрузок
# Определяем путь относительно main.py файла backend
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
DATABASE_PATH = os.path.join(DATA_DIR, "database.db")

# Создание директорий при запуске
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Настройки для уведомлений
BOT_URL = "http://localhost:8080"

def get_db_connection():
    """Получение подключения к базе данных"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # Возвращает строки как dict
    return conn

def init_database():
    """Инициализация базы данных"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Создаем таблицу студентов
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            group_name TEXT,
            telegram TEXT,
            email TEXT,
            phone TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Миграция: проверяем схему таблицы students
    cursor.execute("PRAGMA table_info(students)")
    columns_info = cursor.fetchall()
    
    # Проверяем если email или phone имеют NOT NULL ограничение
    needs_migration = False
    for column in columns_info:
        column_name = column[1]  # name
        not_null = column[3]     # notnull
        if column_name in ['email', 'phone'] and not_null == 1:
            needs_migration = True
            break
    
    # Если нужна миграция - пересоздаем таблицу
    if needs_migration:
        print("🔄 Миграция таблицы students: убираем NOT NULL для email и phone")
        
        # Сохраняем существующие данные
        cursor.execute("SELECT * FROM students")
        existing_data = cursor.fetchall()
        
        # Удаляем старую таблицу
        cursor.execute("DROP TABLE students")
        
        # Создаем новую таблицу с правильной схемой
        cursor.execute("""
            CREATE TABLE students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                group_name TEXT,
                telegram TEXT,
                email TEXT,
                phone TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Восстанавливаем данные
        for row in existing_data:
            cursor.execute("""
                INSERT INTO students (id, name, group_name, telegram, email, phone, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (row[0], row[1], row[2] if len(row) > 2 else None, 
                  row[3] if len(row) > 3 else None, row[4] if len(row) > 4 else None, 
                  row[5] if len(row) > 5 else None, row[6] if len(row) > 6 else None))
        
        print("✅ Миграция завершена")
    
    # Добавляем новые столбцы если их нет
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN group_name TEXT")
        print("✅ Добавлен столбец group_name")
    except sqlite3.OperationalError:
        # Столбец уже существует
        pass
        
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN telegram TEXT")
        print("✅ Добавлен столбец telegram")
    except sqlite3.OperationalError:
        # Столбец уже существует
        pass
    
    # Создаем таблицу предметов
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL DEFAULT 0.0,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Создаем таблицу заказов
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            subject_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            input_data TEXT,
            variant_info TEXT,
            deadline DATE NOT NULL,
            status TEXT DEFAULT 'new',
            is_paid BOOLEAN DEFAULT 0,
            files TEXT,
            selected_works TEXT,
            is_full_course BOOLEAN DEFAULT 0,
            actual_price REAL DEFAULT 0.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students (id),
            FOREIGN KEY (subject_id) REFERENCES subjects (id)
        )
    """)
    
    # Миграция: добавляем столбец variant_info если его нет
    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN variant_info TEXT")
        print("✅ Добавлен столбец variant_info")
    except sqlite3.OperationalError:
        # Столбец уже существует
        pass
        
    # Миграции для новых столбцов
    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN selected_works TEXT")
        print("✅ Добавлен столбец selected_works")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN is_full_course BOOLEAN DEFAULT 0")
        print("✅ Добавлен столбец is_full_course")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN actual_price REAL DEFAULT 0.0")
        print("✅ Добавлен столбец actual_price")
    except sqlite3.OperationalError:
        pass
        
    # Миграции для полей исправлений
    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN revision_comment TEXT")
        print("✅ Добавлен столбец revision_comment")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN revision_grade TEXT")
        print("✅ Добавлен столбец revision_grade")
    except sqlite3.OperationalError:
        pass
    
    # Добавляем базовые предметы
    cursor.execute("SELECT COUNT(*) FROM subjects")
    if cursor.fetchone()[0] == 0:
        subjects = [
            ("Летняя практика", "Системный анализ предприятия, архитектурное моделирование, управление проектами", 2500.0),
            ("Статистические методы", "Практические работы по статистическим методам", 2000.0),
            ("ПУП", "Практики, ИКР, рефераты по проектированию программного обеспечения", 2200.0),
            ("Цифровая экономика", "Практические и лабораторные работы по цифровой экономике", 1800.0),
            ("Моделирование бизнес-процессов", "Практические работы по моделированию БП", 2000.0),
            ("Другой предмет", "Индивидуальное задание по другому предмету", 1500.0),
        ]
        cursor.executemany(
            "INSERT INTO subjects (name, description, price) VALUES (?, ?, ?)",
            subjects
        )
    
    conn.commit()
    conn.close()

def send_notification(endpoint: str, data: dict):
    """Отправка уведомления боту"""
    try:
        url = f"{BOT_URL}/webhook/{endpoint}"
        print(f"📤 Отправляем уведомление: {url}")
        print(f"🔍 Данные для отправки: {data}")
        response = requests.post(url, json=data, timeout=30)
        print(f"✅ Уведомление отправлено, статус: {response.status_code}")
        if response.status_code != 200:
            print(f"⚠️ Ответ сервера: {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Ошибка отправки уведомления: {e}")
        print(f"🔧 Проверьте что бот запущен на {BOT_URL}")
        print(f"💡 Для проверки откройте: {BOT_URL}/webhook/test")
    except Exception as e:
        print(f"❌ Неожиданная ошибка: {e}")
        import traceback
        traceback.print_exc()

# Инициализация БД при запуске
@app.on_event("startup")
def startup_event():
    init_database()
    print("🚀 Backend запущен!")
    print(f"📱 Уведомления: {BOT_URL}")

# API Routes
@app.get("/")
def read_root():
    return {"message": "Student Orders API is running"}

# Students endpoints
@app.get("/api/students")
def get_students():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM students ORDER BY created_at DESC")
    students = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return students

@app.post("/api/students")
def create_student(request: Request):
    pass  # Будет создаваться автоматически при создании заказа

# Subjects endpoints
@app.get("/api/subjects")
def get_subjects():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM subjects WHERE is_active = 1 ORDER BY name")
    subjects = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return subjects

# Orders endpoints
@app.get("/api/orders")
def get_orders(page: int = 1, limit: int = 10):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    offset = (page - 1) * limit
    
    # Получаем заказы с данными студентов и предметов
    cursor.execute("""
        SELECT 
            o.*,
            s.name as student_name,
            s.group_name as student_group,
            s.telegram as student_telegram,
            sub.name as subject_name,
            sub.description as subject_description,
            sub.price as subject_price
        FROM orders o
        JOIN students s ON o.student_id = s.id
        JOIN subjects sub ON o.subject_id = sub.id
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
    """, (limit, offset))
    
    orders = []
    for row in cursor.fetchall():
        order = dict(row)
        # Добавляем связанные объекты
        order['student'] = {
            'id': order['student_id'],
            'name': order['student_name'],
            'group': order['student_group'],
            'telegram': order['student_telegram']
        }
        order['subject'] = {
            'id': order['subject_id'],
            'name': order['subject_name'],
            'description': order['subject_description'],
            'price': order['subject_price']
        }
        # Парсим файлы
        if order['files']:
            try:
                order['files'] = json.loads(order['files'])
            except:
                order['files'] = []
        else:
            order['files'] = []
        
        # Убираем дублированные поля
        for key in ['student_name', 'student_group', 'student_telegram', 
                   'subject_name', 'subject_description', 'subject_price']:
            order.pop(key, None)
        
        orders.append(order)
    
    # Получаем общее количество
    cursor.execute("SELECT COUNT(*) FROM orders")
    total = cursor.fetchone()[0]
    
    conn.close()
    
    return {"orders": orders, "total": total}

@app.get("/api/orders/{order_id}")
def get_order(order_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            o.*,
            s.name as student_name,
            s.group_name as student_group,
            s.telegram as student_telegram,
            sub.name as subject_name,
            sub.description as subject_description,
            sub.price as subject_price
        FROM orders o
        JOIN students s ON o.student_id = s.id
        JOIN subjects sub ON o.subject_id = sub.id
        WHERE o.id = ?
    """, (order_id,))
    
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    order = dict(row)
    order['student'] = {
        'id': order['student_id'],
        'name': order['student_name'],
        'group': order['student_group'],
        'telegram': order['student_telegram']
    }
    order['subject'] = {
        'id': order['subject_id'],
        'name': order['subject_name'],
        'description': order['subject_description'],
        'price': order['subject_price']
    }
    
    if order['files']:
        try:
            order['files'] = json.loads(order['files'])
        except:
            order['files'] = []
    else:
        order['files'] = []
    
    conn.close()
    return order

@app.post("/api/orders")
async def create_order(request: Request):
    data = await request.json()
    
    print("📥 Получены данные заказа:", json.dumps(data, indent=2, ensure_ascii=False))
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Проверяем обязательные поля
        if 'student' not in data:
            raise HTTPException(status_code=400, detail="Отсутствуют данные студента")
        if 'subject_id' not in data:
            raise HTTPException(status_code=400, detail="Не указан предмет")
        if not data.get('title'):
            raise HTTPException(status_code=400, detail="Не указано название работы")
        if not data.get('deadline'):
            raise HTTPException(status_code=400, detail="Не указан дедлайн")
        
        # Создаем или получаем студента
        student_data = data['student']
        cursor.execute("SELECT id FROM students WHERE telegram = ?", (student_data['telegram'],))
        student_row = cursor.fetchone()
        
        if student_row:
            student_id = student_row[0]
            print(f"👤 Найден существующий студент ID: {student_id}")
            # Обновляем данные студента
            cursor.execute(
                "UPDATE students SET name = ?, group_name = ? WHERE id = ?",
                (student_data['name'], student_data['group'], student_id)
            )
        else:
            cursor.execute(
                "INSERT INTO students (name, group_name, telegram) VALUES (?, ?, ?)",
                (student_data['name'], student_data['group'], student_data['telegram'])
            )
            student_id = cursor.lastrowid
            print(f"👤 Создан новый студент ID: {student_id}")
        
        # Получаем subject_id и проверяем его существование
        subject_id = int(data['subject_id'])
        cursor.execute("SELECT id, name FROM subjects WHERE id = ?", (subject_id,))
        subject_row = cursor.fetchone()
        
        if not subject_row:
            raise HTTPException(status_code=400, detail=f"Предмет с ID {subject_id} не найден")
        
        print(f"📚 Предмет: {subject_row[1]} (ID: {subject_id})")
        
        # Получаем рассчитанную стоимость из frontend
        actual_price = data.get('actual_price', 0.0)
        selected_works_json = ""
        is_full_course = data.get('is_full_course', False)
        
        if data.get('selected_works'):
            selected_works_json = json.dumps(data['selected_works'])
            print(f"💰 Выбранные работы: {data['selected_works']}")
        
        if is_full_course:
            print(f"💰 Заказ всего курса")
        
        print(f"💰 Стоимость заказа: {actual_price} ₽")
        
        # Создаем заказ
        cursor.execute("""
            INSERT INTO orders (student_id, subject_id, title, description, input_data, variant_info, deadline, selected_works, is_full_course, actual_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            student_id,
            subject_id,
            data['title'],
            data.get('description', ''),
            data.get('input_data', ''),
            data.get('variant_info', ''),
            data['deadline'],
            selected_works_json,
            is_full_course,
            actual_price
        ))
        
        order_id = cursor.lastrowid
        print(f"📝 Создан заказ ID: {order_id}")
        conn.commit()
        
        # Возвращаем созданный заказ
        cursor.execute("""
            SELECT 
                o.*,
                s.name as student_name,
                s.group_name as student_group,
                s.telegram as student_telegram,
                sub.name as subject_name,
                sub.description as subject_description,
                sub.price as subject_price
            FROM orders o
            JOIN students s ON o.student_id = s.id
            JOIN subjects sub ON o.subject_id = sub.id
            WHERE o.id = ?
        """, (order_id,))
        
        row = cursor.fetchone()
        order = dict(row)
        order['student'] = {
            'id': order['student_id'],
            'name': order['student_name'],
            'group': order['student_group'],
            'telegram': order['student_telegram']
        }
        order['subject'] = {
            'id': order['subject_id'],
            'name': order['subject_name'],
            'description': order['subject_description'],
            'price': order['subject_price']
        }
        order['files'] = []
        
        conn.close()
        
        # Отправляем уведомление о новом заказе
        try:
            notification_data = {
                'id': order['id'],
                'student_name': order['student']['name'],
                'student_group': order['student']['group'],
                'student_telegram': order['student']['telegram'],
                'subject_name': order['subject']['name'],
                'title': order['title'],
                'description': order['description'],
                'input_data': order['input_data'],
                'variant_info': order['variant_info'],
                'deadline': order['deadline'],
                'price': order['subject']['price']
            }
            send_notification('new_order', notification_data)
        except:
            pass  # Не критично если уведомление не отправилось
        
        return order
        
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/orders/{order_id}/status")
async def update_order_status(order_id: int, request: Request):
    data = await request.json()
    status = data['status']
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (status, order_id)
    )
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    conn.commit()
    conn.close()
    
    # Возвращаем обновленный заказ
    return get_order(order_id)

@app.patch("/api/orders/{order_id}/paid")
def mark_order_as_paid(order_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "UPDATE orders SET is_paid = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (order_id,)
    )
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    conn.commit()
    conn.close()
    
    return get_order(order_id)

@app.post("/api/orders/{order_id}/files")
async def upload_order_files(order_id: int, files: list[UploadFile] = File(...)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, title, status FROM orders WHERE id = ?", (order_id,))
    order_data = cursor.fetchone()
    if not order_data:
        conn.close()
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    # Создаем папку для файлов заказа
    upload_dir = f"uploads/order_{order_id}"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Сохраняем загруженные файлы
    saved_files = []
    
    if not files or len(files) == 0:
        # Если файлы не загружены, создаем демонстрационные
        files_data = [
            ("completed_work.docx", "demo"),
            ("report.pdf", "demo")
        ]
        
        for filename, file_type in files_data:
            file_path = os.path.join(upload_dir, filename)
            
            if file_type == "demo" and filename.endswith('.docx'):
                # Создаем демо DOCX файл
                import zipfile
                with zipfile.ZipFile(file_path, 'w') as docx:
                    docx.writestr('[Content_Types].xml', '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>''')
                    docx.writestr('word/document.xml', f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:r><w:t>Выполненная работа для заказа #{order_id}</w:t></w:r></w:p>
<w:p><w:r><w:t>Это демонстрационный файл.</w:t></w:r></w:p>
<w:p><w:r><w:t>Статус: Выполнено</w:t></w:r></w:p>
</w:body>
</w:document>''')
                    docx.writestr('_rels/.rels', '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>''')
                    
            elif file_type == "demo" and filename.endswith('.pdf'):
                # Создаем демо PDF файл
                content = f"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 80>>stream
BT/F1 12 Tf 50 750 Td(Выполненная работа для заказа #{order_id})Tj 0 -20 Td(Демонстрационный файл)Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref 0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000400 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref 467
%%EOF"""
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)
            
            saved_files.append(filename)
            
    else:
        # Сохраняем реальные загруженные файлы
        for file in files:
            if file.filename:
                file_path = os.path.join(upload_dir, file.filename)
                
                # Сохраняем файл на диск
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                
                saved_files.append(file.filename)
                print(f"💾 Сохранен файл: {file.filename} для заказа {order_id}")
    
    # Обновляем информацию о файлах в базе данных
    cursor.execute(
        "UPDATE orders SET files = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (json.dumps(saved_files), order_id)
    )
    
    conn.commit()
    conn.close()
    
    print(f"📎 Файлы добавлены к заказу {order_id}: {saved_files}")
    
    return get_order(order_id)

@app.get("/api/orders/{order_id}/download/{filename}")
async def download_file(order_id: int, filename: str):
    """Скачивание файла по заказу"""
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Проверяем существование заказа и файлов
    cursor.execute("SELECT files FROM orders WHERE id = ?", (order_id,))
    result = cursor.fetchone()
    conn.close()
    
    if not result:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    files_json = result[0]
    if not files_json:
        raise HTTPException(status_code=404, detail="Файлы не найдены")
    
    try:
        files = json.loads(files_json)
    except:
        files = []
    
    if filename not in files:
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    # В реальной системе файлы лежали бы в папке uploads/order_{order_id}/
    # Здесь создаем заглушку - временный файл для демонстрации
    file_path = f"uploads/order_{order_id}/{filename}"
    
    # Создаем папку если не существует
    os.makedirs(f"uploads/order_{order_id}", exist_ok=True)
    
    # Проверяем что файл существует
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Файл {filename} не найден на сервере")
    
    # Определяем правильный media-type
    if filename.endswith('.docx'):
        media_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    elif filename.endswith('.pdf'):
        media_type = 'application/pdf'
    elif filename.endswith('.txt'):
        media_type = 'text/plain; charset=utf-8'
    else:
        media_type = 'application/octet-stream'
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type
    )

@app.get("/api/orders/{order_id}/download-all")
async def download_all_files(order_id: int):
    """Скачивание всех файлов заказа в zip архиве"""
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Проверяем существование заказа и файлов
    cursor.execute("SELECT files, title FROM orders WHERE id = ?", (order_id,))
    result = cursor.fetchone()
    conn.close()
    
    if not result:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    files_json, order_title = result
    if not files_json:
        raise HTTPException(status_code=404, detail="Файлы не найдены")
    
    try:
        files = json.loads(files_json)
    except:
        files = []
    
    if not files:
        raise HTTPException(status_code=404, detail="Нет файлов для скачивания")
    
    # Создаем временный zip файл
    with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_zip:
        with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for filename in files:
                file_path = f"uploads/order_{order_id}/{filename}"
                if os.path.exists(file_path):
                    zip_file.write(file_path, filename)
                    print(f"📦 Добавлен в архив: {filename}")
                else:
                    print(f"⚠️ Файл не найден: {filename}")
        
        # Генерируем имя для zip файла
        safe_title = "".join(c for c in order_title if c.isalnum() or c in (' ', '-', '_')).rstrip()
        zip_filename = f"Заказ_{order_id}_{safe_title[:30]}.zip"
        
        return FileResponse(
            path=temp_zip.name,
            filename=zip_filename,
            media_type='application/zip',
            background=lambda: os.unlink(temp_zip.name)  # Удаляем временный файл после отправки
        )

@app.post("/api/orders/{order_id}/payment-notification")
async def notify_payment(order_id: int):
    """Уведомление администратора об оплате заказа студентом"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Получаем информацию о заказе
    cursor.execute("""
        SELECT 
            o.id, o.title, o.status, o.description, o.input_data, o.variant_info, o.deadline,
            s.name as student_name,
            s.group_name as student_group,
            s.telegram as student_telegram,
            sub.name as subject_name,
            sub.price as subject_price
        FROM orders o
        JOIN students s ON o.student_id = s.id
        JOIN subjects sub ON o.subject_id = sub.id
        WHERE o.id = ?
    """, (order_id,))
    
    order_data = cursor.fetchone()
    if not order_data:
        conn.close()
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    order = dict(order_data)
    conn.close()
    
    # Отправляем уведомление в Telegram
    try:
        notification_data = {
            'order_id': order['id'],
            'student_name': order['student_name'],
            'student_group': order['student_group'],
            'student_telegram': order['student_telegram'],
            'subject_name': order['subject_name'],
            'title': order['title'],
            'description': order['description'],
            'input_data': order['input_data'],
            'variant_info': order['variant_info'],
            'deadline': order['deadline'],
            'price': order['subject_price']
        }
        print(f"🔍 Данные для уведомления: {notification_data}")
        send_notification('payment_notification', notification_data)
        print(f"💰 Отправлено уведомление об оплате заказа #{order_id}")
    except Exception as e:
        print(f"❌ Ошибка отправки уведомления об оплате: {e}")
        import traceback
        traceback.print_exc()
    
    return {"status": "notification_sent", "order_id": order_id}

@app.post("/api/orders/{order_id}/request-revision")
async def request_order_revision(order_id: int, request: Request):
    """Запрос исправлений для заказа"""
    data = await request.json()
    comment = data.get('comment', '')
    grade = data.get('grade')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Получаем информацию о заказе
    cursor.execute("""
        SELECT 
            o.id, o.title, o.status, o.description, o.input_data, o.variant_info, o.deadline,
            s.name as student_name,
            s.group_name as student_group,
            s.telegram as student_telegram,
            sub.name as subject_name,
            sub.price as subject_price
        FROM orders o
        JOIN students s ON o.student_id = s.id
        JOIN subjects sub ON o.subject_id = sub.id
        WHERE o.id = ?
    """, (order_id,))
    
    order_data = cursor.fetchone()
    if not order_data:
        conn.close()
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    order = dict(order_data)
    
    # Обновляем заказ на статус "требуют исправления"
    cursor.execute("""
        UPDATE orders 
        SET status = 'needs_revision', 
            revision_comment = ?, 
            revision_grade = ?, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    """, (comment, grade, order_id))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    conn.commit()
    conn.close()
    
    # Отправляем уведомление админу о необходимости исправлений
    try:
        notification_data = {
            'order_id': order_id,
            'order_title': order['title'],
            'student_name': order['student_name'],
            'student_group': order['student_group'],
            'student_telegram': order['student_telegram'],
            'subject_name': order['subject_name'],
            'comment': comment,
            'grade': grade,
            'deadline': order['deadline']
        }
        send_notification('revision_request', notification_data)
        print(f"🔄 Отправлено уведомление о запросе исправлений для заказа #{order_id}")
    except Exception as e:
        print(f"❌ Ошибка отправки уведомления о исправлениях: {e}")
    
    # Возвращаем обновленный заказ
    return get_order(order_id)

@app.post("/api/test-bot-connection")
async def test_bot_connection():
    """Тестовая отправка уведомления для проверки соединения с ботом"""
    test_data = {
        'order_id': 999,
        'student_name': 'Тест Тестов',
        'student_group': 'ТЕСТ-00',
        'student_telegram': '@test_user',
        'subject_name': 'Тестовый предмет',
        'title': 'Тестовая работа',
        'description': 'Описание тестовой работы',
        'input_data': 'Тестовые требования',
        'variant_info': 'Тестовый вариант',
        'deadline': '2024-12-31',
        'price': 1000
    }
    
    print("🧪 Тестируем соединение с ботом...")
    try:
        send_notification('payment_notification', test_data)
        return {"status": "success", "message": "Тестовое уведомление отправлено"}
    except Exception as e:
        print(f"❌ Тест не прошел: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)