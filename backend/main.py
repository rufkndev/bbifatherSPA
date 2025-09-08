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
from supabase import create_client, Client
from dotenv import load_dotenv
from contextlib import asynccontextmanager

# Загружаем переменные из .env файла
load_dotenv()

# Функция для инициализации при запуске
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    if init_database():
        print("🚀 Backend запущен с Supabase!")
    else:
        print("⚠️ Backend запущен без подключения к БД!")
    
    if BOT_TOKEN and BOT_CHAT_ID:
        print("📱 Telegram уведомления настроены")
    else:
        print("⚠️ Telegram уведомления не настроены")
    
    yield
    # Shutdown
    print("👋 Backend остановлен")

# Создаем приложение FastAPI
app = FastAPI(
    title="Student Orders API",
    description="API для системы управления заказами практических работ",
    version="1.0.0",
    lifespan=lifespan
)

# Настройка CORS
FRONTEND_URLS = os.getenv("FRONTEND_URLS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_URLS + ["https://bbifather.ru", "https://www.bbifather.ru"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Переменные окружения
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
BOT_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️ SUPABASE_URL и SUPABASE_KEY должны быть установлены!")
    print("Создайте .env файл или установите переменные окружения")

# Инициализация Supabase клиента
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

# Пути для данных и загрузок
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

def init_database():
    """Проверяем подключение к Supabase и готовность таблиц"""
    if not supabase:
        print("❌ Supabase клиент не инициализирован!")
        return False
    
    try:
        # Проверяем подключение
        response = supabase.table('subjects').select('id').limit(1).execute()
        print("✅ Подключение к Supabase установлено!")
        
        # Проверяем есть ли базовые предметы
        subjects_count = supabase.table('subjects').select('id', count='exact').execute()
        if subjects_count.count == 0:
            print("⚠️ В таблице subjects нет данных. Создайте предметы в Supabase Dashboard.")
        
        return True
    except Exception as e:
        print(f"❌ Ошибка подключения к Supabase: {e}")
        return False

def send_notification(message: str):
    """Отправка уведомления администратору в Telegram"""
    if not BOT_TOKEN or not BOT_CHAT_ID:
        print("⚠️ Telegram бот не настроен")
        print(f"📱 УВЕДОМЛЕНИЕ: {message}")
        return
    
    try:
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        payload = {
            'chat_id': BOT_CHAT_ID,
            'text': message,
            'parse_mode': 'HTML'
        }
        response = requests.post(url, json=payload, timeout=10)
        if response.status_code == 200:
            print("✅ Уведомление отправлено администратору")
        else:
            print(f"❌ Ошибка Telegram API: {response.text}")
    except Exception as e:
        print(f"❌ Ошибка отправки в Telegram: {e}")
        print(f"📱 УВЕДОМЛЕНИЕ: {message}")

async def send_status_notification_to_user(order: dict, new_status: str):
    """Отправка уведомления пользователю об изменении статуса заказа"""
    if not BOT_TOKEN:
        print("⚠️ BOT_TOKEN не настроен для уведомлений пользователей")
        return
        
    user_telegram = order['student'].get('telegram')
    if not user_telegram:
        print("⚠️ У пользователя не указан telegram")
        return
    
    # Получаем chat_id пользователя из БД
    try:
        student_response = supabase.table('students').select('chat_id').eq('telegram', user_telegram).limit(1).execute()
        
        if not student_response.data or not student_response.data[0].get('chat_id'):
            print(f"⚠️ Chat ID не найден для пользователя @{user_telegram}. Пользователь должен написать боту /start")
            return
        
        user_chat_id = student_response.data[0]['chat_id']
        print(f"📱 Отправляем уведомление пользователю @{user_telegram} (chat_id: {user_chat_id})")
        
    except Exception as e:
        print(f"❌ Ошибка получения chat_id: {e}")
        return
    
    # Сообщения для разных статусов
    status_messages = {
        'new': {
            'emoji': '🆕',
            'title': 'Новый заказ создан',
            'message': 'Ваш заказ принят в систему. Ожидается оплата.'
        },
        'pending_payment': {
            'emoji': '💳', 
            'title': 'Ожидается оплата',
            'message': 'Пожалуйста, произведите оплату согласно указанным реквизитам.'
        },
        'paid': {
            'emoji': '✅',
            'title': 'Оплата подтверждена', 
            'message': 'Спасибо за оплату! Ваш заказ принят в работу.'
        },
        'in_progress': {
            'emoji': '⚙️',
            'title': 'Работа началась',
            'message': 'Мы приступили к выполнению вашего заказа!'
        },
        'completed': {
            'emoji': '🎉',
            'title': 'Работа выполнена',
            'message': 'Ваш заказ готов! Файлы доступны для скачивания.'
        },
        'needs_revision': {
            'emoji': '🔄',
            'title': 'Требуются исправления',
            'message': 'Необходимы небольшие правки. Проверьте комментарии.'
        },
        'cancelled': {
            'emoji': '❌',
            'title': 'Заказ отменен',
            'message': 'Заказ был отменен. Если есть вопросы - обращайтесь в поддержку.'
        }
    }
    
    status_info = status_messages.get(new_status, {
        'emoji': '📝',
        'title': 'Статус обновлен',
        'message': f'Статус вашего заказа изменен на: {new_status}'
    })
    
    # Формируем красивое уведомление
    notification_text = f"""
{status_info['emoji']} <b>{status_info['title']}</b>

📝 <b>Заказ #{order['id']}:</b> {order['title']}
📚 <b>Предмет:</b> {order['subject']['name']}
⏰ <b>Дедлайн:</b> {order['deadline']}

💬 <b>Сообщение:</b>
{status_info['message']}
    """.strip()
    
    # Добавляем дополнительную информацию для некоторых статусов
    if new_status == 'completed':
        notification_text += "\n\n📱 Откройте приложение или воспользуйтесь кнопкой '📥 Скачать файлы' в меню бота для получения готовых файлов."
    elif new_status == 'needs_revision':
        if order.get('revision_comment'):
            notification_text += f"\n\n📋 <b>Комментарий:</b>\n{order['revision_comment']}"
    
    notification_text += "\n\n💬 Используйте меню бота для управления заказами"
    
    # Создаем reply keyboard для уведомления
    keyboard = {
        "keyboard": [
            [
                {"text": "📱 Открыть приложение", "web_app": {"url": f"https://bbifather.ru?telegram={user_telegram}"}},
            ],
            [
                {"text": "💬 Техподдержка"},
                {"text": "📥 Скачать файлы"}
            ]
        ],
        "resize_keyboard": True,
        "one_time_keyboard": False,
        "input_field_placeholder": "Выберите действие из меню ниже"
    }
    
    try:
        telegram_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        
        payload = {
            'chat_id': user_chat_id,  # Используем chat_id вместо username
            'text': notification_text,
            'parse_mode': 'HTML',
            'reply_markup': keyboard
        }
        
        response = requests.post(telegram_url, json=payload, timeout=10)
        
        if response.status_code == 200:
            print(f"✅ Уведомление о статусе '{new_status}' отправлено пользователю @{user_telegram}")
        else:
            print(f"⚠️ Не удалось отправить уведомление @{user_telegram}: {response.text}")
            
    except Exception as e:
        print(f"❌ Ошибка отправки уведомления пользователю @{user_telegram}: {e}")

# Старый startup удален - теперь используем lifespan

# API Routes
@app.get("/")
def read_root():
    return {"message": "Student Orders API is running"}

async def save_chat_id_handler(request: Request):
    """Общий обработчик для сохранения chat_id пользователя"""
    try:
        data = await request.json()
        telegram_username = data.get('telegram_username', '').lstrip('@')
        chat_id = data.get('chat_id')
        first_name = data.get('first_name', '')
        last_name = data.get('last_name', '')
        
        print(f"💾 Получен запрос на сохранение chat_id: @{telegram_username} -> {chat_id}")
        
        if not telegram_username or not chat_id:
            raise HTTPException(status_code=400, detail="Не указан telegram_username или chat_id")
        
        # Находим студента по telegram username
        student_response = supabase.table('students').select('id').eq('telegram', telegram_username).limit(1).execute()
        
        if student_response.data:
            # Обновляем существующего студента
            student_id = student_response.data[0]['id']
            supabase.table('students').update({
                'chat_id': str(chat_id),
                'name': first_name + (' ' + last_name if last_name else '')
            }).eq('id', student_id).execute()
            print(f"✅ Chat ID обновлен для студента @{telegram_username} (ID: {student_id})")
        else:
            # Создаем нового студента с chat_id (будет дополнен при создании заказа)
            supabase.table('students').insert({
                'telegram': telegram_username,
                'chat_id': str(chat_id),
                'name': first_name + (' ' + last_name if last_name else ''),
                'group_name': 'Не указана'  # Будет обновлено при создании заказа
            }).execute()
            print(f"✅ Создан новый студент @{telegram_username} с chat_id")
        
        return {"status": "success", "message": "Chat ID сохранен"}
        
    except Exception as e:
        print(f"❌ Ошибка сохранения chat_id: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения: {str(e)}")

@app.post("/api/save-chat-id")
async def save_chat_id_api(request: Request):
    """Сохранение chat_id пользователя для отправки уведомлений (с префиксом /api/)"""
    return await save_chat_id_handler(request)

@app.post("/save-chat-id")
async def save_chat_id_direct(request: Request):
    """Сохранение chat_id пользователя для отправки уведомлений (без префикса /api/)"""
    return await save_chat_id_handler(request)

# Students endpoints
@app.get("/api/students")
def get_students():
    try:
        response = supabase.table('students').select('*').order('created_at', desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения студентов: {str(e)}")

@app.post("/api/students")
def create_student(request: Request):
    pass  # Будет создаваться автоматически при создании заказа

# Subjects endpoints
@app.get("/api/subjects")
def get_subjects():
    try:
        response = supabase.table('subjects').select('*').eq('is_active', True).order('name').execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения предметов: {str(e)}")

# Orders endpoints
@app.get("/api/orders")
def get_orders(page: int = 1, limit: int = 10, telegram: str = None):
    try:
        print(f"📥 GET /api/orders - page: {page}, limit: {limit}, telegram: {telegram}")
        offset = (page - 1) * limit
        
        query = supabase.table('orders').select("""
            *,
            students!inner(id, name, group_name, telegram),
            subjects!inner(id, name, description, price)
        """)

        count_query = supabase.table('orders').select('id', count='exact', head=True)

        if telegram:
            clean_telegram = telegram.lstrip('@')
            print(f"🔍 Ищем заказы для пользователя: @{clean_telegram}")
            
            # 1. Найти студента по telegram
            student_response = supabase.table('students').select('id').eq('telegram', clean_telegram).limit(1).execute()
            print(f"👤 Поиск студента: {student_response}")
            
            if not student_response.data:
                # Если студент не найден, возвращаем пустой список
                print(f"❌ Студент @{clean_telegram} не найден в БД")
                return {"orders": [], "total": 0}
                
            student_id = student_response.data[0]['id']
            print(f"✅ Найден студент ID: {student_id}")
            
            # 2. Фильтровать заказы по student_id
            query = query.eq('student_id', student_id)
            count_query = count_query.eq('student_id', student_id)

        # Получаем заказы с пагинацией
        print(f"📊 Выполняем запрос заказов...")
        response = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        print(f"📦 Получено заказов: {len(response.data)}")
        
        # Получаем общее количество
        total_response = count_query.execute()
        total = total_response.count if total_response.count is not None else 0
        print(f"📈 Общее количество заказов: {total}")

        orders = []
        for order_data in response.data:
            # Преобразуем данные в нужный формат
            order = {
                **order_data,
                'student': {
                    'id': order_data['students']['id'],
                    'name': order_data['students']['name'],
                    'group': order_data['students']['group_name'],
                    'telegram': order_data['students']['telegram']
                },
                'subject': {
                    'id': order_data['subjects']['id'],
                    'name': order_data['subjects']['name'],
                    'description': order_data['subjects']['description'],
                    'price': order_data['subjects']['price']
                },
                'files': json.loads(order_data.get('files', '[]')) if isinstance(order_data.get('files'), str) else order_data.get('files', [])
            }
            del order['students']
            del order['subjects']
            orders.append(order)
        
        print(f"✅ Возвращаем {len(orders)} заказов")
        return {"orders": orders, "total": total}
        
    except Exception as e:
        print(f"❌ BACKEND: Ошибка получения заказов: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Ошибка на сервере при получении заказов: {str(e)}")

@app.get("/api/orders/{order_id}")
def get_order(order_id: int):
    try:
        response = supabase.table('orders').select("""
            *,
            students!inner(id, name, group_name, telegram),
            subjects!inner(id, name, description, price)
        """).eq('id', order_id).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Заказ не найден")
        
        order = response.data
        
        # Парсим файлы
        if order.get('files'):
            try:
                order['files'] = json.loads(order['files']) if isinstance(order['files'], str) else order['files']
            except:
                order['files'] = []
        else:
            order['files'] = []
        
        # Преобразуем связанные данные
        order['student'] = {
            'id': order['students']['id'],
            'name': order['students']['name'],
            'group': order['students']['group_name'],
            'telegram': order['students']['telegram']
        }
        order['subject'] = {
            'id': order['subjects']['id'],
            'name': order['subjects']['name'],
            'description': order['subjects']['description'],
            'price': order['subjects']['price']
        }
        
        # Удаляем вложенные объекты
        del order['students']
        del order['subjects']
        
        return order
        
    except Exception as e:
        if "No rows found" in str(e):
            raise HTTPException(status_code=404, detail="Заказ не найден")
        raise HTTPException(status_code=500, detail=f"Ошибка получения заказа: {str(e)}")

@app.post("/api/orders")
async def create_order(request: Request):
    data = await request.json()
    
    print("📥 Получены данные заказа:", json.dumps(data, indent=2, ensure_ascii=False))
    
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
        # Убираем @ из ника
        clean_telegram = student_data['telegram'].lstrip('@')
        print(f"👤 Обработка студента: @{clean_telegram}")
        
        # Проверяем существует ли студент
        existing_student = supabase.table('students').select('id').eq('telegram', clean_telegram).limit(1).execute()
        print(f"🔍 Поиск существующего студента: {existing_student}")
        
        if existing_student.data and len(existing_student.data) > 0:
            student_id = existing_student.data[0]['id']
            print(f"👤 Найден существующий студент ID: {student_id}")
            # Обновляем данные студента
            update_result = supabase.table('students').update({
                'name': student_data['name'],
                'group_name': student_data['group']
            }).eq('id', student_id).execute()
            print(f"📝 Обновление данных студента: {update_result}")
        else:
            # Создаем нового студента
            print(f"➕ Создаем нового студента: {student_data}")
            new_student = supabase.table('students').insert({
                'name': student_data['name'],
                'group_name': student_data['group'],
                'telegram': clean_telegram
            }).execute()
            print(f"✅ Результат создания студента: {new_student}")
            student_id = new_student.data[0]['id']
            print(f"👤 Создан новый студент ID: {student_id}")
        
        # Проверяем существование предмета
        subject_id = int(data['subject_id'])
        subject = supabase.table('subjects').select('id, name').eq('id', subject_id).limit(1).execute()
        
        if not subject.data or len(subject.data) == 0:
            raise HTTPException(status_code=400, detail=f"Предмет с ID {subject_id} не найден")
        
        print(f"📚 Предмет: {subject.data[0]['name']} (ID: {subject_id})")
        
        # Подготавливаем данные заказа
        actual_price = data.get('actual_price', 0.0)
        selected_works_json = json.dumps(data.get('selected_works', [])) if data.get('selected_works') else None
        is_full_course = data.get('is_full_course', False)
        
        print(f"💰 Стоимость заказа: {actual_price} ₽")
        
        # Создаем заказ
        order_data = {
            'student_id': student_id,
            'subject_id': subject_id,
            'title': data['title'],
            'description': data.get('description', ''),
            'input_data': data.get('input_data', ''),
            'variant_info': data.get('variant_info', ''),
            'deadline': data['deadline'],
            'selected_works': selected_works_json,
            'is_full_course': is_full_course,
            'actual_price': actual_price,
            'status': 'new'
        }
        print(f"📝 Создаем заказ с данными: {order_data}")
        
        new_order = supabase.table('orders').insert(order_data).execute()
        print(f"✅ Результат создания заказа: {new_order}")
        
        order_id = new_order.data[0]['id']
        print(f"📝 Создан заказ ID: {order_id}")
        
        # Получаем созданный заказ с связанными данными
        print(f"🔍 Получаем созданный заказ...")
        created_order = get_order(order_id)
        print(f"📦 Получен заказ: {created_order}")
        
        # Отправляем уведомление администратору о новом заказе
        try:
            message = f"""
🆕 Новый заказ #{order_id}

👤 Студент: {created_order['student']['name']}
👥 Группа: {created_order['student']['group']}
📱 Telegram: {created_order['student']['telegram']}

📚 Предмет: {created_order['subject']['name']}
📝 Название: {created_order['title']}
📄 Описание: {created_order['description'][:200]}{'...' if len(created_order['description']) > 200 else ''}

⏰ Дедлайн: {created_order['deadline']}
💰 Стоимость: {actual_price} ₽

Создан: {datetime.now().strftime('%d.%m.%Y %H:%M')}
            """.strip()
            
            if created_order.get('variant_info'):
                message += f"\n\n🔢 Информация о варианте:\n{created_order['variant_info'][:300]}{'...' if len(created_order['variant_info']) > 300 else ''}"
            
            if created_order.get('input_data'):
                message += f"\n\n📋 Дополнительные требования:\n{created_order['input_data'][:300]}{'...' if len(created_order['input_data']) > 300 else ''}"
            
            send_notification(message)
        except Exception as e:
            print(f"⚠️ Ошибка отправки уведомления администратору: {e}")
        
        # Отправляем уведомление пользователю о создании заказа
        try:
            await send_status_notification_to_user(created_order, 'new')
        except Exception as e:
            print(f"⚠️ Ошибка отправки уведомления пользователю: {e}")
        
        return created_order
        
    except Exception as e:
        print(f"❌ Ошибка создания заказа: {e}")
        if "No rows found" in str(e):
            # Студент не найден, но это нормально
            pass
        else:
            raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/orders/{order_id}/status")
async def update_order_status(order_id: int, request: Request):
    data = await request.json()
    status = data['status']
    
    try:
        # Получаем старый заказ для сравнения
        old_order = get_order(order_id)
        
        # Обновляем статус заказа
        response = supabase.table('orders').update({
            'status': status,
            'updated_at': datetime.now().isoformat()
        }).eq('id', order_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Заказ не найден")
        
        # Получаем обновленный заказ
        updated_order = get_order(order_id)
        
        # Отправляем уведомление пользователю о изменении статуса
        if old_order['status'] != status and updated_order['student'].get('telegram'):
            await send_status_notification_to_user(updated_order, status)
        
        return updated_order
        
    except Exception as e:
        if "No rows found" in str(e):
            raise HTTPException(status_code=404, detail="Заказ не найден")
        raise HTTPException(status_code=500, detail=f"Ошибка обновления статуса: {str(e)}")

@app.patch("/api/orders/{order_id}/paid")
def mark_order_as_paid(order_id: int):
    try:
        # Обновляем статус оплаты
        response = supabase.table('orders').update({
            'is_paid': True,
            'updated_at': datetime.now().isoformat()
        }).eq('id', order_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Заказ не найден")
        
        return get_order(order_id)
        
    except Exception as e:
        if "No rows found" in str(e):
            raise HTTPException(status_code=404, detail="Заказ не найден")
        raise HTTPException(status_code=500, detail=f"Ошибка обновления оплаты: {str(e)}")

@app.post("/api/orders/{order_id}/files")
async def upload_order_files(order_id: int, files: list[UploadFile] = File(...)):
    try:
        # Проверяем существование заказа
        order_check = supabase.table('orders').select('id, title, status').eq('id', order_id).single().execute()
        if not order_check.data:
            raise HTTPException(status_code=404, detail="Заказ не найден")
        
        # Создаем папку для файлов заказа
        upload_dir = os.path.join(UPLOADS_DIR, f"order_{order_id}")
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
        supabase.table('orders').update({
            'files': json.dumps(saved_files),
            'status': 'completed',
            'updated_at': datetime.now().isoformat()
        }).eq('id', order_id).execute()
        
        print(f"📎 Файлы добавлены к заказу {order_id}: {saved_files}")
        
        # Получаем обновленный заказ и отправляем уведомление пользователю
        updated_order = get_order(order_id)
        await send_status_notification_to_user(updated_order, 'completed')
        
        return updated_order
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки файлов: {str(e)}")

@app.get("/api/orders/{order_id}/download/{filename}")
async def download_file(order_id: int, filename: str):
    """Скачивание файла по заказу"""
    try:
        # Проверяем существование заказа и файлов
        order = supabase.table('orders').select('files').eq('id', order_id).single().execute()
        
        if not order.data:
            raise HTTPException(status_code=404, detail="Заказ не найден")
        
        files_json = order.data.get('files')
        if not files_json:
            raise HTTPException(status_code=404, detail="Файлы не найдены")
        
        try:
            files = json.loads(files_json) if isinstance(files_json, str) else files_json
        except:
            files = []
        
        if filename not in files:
            raise HTTPException(status_code=404, detail="Файл не найден")
        
        # Путь к файлу
        file_path = os.path.join(UPLOADS_DIR, f"order_{order_id}", filename)
        
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
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка скачивания файла: {str(e)}")

@app.get("/api/orders/{order_id}/download-all")
async def download_all_files(order_id: int):
    """Скачивание всех файлов заказа в zip архиве"""
    try:
        # Проверяем существование заказа и файлов
        order = supabase.table('orders').select('files, title').eq('id', order_id).single().execute()
        
        if not order.data:
            raise HTTPException(status_code=404, detail="Заказ не найден")
        
        files_json = order.data.get('files')
        order_title = order.data.get('title', 'Заказ')
        
        if not files_json:
            raise HTTPException(status_code=404, detail="Файлы не найдены")
        
        try:
            files = json.loads(files_json) if isinstance(files_json, str) else files_json
        except:
            files = []
        
        if not files:
            raise HTTPException(status_code=404, detail="Нет файлов для скачивания")
        
        # Создаем временный zip файл
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_zip:
            with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for filename in files:
                    file_path = os.path.join(UPLOADS_DIR, f"order_{order_id}", filename)
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
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка архивирования файлов: {str(e)}")

@app.post("/api/orders/{order_id}/payment-notification")
async def notify_payment(order_id: int):
    """Уведомление администратора об оплате заказа студентом"""
    try:
        # Получаем информацию о заказе
        order = get_order(order_id)
        
        # Отправляем уведомление в Telegram
        message = f"""
💰 Студент отметил оплату!

📝 Заказ #{order['id']}: {order['title']}
👤 Студент: {order['student']['name']}
👥 Группа: {order['student']['group']}
📱 Telegram: {order['student']['telegram']}

📚 Предмет: {order['subject']['name']}
📄 Описание: {order['description'][:200]}{'...' if len(order['description']) > 200 else ''}
⏰ Дедлайн: {order['deadline']}
💰 Сумма: {order.get('actual_price', order['subject']['price'])} ₽
        """.strip()
        
        if order.get('variant_info'):
            message += f"\n\n🔢 Информация о варианте:\n{order['variant_info'][:300]}{'...' if len(order['variant_info']) > 300 else ''}"
        
        if order.get('input_data'):
            message += f"\n\n📋 Дополнительные требования:\n{order['input_data'][:300]}{'...' if len(order['input_data']) > 300 else ''}"
        
        message += f"\n\n⚠️ Проверьте поступление средств и обновите статус заказа!"
        message += f"\n\nУведомление: {datetime.now().strftime('%d.%m.%Y %H:%M')}"
        
        send_notification(message)
        print(f"💰 Отправлено уведомление об оплате заказа #{order_id}")
        
        # Отправляем уведомление пользователю о получении заявки на оплату
        try:
            user_telegram = order['student']['telegram']
            
            # Получаем chat_id пользователя из БД
            student_response = supabase.table('students').select('chat_id').eq('telegram', user_telegram).limit(1).execute()
            
            if student_response.data and student_response.data[0].get('chat_id'):
                user_chat_id = student_response.data[0]['chat_id']
                
                notification_text = f"""
💳 <b>Заявка на оплату получена</b>

📝 <b>Заказ #{order['id']}:</b> {order['title']}
📚 <b>Предмет:</b> {order['subject']['name']}
💰 <b>Сумма:</b> {order.get('actual_price', order['subject']['price'])} ₽

💬 <b>Сообщение:</b>
Ваша заявка на оплату получена и проверяется администратором. После подтверждения оплаты статус заказа будет обновлен.

Обычно проверка занимает от 15 минут до нескольких часов.
                """.strip()
                
                # Создаем reply keyboard
                keyboard = {
                    "keyboard": [
                        [
                            {"text": "📱 Открыть приложение", "web_app": {"url": f"https://bbifather.ru?telegram={user_telegram}"}},
                        ],
                        [
                            {"text": "💬 Техподдержка"},
                            {"text": "📋 Правила"}
                        ]
                    ],
                    "resize_keyboard": True,
                    "one_time_keyboard": False,
                    "input_field_placeholder": "Выберите действие из меню ниже"
                }
                
                telegram_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
                payload = {
                    'chat_id': user_chat_id,  # Используем chat_id
                    'text': notification_text,
                    'parse_mode': 'HTML',
                    'reply_markup': keyboard
                }
                
                response = requests.post(telegram_url, json=payload, timeout=10)
                
                if response.status_code == 200:
                    print(f"✅ Уведомление о заявке на оплату отправлено пользователю @{user_telegram}")
                else:
                    print(f"⚠️ Не удалось отправить уведомление @{user_telegram}: {response.text}")
            else:
                print(f"⚠️ Chat ID не найден для пользователя @{user_telegram}")
                
        except Exception as e:
            print(f"❌ Ошибка отправки уведомления пользователю: {e}")
        
        return {"status": "notification_sent", "order_id": order_id}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка отправки уведомления об оплате: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка отправки уведомления: {str(e)}")

@app.post("/api/orders/{order_id}/request-revision")
async def request_order_revision(order_id: int, request: Request):
    """Запрос исправлений для заказа"""
    data = await request.json()
    comment = data.get('comment', '')
    grade = data.get('grade')
    
    try:
        # Обновляем заказ на статус "требуют исправления"
        response = supabase.table('orders').update({
            'status': 'needs_revision',
            'revision_comment': comment,
            'revision_grade': grade,
            'updated_at': datetime.now().isoformat()
        }).eq('id', order_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Заказ не найден")
        
        # Получаем информацию о заказе для уведомления
        order = get_order(order_id)
        
        # Отправляем уведомление админу о необходимости исправлений
        message = f"""
🔄 Запрошены исправления для заказа #{order_id}

📝 Заказ: {order['title']}
👤 Студент: {order['student']['name']}
👥 Группа: {order['student']['group']}
📱 Telegram: {order['student']['telegram']}
📚 Предмет: {order['subject']['name']}
⏰ Дедлайн: {order['deadline']}

💬 Комментарий к исправлениям:
{comment[:500]}{'...' if len(comment) > 500 else ''}
        """.strip()
        
        if grade:
            message += f"\n\n⭐ Оценка из Moodle: {grade}"
        
        message += f"\n\nЗапрос отправлен: {datetime.now().strftime('%d.%m.%Y %H:%M')}"
        
        send_notification(message)
        print(f"🔄 Отправлено уведомление о запросе исправлений для заказа #{order_id}")
        
        # Отправляем уведомление пользователю о необходимости исправлений
        updated_order = get_order(order_id)
        await send_status_notification_to_user(updated_order, 'needs_revision')
        
        # Возвращаем обновленный заказ
        return updated_order
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка отправки уведомления о исправлениях: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка запроса исправлений: {str(e)}")

@app.post("/api/test-notification")
async def test_notification():
    """Тестовая отправка уведомления"""
    try:
        message = f"""
🧪 Тестовое уведомление

📅 Время: {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}
🚀 Backend работает корректно
📱 Telegram уведомления настроены
        """.strip()
        
        send_notification(message)
        return {"status": "success", "message": "Тестовое уведомление отправлено"}
    except Exception as e:
        print(f"❌ Тест не прошел: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)