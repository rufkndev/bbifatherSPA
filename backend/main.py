import json
import html
import os
import shutil
import zipfile
import tempfile
import time
from datetime import datetime, timedelta
import urllib.parse
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
import requests
from supabase import create_client, Client
from dotenv import load_dotenv
from contextlib import asynccontextmanager

# Загружаем переменные из .env файла
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=env_path, override=True)
print(f"🔧 Загружен .env из: {env_path}")
print(f"🔧 Файл существует: {os.path.exists(env_path)}")

# Функция для инициализации при запуске
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    if init_database():
        print("🚀 Backend запущен с Supabase!")
    else:
        print("⚠️ Backend запущен без подключения к БД!")
    
    if BOT_TOKEN and (BOT_CHAT_ID or ADMIN_CHAT_IDS):
        print("📱 Telegram уведомления настроены")
        print(f"🔧 BOT_CHAT_ID: {BOT_CHAT_ID}")
        print(f"🔧 ADMIN_CHAT_IDS: {ADMIN_CHAT_IDS}")
        print(f"🔧 Raw TELEGRAM_ADMIN_CHAT_IDS: {os.getenv('TELEGRAM_ADMIN_CHAT_IDS', 'НЕ ЗАДАНО')}")
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
# Дополнительные админские чаты (через запятую)
_raw_admin_ids = os.getenv("TELEGRAM_ADMIN_CHAT_IDS", "")
print(f"🔧 DEBUG: TELEGRAM_ADMIN_CHAT_IDS raw value: '{_raw_admin_ids}'")
ADMIN_CHAT_IDS = [cid.strip() for cid in _raw_admin_ids.split(",") if cid.strip()]
print(f"🔧 DEBUG: ADMIN_CHAT_IDS parsed: {ADMIN_CHAT_IDS}")
EXECUTOR_CHAT_IDS = ["814032949", "862151461", "5648974088"]

# URL для публичного доступа к файлам (для Telegram Bot API)
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "https://bbifather.ru")
WEB_APP_URL = os.getenv("WEB_APP_URL", "https://bbifather.ru")

print(f"🔗 PUBLIC_BASE_URL: {PUBLIC_BASE_URL}")

def build_web_app_url(telegram_username: Optional[str] = None) -> str:
    """Генерирует URL мини-аппа с параметрами пользователя."""
    base_url = WEB_APP_URL.rstrip("/")
    params = {"source": "telegram_notification"}
    if telegram_username:
        params["telegram"] = telegram_username.lstrip("@")
    return f"{base_url}?{urllib.parse.urlencode(params)}"

def build_main_reply_keyboard(telegram_username: Optional[str] = None) -> dict:
    """Единая клавиатура бота: только актуальные кнопки."""
    return {
        "keyboard": [
            [
                {"text": "📱 Открыть мини-апп", "web_app": {"url": build_web_app_url(telegram_username)}},
            ],
            [
                {"text": "💬 Техподдержка"},
                {"text": "📋 Правила"}
            ],
            [
                {"text": "❓ Как пользоваться сервисом?"}
            ]
        ],
        "resize_keyboard": True,
        "one_time_keyboard": False,
        "input_field_placeholder": "Выберите действие из меню ниже"
    }

def post_telegram(method: str, payload: dict, retries: int = 3, timeout: int = 10) -> Optional[requests.Response]:
    """Отправляет запрос в Telegram API с retry для временных ошибок."""
    if not BOT_TOKEN:
        return None

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    last_response = None

    for attempt in range(retries):
        try:
            response = requests.post(url, json=payload, timeout=timeout)
            last_response = response

            # Успех
            if response.status_code == 200:
                return response

            # Временные ошибки Telegram/сети
            if response.status_code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                wait_seconds = 1.5 * (attempt + 1)
                time.sleep(wait_seconds)
                continue

            return response
        except requests.RequestException as e:
            print(f"⚠️ Ошибка запроса к Telegram API (попытка {attempt + 1}/{retries}): {e}")
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
            else:
                return last_response

    return last_response

# Разрешённые статусы заказов (основные)
ALLOWED_ORDER_STATUSES = {
    'new',
    'waiting_payment',
    'paid',
    'in_progress',
    'needs_revision',
    'completed',
}

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
    """Отправка уведомления администратору(ам) в Telegram"""
    if not BOT_TOKEN or (not BOT_CHAT_ID and not ADMIN_CHAT_IDS):
        print("⚠️ Telegram бот не настроен")
        print(f"📱 УВЕДОМЛЕНИЕ: {message}")
        return

    try:
        targets: List[str] = []
        
        print(f"🔍 BOT_CHAT_ID: {BOT_CHAT_ID} (тип: {type(BOT_CHAT_ID).__name__})")
        print(f"🔍 ADMIN_CHAT_IDS: {ADMIN_CHAT_IDS} (длина: {len(ADMIN_CHAT_IDS)})")
        
        if BOT_CHAT_ID:
            targets.append(BOT_CHAT_ID)
            print(f"  ➕ Добавлен BOT_CHAT_ID: {BOT_CHAT_ID}")
        if ADMIN_CHAT_IDS:
            targets.extend(ADMIN_CHAT_IDS)
            print(f"  ➕ Добавлены ADMIN_CHAT_IDS: {ADMIN_CHAT_IDS}")

        print(f"📣 Админ-цели для уведомления: {targets}")

        success_any = False
        for chat_id in list(dict.fromkeys(targets)):
            payload = {
                'chat_id': chat_id,
                'text': message,
                'parse_mode': 'HTML'
            }
            response = post_telegram("sendMessage", payload)
            if response is None:
                print("❌ BOT_TOKEN не настроен, отправка невозможна")
                continue
            if response.status_code == 200:
                success_any = True
                print(f"✅ Уведомление отправлено администратору {chat_id}")
            else:
                print(f"❌ Ошибка Telegram API для {chat_id}: {response.text}")

        if not success_any:
            print("⚠️ Не удалось отправить сообщение ни одному администратору")
    except Exception as e:
        print(f"❌ Ошибка отправки в Telegram: {e}")
        print(f"📱 УВЕДОМЛЕНИЕ: {message}")

def send_executor_notification(message: str):
    """Отправка уведомления исполнителям о новом заказе"""
    if not BOT_TOKEN or not EXECUTOR_CHAT_IDS:
        print("⚠️ Telegram бот не настроен для уведомлений исполнителей")
        print(f"📱 УВЕДОМЛЕНИЕ: {message}")
        return

    try:
        for chat_id in list(dict.fromkeys(EXECUTOR_CHAT_IDS)):
            payload = {
                'chat_id': chat_id,
                'text': message,
                'parse_mode': 'HTML'
            }
            response = post_telegram("sendMessage", payload)
            if response is None:
                print("❌ BOT_TOKEN не настроен, отправка невозможна")
                continue
            if response.status_code == 200:
                print(f"✅ Уведомление исполнителю отправлено: {chat_id}")
            else:
                print(f"❌ Ошибка Telegram API для {chat_id}: {response.text}")
    except Exception as e:
        print(f"❌ Ошибка отправки исполнителям в Telegram: {e}")
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
    
    # Получаем chat_id пользователя из БД (или fallback на @username)
    notification_target = None
    try:
        student_response = supabase.table('students').select('chat_id').eq('telegram', user_telegram).limit(1).execute()

        if student_response.data and student_response.data[0].get('chat_id'):
            notification_target = student_response.data[0]['chat_id']
            print(f"📱 Отправляем уведомление пользователю @{user_telegram} (chat_id: {notification_target})")
        else:
            # Пытаемся отправить по username, чтобы не терять уведомление
            notification_target = f"@{user_telegram}"
            print(f"⚠️ Chat ID не найден для @{user_telegram}, fallback на username")

    except Exception as e:
        print(f"❌ Ошибка получения chat_id: {e}")
        notification_target = f"@{user_telegram}"
    
    # Сообщения для разных статусов
    status_messages = {
        'new': {
            'emoji': '🆕',
            'title': 'Заказ создан',
            'message': 'Заказ принят в систему и готов к дальнейшей обработке.'
        },
        'waiting_payment': {
            'emoji': '💳',
            'title': 'Ожидается оплата',
            'message': 'Пожалуйста, произведите оплату по указанным реквизитам.'
        },
        'paid': {
            'emoji': '✅',
            'title': 'Оплата подтверждена',
            'message': 'Спасибо за оплату! Заказ передан в работу.'
        },
        'in_progress': {
            'emoji': '⚙️',
            'title': 'Заказ в работе',
            'message': 'Мы приступили к выполнению вашего заказа.'
        },
        'completed': {
            'emoji': '🎉',
            'title': 'Заказ выполнен',
            'message': 'Работа готова. Файлы доступны для скачивания.'
        },
        'needs_revision': {
            'emoji': '🔄',
            'title': 'Нужны исправления',
            'message': 'Запрошены исправления. Ознакомьтесь с комментариями.'
        },
        'queued': {
            'emoji': '🕒',
            'title': 'Заказ в очереди',
            'message': 'Заказ поставлен в очередь на выполнение.'
        },
        'under_review': {
            'emoji': '👀',
            'title': 'Заказ на рассмотрении',
            'message': 'Администратор проверяет информацию по заказу.'
        },
        'cancelled': {
            'emoji': '❌',
            'title': 'Заказ отменен',
            'message': 'Если есть вопросы, обратитесь в техподдержку.'
        }
    }
    
    status_info = status_messages.get(new_status, {
        'emoji': '📝',
        'title': 'Статус обновлен',
        'message': f'Статус вашего заказа изменен на: {new_status}'
    })

    status_labels = {
        'new': 'Новый',
        'waiting_payment': 'Ожидание оплаты',
        'paid': 'Оплачен',
        'in_progress': 'В работе',
        'completed': 'Выполнен',
        'needs_revision': 'Нужны исправления',
        'queued': 'В очереди',
        'under_review': 'На рассмотрении',
        'cancelled': 'Отменен'
    }
    
    # Формируем красивое уведомление
    status_label = status_labels.get(new_status, new_status)
    price_value = order.get('actual_price')
    price_line = f"\n💰 <b>Стоимость:</b> {price_value} ₽" if isinstance(price_value, (int, float)) and price_value > 0 else ""

    safe_title = html.escape(str(order.get('title', 'Без названия')))
    safe_subject = html.escape(str(order.get('subject', {}).get('name', 'Не указан')))
    safe_deadline = html.escape(str(order.get('deadline', 'Не указан')))

    notification_text = f"""
{status_info['emoji']} <b>{status_info['title']}</b>

📝 <b>Заказ №{order['id']}</b>
📌 <b>Тема:</b> {safe_title}
📚 <b>Предмет:</b> {safe_subject}
⏰ <b>Дедлайн:</b> {safe_deadline}
🔄 <b>Статус:</b> {status_label}{price_line}

{status_info['message']}
    """.strip()
    
    # Добавляем дополнительную информацию для некоторых статусов
    if new_status == 'completed':
        notification_text += "\n\n📱 Откройте приложение для получения готовых файлов."
    elif new_status == 'needs_revision':
        if order.get('revision_comment'):
            notification_text += f"\n\n📋 <b>Комментарий:</b>\n{html.escape(str(order['revision_comment']))}"
    
    notification_text += "\n\n💬 Используйте меню бота для управления заказами"
    
    keyboard = build_main_reply_keyboard(user_telegram)
    
    try:
        payload = {
            'chat_id': notification_target,
            'text': notification_text,
            'parse_mode': 'HTML',
            'reply_markup': keyboard
        }

        response = post_telegram("sendMessage", payload)
        if response is None:
            print("❌ Не удалось отправить уведомление: Telegram не настроен")
            return

        if response.status_code == 200:
            print(f"✅ Уведомление о статусе '{new_status}' отправлено пользователю @{user_telegram}")
        else:
            print(f"⚠️ Не удалось отправить уведомление @{user_telegram}: {response.text}")
            
    except Exception as e:
        print(f"❌ Ошибка отправки уведомления пользователю @{user_telegram}: {e}")

def notify_executors_board_entry(order: dict):
    """Уведомление исполнителей, когда заказ попадает/возвращается на доску."""
    try:
        if not order:
            return

        status = order.get('status')
        if status not in ('paid', 'needs_revision'):
            return

        subject_name = html.escape(str(order.get('subject', {}).get('name', 'Не указан')))
        title = html.escape(str(order.get('title', 'Без названия')))
        deadline = html.escape(str(order.get('deadline', 'Не указан')))
        short_description = str(order.get('description', '') or '')
        safe_short_description = html.escape(short_description[:160])
        if len(short_description) > 160:
            safe_short_description += "..."

        if status == 'needs_revision':
            revision_comment = str(order.get('revision_comment', '') or '').strip()
            revision_grade = str(order.get('revision_grade', '') or '').strip()
            revision_comment_safe = html.escape(revision_comment[:500]) if revision_comment else "Не указан"
            if revision_comment and len(revision_comment) > 500:
                revision_comment_safe += "..."
            revision_grade_safe = html.escape(revision_grade) if revision_grade else "Не указана"

            executor_message = f"""
🔄 <b>Заказ вернулся на доску (нужны исправления)</b>

📝 <b>Заказ №{order['id']}</b>
📌 <b>Тема:</b> {title}
📚 <b>Предмет:</b> {subject_name}
⏰ <b>Дедлайн:</b> {deadline}
💬 <b>Кратко:</b> {safe_short_description}
📋 <b>Комментарий на исправление:</b>
{revision_comment_safe}
⭐ <b>Оценка из Moodle:</b> {revision_grade_safe}
            """.strip()
        else:
            executor_message = f"""
✅ <b>Оплаченный заказ появился на доске</b>

📝 <b>Заказ №{order['id']}</b>
📌 <b>Тема:</b> {title}
📚 <b>Предмет:</b> {subject_name}
⏰ <b>Дедлайн:</b> {deadline}
💬 <b>Кратко:</b> {safe_short_description}
        """.strip()

        send_executor_notification(executor_message)
    except Exception as e:
        print(f"⚠️ Ошибка отправки уведомления исполнителям: {e}")

def force_refresh_all_user_keyboards() -> dict:
    """Принудительно отправляет всем пользователям актуальную клавиатуру."""
    if not BOT_TOKEN:
        return {"status": "skipped", "reason": "BOT_TOKEN не настроен"}
    if not supabase:
        return {"status": "skipped", "reason": "Supabase не настроен"}

    try:
        students_response = supabase.table('students').select('id, telegram, chat_id').execute()
        students = students_response.data or []
    except Exception as e:
        return {"status": "error", "reason": f"Ошибка чтения студентов: {e}"}

    targets = []
    for student in students:
        chat_id = str(student.get('chat_id', '')).strip()
        if chat_id:
            targets.append({
                "student_id": student.get("id"),
                "chat_id": chat_id,
                "telegram": (student.get('telegram') or '').strip()
            })

    sent = 0
    failed = 0
    blocked = 0
    blocked_student_ids: List[int] = []
    unique_targets = {}
    for target in targets:
        unique_targets[target["chat_id"]] = target

    for target in unique_targets.values():
        telegram_username = target["telegram"] or None
        payload = {
            "chat_id": target["chat_id"],
            "text": (
                "♻️ Бот обновлён.\n\n"
                "Ниже отображается актуальное меню с кнопкой открытия мини-аппа."
            ),
            "parse_mode": "HTML",
            "reply_markup": build_main_reply_keyboard(telegram_username)
        }
        response = post_telegram("sendMessage", payload)
        if response is not None and response.status_code == 200:
            sent += 1
        else:
            if response is not None and response.status_code == 403 and "blocked by the user" in response.text.lower():
                blocked += 1
                student_id = target.get("student_id")
                if isinstance(student_id, int):
                    blocked_student_ids.append(student_id)
            else:
                failed += 1
                if response is not None:
                    print(f"⚠️ Не удалось обновить клавиатуру для {target['chat_id']}: {response.text}")
        # Мягкое троттлирование, чтобы снизить риск 429 при массовой рассылке
        time.sleep(0.06)

    # Очищаем chat_id у пользователей, которые заблокировали бота,
    # чтобы не пытаться отправлять им массовые обновления в будущем.
    if blocked_student_ids:
        try:
            for student_id in list(dict.fromkeys(blocked_student_ids)):
                supabase.table('students').update({'chat_id': None}).eq('id', student_id).execute()
            print(f"🧹 Очищены chat_id у {len(set(blocked_student_ids))} пользователей, заблокировавших бота")
        except Exception as e:
            print(f"⚠️ Не удалось очистить chat_id заблокированных пользователей: {e}")

    return {
        "status": "completed",
        "total_targets": len(unique_targets),
        "sent": sent,
        "failed": failed,
        "blocked": blocked
    }

# Старый startup удален - теперь используем lifespan

# API Routes
@app.get("/")
def read_root():
    return {"message": "Student Orders API is running"}

@app.post("/api/bot/force-refresh-keyboards")
async def force_refresh_keyboards():
    """Принудительное обновление клавиатуры для всех пользователей."""
    result = force_refresh_all_user_keyboards()
    return result

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

async def try_direct_file_upload(file_info, file_name: str, order_id: int, user_chat_id: str, send_document_url: str) -> bool:
    """Попытка прямой отправки файла в Telegram с проверкой размера"""
    try:
        print(f"🔄 Пробуем альтернативный метод для {file_name}")
        
        if isinstance(file_info, str):
            # Файл на локальном сервере
            local_file_path = os.path.join(UPLOADS_DIR, f"order_{order_id}", file_name)
            print(f"📁 Ищем локальный файл: {local_file_path}")
            
            if os.path.exists(local_file_path):
                # Проверяем размер файла (Telegram лимит 50MB)
                file_size = os.path.getsize(local_file_path)
                max_size = 50 * 1024 * 1024  # 50MB в байтах
                
                if file_size > max_size:
                    print(f"⚠️ Файл {file_name} слишком большой ({file_size / 1024 / 1024:.1f}MB) для Telegram (лимит 50MB)")
                    return False
                
                print(f"📎 Отправляем файл напрямую: {file_name} ({file_size / 1024 / 1024:.1f}MB)")
                
                with open(local_file_path, 'rb') as file_data:
                    files = {'document': (file_name, file_data)}
                    data = {
                        'chat_id': user_chat_id,
                        'caption': f"📎 {file_name} ({file_size / 1024 / 1024:.1f}MB)"
                    }
                    response = requests.post(send_document_url, files=files, data=data, timeout=90)
                    
                    if response.status_code == 200:
                        print(f"✅ Файл {file_name} отправлен напрямую")
                        return True
                    else:
                        print(f"❌ Ошибка прямой отправки файла {file_name}: {response.text}")
                        return False
            else:
                print(f"❌ Локальный файл не найден: {local_file_path}")
                return False
        else:
            print(f"❌ Альтернативный метод не поддерживается для URL-файлов")
            return False
            
    except Exception as e:
        print(f"❌ Ошибка альтернативного метода для {file_name}: {e}")
        return False

async def send_files_to_telegram_handler(request: Request):
    """Общий обработчик для отправки файлов заказа в Telegram"""
    try:
        data = await request.json()
        order_id = data.get('order_id')
        telegram_username = data.get('telegram', '').lstrip('@')
        
        print(f"📁 Запрос на отправку файлов заказа #{order_id} для @{telegram_username}")
        
        if not order_id or not telegram_username:
            raise HTTPException(status_code=400, detail="Не указан order_id или telegram")
        
        # Получаем заказ с файлами
        order = get_order(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Заказ не найден")
        
        # Проверяем что заказ принадлежит пользователю
        if order['student']['telegram'] != telegram_username:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
        
        # Проверяем что у заказа есть файлы
        files = order.get('files', [])
        if not files:
            raise HTTPException(status_code=404, detail="У заказа нет файлов")
        
        print(f"📋 Структура файлов заказа #{order_id}:")
        print(f"   Тип: {type(files)}")
        print(f"   Содержимое: {files}")
        for i, file_info in enumerate(files):
            print(f"   Файл {i}: {type(file_info)} = {file_info}")
        
        # Получаем chat_id пользователя
        student_response = supabase.table('students').select('chat_id').eq('telegram', telegram_username).limit(1).execute()
        
        if not student_response.data or not student_response.data[0].get('chat_id'):
            raise HTTPException(status_code=404, detail="Chat ID не найден. Напишите боту /start")
        
        user_chat_id = student_response.data[0]['chat_id']
        print(f"📱 Отправляем файлы пользователю с chat_id: {user_chat_id}")
        
        # Отправляем сообщение с информацией о заказе
        intro_message = f"""
📁 <b>Файлы заказа #{order_id}</b>

📝 <b>Название:</b> {order['title']}
📚 <b>Предмет:</b> {order['subject']['name']}
📊 <b>Статус:</b> {order['status']}

📎 Отправляю файлы ({len(files)} шт.):
        """.strip()
        
        telegram_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        intro_payload = {
            'chat_id': user_chat_id,
            'text': intro_message,
            'parse_mode': 'HTML'
        }
        
        requests.post(telegram_url, json=intro_payload, timeout=10)
        
        # Отправляем каждый файл
        sent_count = 0
        skipped_large_files = []
        failed_files = []
        
        for file_info in files:
            file_name = "unknown_file"  # Инициализируем переменную для безопасности
            try:
                # Определяем структуру файла (может быть строка или словарь)
                if isinstance(file_info, str):
                    # Если file_info это строка, то это имя файла
                    file_name = file_info
                    # Создаем URL для файла на основе имени (кодируем для безопасности)
                    encoded_name = urllib.parse.quote(file_name)
                    file_url = f"{PUBLIC_BASE_URL}/api/orders/{order_id}/download/{encoded_name}"
                elif isinstance(file_info, dict):
                    # Если file_info это словарь, извлекаем URL и имя
                    file_url = file_info.get('url')
                    file_name = file_info.get('name', 'file')
                else:
                    print(f"⚠️ Неизвестный тип файла: {type(file_info)}")
                    failed_files.append(file_name)
                    continue
                
                if not file_name:
                    print(f"❌ Пустое имя файла: {file_info}")
                    failed_files.append("unnamed_file")
                    continue
                
                # Проверяем размер файла перед отправкой
                if isinstance(file_info, str):
                    local_file_path = os.path.join(UPLOADS_DIR, f"order_{order_id}", file_name)
                    if os.path.exists(local_file_path):
                        file_size = os.path.getsize(local_file_path)
                        max_size = 50 * 1024 * 1024  # 50MB
                        
                        if file_size > max_size:
                            print(f"⚠️ Файл {file_name} слишком большой ({file_size / 1024 / 1024:.1f}MB) для Telegram")
                            skipped_large_files.append(f"{file_name} ({file_size / 1024 / 1024:.1f}MB)")
                            continue
                
                print(f"📎 Отправляем файл: {file_name}")
                
                send_document_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendDocument"
                success = False
                
                # Для строк (локальные файлы) сразу пробуем прямую отправку
                if isinstance(file_info, str):
                    print(f"📁 Локальный файл, пробуем прямую отправку")
                    success = await try_direct_file_upload(file_info, file_name, order_id, user_chat_id, send_document_url)
                
                # Если не получилось или это URL-файл, пробуем отправку по URL
                if not success:
                    print(f"🔗 URL файла: {file_url}")
                    print(f"🌐 Пробуем отправку по URL")
                    
                    document_payload = {
                        'chat_id': user_chat_id,
                        'document': file_url,
                        'caption': f"📎 {file_name}"
                    }
                    
                    response = requests.post(send_document_url, json=document_payload, timeout=60)
                    
                    if response.status_code == 200:
                        print(f"✅ Файл {file_name} отправлен по URL")
                        success = True
                    else:
                        print(f"⚠️ Не удалось отправить по URL: {response.text}")
                        
                        # Последняя попытка - прямая отправка (если ещё не пробовали)
                        if isinstance(file_info, str):
                            print(f"🔄 Последняя попытка прямой отправки")
                            success = await try_direct_file_upload(file_info, file_name, order_id, user_chat_id, send_document_url)
                
                if success:
                    sent_count += 1
                else:
                    failed_files.append(file_name)
                    
            except Exception as e:
                print(f"❌ Критическая ошибка при отправке файла {file_name}: {e}")
                failed_files.append(file_name)
                # В критических случаях пробуем только прямую отправку
                if isinstance(file_info, str):
                    try:
                        success = await try_direct_file_upload(file_info, file_name, order_id, user_chat_id, send_document_url)
                        if success:
                            sent_count += 1
                            failed_files.remove(file_name)  # Убираем из неудачных, если получилось
                    except Exception as final_e:
                        print(f"❌ Финальная попытка не удалась для {file_name}: {final_e}")
        
        # Формируем итоговое сообщение
        final_message_parts = []
        
        if sent_count > 0:
            final_message_parts.append(f"✅ Отправлено {sent_count} из {len(files)} файлов заказа #{order_id}")
        
        if skipped_large_files:
            final_message_parts.append(f"⚠️ Пропущено {len(skipped_large_files)} больших файлов (>50MB):")
            for file_info in skipped_large_files:
                final_message_parts.append(f"   • {file_info}")
            final_message_parts.append("💡 Большие файлы можно скачать через браузер в приложении")
        
        if failed_files:
            final_message_parts.append(f"❌ Не удалось отправить {len(failed_files)} файлов:")
            for file_name in failed_files:
                final_message_parts.append(f"   • {file_name}")
        
        if sent_count == 0:
            final_message_parts.append("💡 Попробуйте скачать файлы через браузер в приложении")
        
        final_message = "\n".join(final_message_parts)
        
        final_payload = {
            'chat_id': user_chat_id,
            'text': final_message,
            'parse_mode': 'HTML'
        }
        
        requests.post(telegram_url, json=final_payload, timeout=10)
        
        return {
            "status": "success" if sent_count > 0 else "partial_success" if sent_count == 0 and len(files) > 0 else "error",
            "message": final_message,
            "sent_count": sent_count,
            "total_files": len(files),
            "skipped_large_files": len(skipped_large_files),
            "failed_files": len(failed_files),
            "details": {
                "sent_files": sent_count,
                "large_files_skipped": skipped_large_files,
                "failed_files": failed_files
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка отправки файлов в Telegram: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

@app.post("/api/send-files-to-telegram")
async def send_files_to_telegram_api(request: Request):
    """Отправка файлов заказа в Telegram (с префиксом /api/)"""
    return await send_files_to_telegram_handler(request)

@app.post("/send-files-to-telegram")
async def send_files_to_telegram_direct(request: Request):
    """Отправка файлов заказа в Telegram (без префикса /api/)"""
    return await send_files_to_telegram_handler(request)

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
        response = supabase.table('subjects') \
            .select('*') \
            .eq('is_active', True) \
            .neq('name', 'Архитектура прикладных информационных систем (ERP)') \
            .order('name') \
            .execute()
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
                'files': json.loads(order_data.get('files', '[]')) if isinstance(order_data.get('files'), str) else order_data.get('files', []),
                'executor_telegram': order_data.get('executor_telegram'),
                'payout_amount': order_data.get('payout_amount')
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
        order['executor_telegram'] = order.get('executor_telegram')
        order['payout_amount'] = order.get('payout_amount')
        
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
        if not isinstance(student_data, dict):
            raise HTTPException(status_code=400, detail="Некорректный формат данных студента")
        if not student_data.get('name') or not student_data.get('group') or not student_data.get('telegram'):
            raise HTTPException(status_code=400, detail="Заполните ФИО, группу и Telegram")

        # Убираем @ из ника
        raw_telegram = str(student_data.get('telegram', '')).strip()
        if raw_telegram.startswith('https://t.me/'):
            raw_telegram = raw_telegram.split('https://t.me/', 1)[1]
        clean_telegram = raw_telegram.lstrip('@').strip()
        if not clean_telegram:
            raise HTTPException(status_code=400, detail="Некорректный Telegram. Укажите username в формате @username")
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
        
        # Проверяем существование предмета или создаем кастомный
        subject_id = data.get('subject_id')
        subject_name = "Кастомный предмет"
        
        if subject_id is not None:
            subject_id = int(subject_id)
            subject = supabase.table('subjects').select('id, name').eq('id', subject_id).limit(1).execute()
            
            if not subject.data or len(subject.data) == 0:
                raise HTTPException(status_code=400, detail=f"Предмет с ID {subject_id} не найден")
            
            subject_name = subject.data[0]['name']
            print(f"📚 Предмет: {subject_name} (ID: {subject_id})")
        else:
            # Для кастомных заказов создаем или находим специальный предмет
            print(f"📚 Кастомный заказ - ищем/создаем специальный предмет")
            custom_subject = supabase.table('subjects').select('id').eq('name', 'Кастомный предмет').limit(1).execute()
            
            if custom_subject.data and len(custom_subject.data) > 0:
                subject_id = custom_subject.data[0]['id']
                print(f"✅ Найден кастомный предмет ID: {subject_id}")
            else:
                # Создаем кастомный предмет
                new_custom_subject = supabase.table('subjects').insert({
                    'name': 'Кастомный предмет',
                    'description': 'Предмет для кастомных заказов',
                    'price': 0.0
                }).execute()
                subject_id = new_custom_subject.data[0]['id']
                print(f"✅ Создан кастомный предмет ID: {subject_id}")
        
        # Подготавливаем данные заказа
        actual_price = data.get('actual_price', 0.0)
        selected_works_json = json.dumps(data.get('selected_works', [])) if data.get('selected_works') else None
        is_full_course = data.get('is_full_course', False)
        
        print(f"💰 Стоимость заказа: {actual_price} ₽")

        # Идемпотентность: если аналогичный заказ уже создан недавно, возвращаем его
        try:
            window_start_iso = (datetime.utcnow() - timedelta(minutes=2)).isoformat()
            dup_check = supabase.table('orders').select('id, created_at') \
                .eq('student_id', student_id) \
                .eq('subject_id', subject_id) \
                .eq('title', data['title']) \
                .eq('deadline', data['deadline']) \
                .gte('created_at', window_start_iso) \
                .order('created_at', desc=True) \
                .limit(1) \
                .execute()
            if dup_check.data and len(dup_check.data) > 0:
                existing_id = dup_check.data[0]['id']
                print(f"🔁 Найден дубликат заказа за последние 2 минуты. Возвращаем ID: {existing_id}")
                return get_order(existing_id)
        except Exception as e:
            print(f"⚠️ Ошибка проверки идемпотентности: {e}")
        
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
            'status': 'new',
            'executor_telegram': None,
            'payout_amount': None
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

            # Уведомляем самого пользователя о создании заказа (если доступна доставка)
            await send_status_notification_to_user(created_order, 'new')
            
        except Exception as e:
            print(f"⚠️ Ошибка отправки уведомления администратору: {e}")

        return created_order
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка создания заказа: {e}")
        raise HTTPException(status_code=500, detail="Внутренняя ошибка при создании заказа")

@app.patch("/api/orders/{order_id}/status")
async def update_order_status(order_id: int, request: Request):
    data = await request.json()
    status = data['status']
    
    try:
        # Валидация статуса на стороне backend (даёт понятную 400 вместо 500)
        if status not in ALLOWED_ORDER_STATUSES:
            raise HTTPException(status_code=400, detail=f"Недопустимый статус: {status}")
        
        # Получаем старый заказ для сравнения
        old_order = get_order(order_id)
        
        # Обновляем статус заказа
        try:
            response = supabase.table('orders').update({
                'status': status,
                'updated_at': datetime.now().isoformat()
            }).eq('id', order_id).execute()
        except Exception as e:
            # Если БД отклоняет новые статусы из-за CHECK-constraint
            err_text = str(e)
            if 'check constraint' in err_text.lower() or 'violates check constraint' in err_text.lower():
                raise HTTPException(
                    status_code=400,
                    detail=("Схема БД не допускает новый статус. Обновите CHECK-constraint для orders.status, "
                            "добавив 'queued' и 'under_review'. См. DEPLOYMENT_GUIDE.md, раздел SQL миграции статусов.")
                )
            raise
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Заказ не найден")
        
        # Получаем обновленный заказ
        updated_order = get_order(order_id)
        
        # Отправляем уведомление пользователю о изменении статуса
        if old_order['status'] != status and updated_order['student'].get('telegram'):
            await send_status_notification_to_user(updated_order, status)
            if status in ('paid', 'needs_revision'):
                notify_executors_board_entry(updated_order)
        
        return updated_order
        
    except Exception as e:
        if "No rows found" in str(e):
            raise HTTPException(status_code=404, detail="Заказ не найден")
        raise HTTPException(status_code=500, detail=f"Ошибка обновления статуса: {str(e)}")

@app.patch("/api/orders/{order_id}/paid")
async def mark_order_as_paid(order_id: int):
    try:
        old_order = get_order(order_id)

        next_status = old_order.get('status')
        if next_status not in ('completed', 'needs_revision'):
            next_status = 'paid'

        # Обновляем статус оплаты
        response = supabase.table('orders').update({
            'is_paid': True,
            'status': next_status,
            'updated_at': datetime.now().isoformat()
        }).eq('id', order_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Заказ не найден")
        
        updated_order = get_order(order_id)
        status_changed = old_order.get('status') != updated_order.get('status')

        if status_changed and updated_order['student'].get('telegram'):
            await send_status_notification_to_user(updated_order, updated_order['status'])

        if status_changed and updated_order.get('status') in ('paid', 'needs_revision'):
            notify_executors_board_entry(updated_order)

        return updated_order
        
    except Exception as e:
        if "No rows found" in str(e):
            raise HTTPException(status_code=404, detail="Заказ не найден")
        raise HTTPException(status_code=500, detail=f"Ошибка обновления оплаты: {str(e)}")


@app.patch("/api/orders/{order_id}/executor")
async def update_order_executor(order_id: int, request: Request):
    """Установка или снятие исполнителя и суммы к выплате"""
    try:
        data = await request.json()
        executor = data.get('executor_telegram')
        payout = data.get('payout_amount')

        update_payload = {
            'executor_telegram': executor.lstrip('@') if isinstance(executor, str) and executor else None,
            'updated_at': datetime.now().isoformat()
        }

        if payout is not None:
            try:
                payout_val = float(payout)
                if payout_val < 0:
                    raise ValueError
                update_payload['payout_amount'] = payout_val
            except Exception:
                raise HTTPException(status_code=400, detail="Некорректная сумма к выплате")

        response = supabase.table('orders').update(update_payload).eq('id', order_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Заказ не найден")

        return get_order(order_id)
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка обновления исполнителя: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка обновления исполнителя: {str(e)}")


@app.patch("/api/orders/{order_id}/admin")
async def update_order_admin(order_id: int, request: Request):
    """Полное редактирование заказа (кроме телеграма студента)"""
    try:
        data = await request.json()
        update_payload = {}
        student_update = {}

        # Получаем student_id для обновления данных студента при необходимости
        try:
            student_resp = supabase.table('orders').select('student_id, status').eq('id', order_id).single().execute()
            if not student_resp.data:
                raise HTTPException(status_code=404, detail="Заказ не найден")
            student_id = student_resp.data['student_id']
            old_status = student_resp.data.get('status')
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Ошибка получения student_id для заказа {order_id}: {e}")
            raise HTTPException(status_code=500, detail="Не удалось получить данные студента")

        # Простые поля
        for field in ['title', 'description', 'input_data', 'variant_info', 'deadline']:
            if field in data:
                update_payload[field] = data[field]

        # Обновление имени и группы студента
        if 'student_name' in data:
            student_update['name'] = data.get('student_name')
        if 'student_group' in data:
            student_update['group_name'] = data.get('student_group')

        # subject_id смена
        if 'subject_id' in data:
            try:
                update_payload['subject_id'] = int(data.get('subject_id')) if data.get('subject_id') is not None else None
            except Exception:
                raise HTTPException(status_code=400, detail="Некорректный subject_id")
            if update_payload['subject_id'] is not None:
                subject_exists = supabase.table('subjects').select('id').eq('id', update_payload['subject_id']).limit(1).execute()
                if not subject_exists.data:
                    raise HTTPException(status_code=400, detail="Предмет не найден")

        # Цена
        if 'actual_price' in data:
            try:
                price_val = float(data.get('actual_price'))
                if price_val < 0:
                    raise ValueError
                update_payload['actual_price'] = price_val
            except Exception:
                raise HTTPException(status_code=400, detail="Некорректная стоимость заказа")

        # Статус
        if 'status' in data:
            new_status = data.get('status')
            if new_status not in ALLOWED_ORDER_STATUSES:
                raise HTTPException(status_code=400, detail=f"Недопустимый статус: {new_status}")
            update_payload['status'] = new_status

        # Оплата
        if 'is_paid' in data:
            update_payload['is_paid'] = bool(data.get('is_paid'))

        # Исполнитель и выплата
        if 'executor_telegram' in data:
            executor = data.get('executor_telegram')
            update_payload['executor_telegram'] = executor.lstrip('@') if isinstance(executor, str) and executor else None

        if 'payout_amount' in data:
            try:
                payout_val = float(data.get('payout_amount')) if data.get('payout_amount') is not None else None
                if payout_val is not None and payout_val < 0:
                    raise ValueError
                update_payload['payout_amount'] = payout_val
            except Exception:
                raise HTTPException(status_code=400, detail="Некорректная сумма к выплате")

        if not update_payload and not student_update:
            raise HTTPException(status_code=400, detail="Нет данных для обновления")

        update_payload['updated_at'] = datetime.now().isoformat()

        response = supabase.table('orders').update(update_payload).eq('id', order_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Заказ не найден")

        if student_update:
            supabase.table('students').update(student_update).eq('id', student_id).execute()

        updated_order = get_order(order_id)

        # Уведомление о смене статуса
        try:
            new_status = updated_order.get('status')
            if old_status != new_status and new_status:
                await send_status_notification_to_user(updated_order, new_status)
                if new_status in ('paid', 'needs_revision'):
                    notify_executors_board_entry(updated_order)
        except Exception as e:
            print(f"⚠️ Ошибка отправки уведомления о смене статуса: {e}")

        return updated_order

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка админ-обновления заказа: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка админ-обновления: {str(e)}")

@app.patch("/api/orders/{order_id}/price")
async def update_order_price(order_id: int, request: Request):
    """Обновление стоимости заказа администратором и перевод в статус 'ожидание оплаты'"""
    try:
        data = await request.json()
        price = data.get('price')

        if price is None:
            raise HTTPException(status_code=400, detail="Не указана цена (price)")

        try:
            price_value = float(price)
        except Exception:
            raise HTTPException(status_code=400, detail="Некорректное значение цены")

        if price_value < 0:
            raise HTTPException(status_code=400, detail="Цена не может быть отрицательной")

        # Получаем текущий заказ
        current_order = get_order(order_id)

        # Определяем новый статус: если заказ новый или уже в ожидании оплаты и не оплачен
        new_status = current_order.get('status')
        if not current_order.get('is_paid') and new_status in ('new', 'waiting_payment'):
            new_status = 'waiting_payment'

        # Обновляем заказ в БД
        response = supabase.table('orders').update({
            'actual_price': price_value,
            'status': new_status,
            'updated_at': datetime.now().isoformat()
        }).eq('id', order_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Заказ не найден")

        # Получаем обновленный заказ
        updated_order = get_order(order_id)

        # Отправляем уведомление пользователю, если статус изменился
        if current_order.get('status') != new_status and updated_order['student'].get('telegram'):
            await send_status_notification_to_user(updated_order, new_status)
            if new_status in ('paid', 'needs_revision'):
                notify_executors_board_entry(updated_order)

        return updated_order

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка обновления цены заказа: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка обновления цены: {str(e)}")

@app.post("/api/orders/{order_id}/files")
async def upload_order_files(order_id: int, files: list[UploadFile] = File(...)):
    try:
        # Проверяем существование заказа
        order_check = supabase.table('orders').select('id, title, status, files').eq('id', order_id).single().execute()
        if not order_check.data:
            raise HTTPException(status_code=404, detail="Заказ не найден")
        
        # Создаем папку для файлов заказа
        upload_dir = os.path.join(UPLOADS_DIR, f"order_{order_id}")
        os.makedirs(upload_dir, exist_ok=True)
        
        # Уже сохраненные файлы для дополнения
        existing_files: list[str] = []
        try:
            raw_files = order_check.data.get('files')
            if raw_files:
                existing_files = json.loads(raw_files) if isinstance(raw_files, str) else list(raw_files)
        except Exception as e:
            print(f"⚠️ Не удалось распарсить существующие файлы: {e}")
            existing_files = []
        
        # Разрешенные типы файлов (можно расширить по необходимости)
        ALLOWED_EXTENSIONS = {
            # Документы
            '.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt',
            # Таблицы  
            '.xls', '.xlsx', '.csv', '.ods',
            # Презентации
            '.ppt', '.pptx', '.odp',
            # Архивы
            '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
            # Изображения
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.tiff',
            # Исходный код
            '.py', '.js', '.html', '.css', '.json', '.xml', '.yaml', '.yml',
            '.cpp', '.c', '.java', '.php', '.rb', '.go', '.rs', '.swift',
            # Другие
            '.md', '.log'
        }
        
        # Максимальный размер файла (100MB)
        MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB в байтах
        
        # Сохраняем загруженные файлы
        saved_files = []
        rejected_files = []
        
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
            # Сохраняем реальные загруженные файлы с проверками
            for file in files:
                if not file.filename:
                    rejected_files.append({"filename": "unnamed_file", "reason": "Отсутствует имя файла"})
                    continue
                
                # Проверяем расширение файла
                file_extension = os.path.splitext(file.filename.lower())[1]
                if file_extension not in ALLOWED_EXTENSIONS:
                    rejected_files.append({
                        "filename": file.filename, 
                        "reason": f"Недопустимый тип файла: {file_extension}"
                    })
                    continue
                
                # Читаем файл в память для проверки размера
                file_content = await file.read()
                file_size = len(file_content)
                
                # Проверяем размер файла
                if file_size > MAX_FILE_SIZE:
                    rejected_files.append({
                        "filename": file.filename, 
                        "reason": f"Файл слишком большой: {file_size / 1024 / 1024:.1f}MB (максимум 100MB)"
                    })
                    continue
                
                # Проверяем имя файла на безопасность (удаляем опасные символы)
                safe_filename = "".join(c for c in file.filename if c.isalnum() or c in (' ', '-', '_', '.')).rstrip()
                if not safe_filename or safe_filename != file.filename:
                    safe_filename = f"file_{len(saved_files)+1}{file_extension}"
                    print(f"⚠️ Переименован файл {file.filename} в {safe_filename} для безопасности")
                
                # Сохраняем файл на диск
                file_path = os.path.join(upload_dir, safe_filename)
                
                # Если файл с таким именем уже существует, добавляем номер
                counter = 1
                original_safe_filename = safe_filename
                while os.path.exists(file_path):
                    name, ext = os.path.splitext(original_safe_filename)
                    safe_filename = f"{name}_{counter}{ext}"
                    file_path = os.path.join(upload_dir, safe_filename)
                    counter += 1
                
                try:
                    with open(file_path, "wb") as buffer:
                        buffer.write(file_content)
                    
                    saved_files.append(safe_filename)
                    print(f"💾 Сохранен файл: {safe_filename} ({file_size / 1024 / 1024:.1f}MB) для заказа {order_id}")
                    
                except Exception as save_error:
                    rejected_files.append({
                        "filename": file.filename, 
                        "reason": f"Ошибка сохранения: {str(save_error)}"
                    })
                    continue
        
        # Обновляем информацию о файлах в базе данных (добавляем к существующим)
        all_files = existing_files + saved_files
        supabase.table('orders').update({
            'files': json.dumps(all_files),
            'status': 'completed',
            'updated_at': datetime.now().isoformat()
        }).eq('id', order_id).execute()
        
        print(f"📎 Файлы добавлены к заказу {order_id}: {saved_files}")
        
        # Получаем обновленный заказ
        updated_order = get_order(order_id)
        
        # Добавляем информацию о результатах загрузки
        updated_order['upload_results'] = {
            "saved_files": len(saved_files),
            "rejected_files": len(rejected_files),
            "rejected_details": rejected_files
        }
        
        # Отправляем уведомление пользователю только если есть сохраненные файлы
        if saved_files:
            await send_status_notification_to_user(updated_order, 'completed')
        
        return updated_order
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки файлов: {str(e)}")

@app.get("/api/file-upload-info")
async def get_file_upload_info():
    """Получение информации о поддерживаемых типах файлов и ограничениях"""
    return {
        "allowed_extensions": [
            # Документы
            '.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt',
            # Таблицы  
            '.xls', '.xlsx', '.csv', '.ods',
            # Презентации
            '.ppt', '.pptx', '.odp',
            # Архивы
            '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
            # Изображения
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.tiff',
            # Исходный код
            '.py', '.js', '.html', '.css', '.json', '.xml', '.yaml', '.yml',
            '.cpp', '.c', '.java', '.php', '.rb', '.go', '.rs', '.swift',
            # Другие
            '.md', '.log'
        ],
        "max_file_size_mb": 100,
        "max_file_size_bytes": 100 * 1024 * 1024,
        "telegram_max_size_mb": 50,
        "categories": {
            "documents": ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'],
            "spreadsheets": ['.xls', '.xlsx', '.csv', '.ods'],
            "presentations": ['.ppt', '.pptx', '.odp'],
            "archives": ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
            "images": ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.tiff'],
            "code": ['.py', '.js', '.html', '.css', '.json', '.xml', '.yaml', '.yml', '.cpp', '.c', '.java', '.php', '.rb', '.go', '.rs', '.swift'],
            "other": ['.md', '.log']
        }
    }

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
        elif filename.endswith('.zip'):
            media_type = 'application/zip'
        elif filename.endswith('.rar'):
            media_type = 'application/x-rar-compressed'
        elif filename.endswith('.7z'):
            media_type = 'application/x-7z-compressed'
        elif filename.endswith('.doc'):
            media_type = 'application/msword'
        elif filename.endswith('.xls'):
            media_type = 'application/vnd.ms-excel'
        elif filename.endswith('.xlsx'):
            media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        elif filename.endswith('.ppt'):
            media_type = 'application/vnd.ms-powerpoint'
        elif filename.endswith('.pptx'):
            media_type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        elif filename.endswith('.png'):
            media_type = 'image/png'
        elif filename.endswith('.jpg') or filename.endswith('.jpeg'):
            media_type = 'image/jpeg'
        elif filename.endswith('.gif'):
            media_type = 'image/gif'
        elif filename.endswith('.svg'):
            media_type = 'image/svg+xml'
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

# Utility функция для безопасного удаления временных файлов
def safe_cleanup_file(filepath: str):
    """Безопасное удаление временного файла"""
    try:
        if os.path.exists(filepath):
            os.unlink(filepath)
            print(f"🗑️ Временный файл удален: {filepath}")
    except Exception as e:
        print(f"⚠️ Не удалось удалить временный файл {filepath}: {e}")

@app.get("/api/orders/{order_id}/download-all")
async def download_all_files(order_id: int, background_tasks: BackgroundTasks):
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
            
            # Добавляем задачу на очистку временного файла
            background_tasks.add_task(safe_cleanup_file, temp_zip.name)
            
            return FileResponse(
                path=temp_zip.name,
                filename=zip_filename,
                media_type='application/zip'
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

                payload = {
                    'chat_id': user_chat_id,
                    'text': notification_text,
                    'parse_mode': 'HTML',
                    'reply_markup': build_main_reply_keyboard(user_telegram)
                }

                response = post_telegram("sendMessage", payload)
                if response is None:
                    print("⚠️ Telegram не настроен, не удалось отправить уведомление пользователю")
                    return {"status": "notification_sent", "order_id": order_id}
                
                if response.status_code == 200:
                    print(f"✅ Уведомление о заявке на оплату отправлено пользователю @{user_telegram}")
                else:
                    print(f"⚠️ Не удалось отправить уведомление @{user_telegram}: {response.text}")
            else:
                print(f"⚠️ Chat ID не найден для пользователя @{user_telegram}, пробуем fallback по username")
                payload = {
                    'chat_id': f"@{user_telegram}",
                    'text': (
                        "💳 <b>Заявка на оплату получена</b>\n\n"
                        "Ваша заявка принята и проверяется администратором."
                    ),
                    'parse_mode': 'HTML',
                    'reply_markup': build_main_reply_keyboard(user_telegram)
                }
                post_telegram("sendMessage", payload)
                
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
        notify_executors_board_entry(updated_order)
        
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