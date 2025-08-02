#!/usr/bin/env python3
"""
Простой бот без сложных зависимостей
Работает как HTTP сервер для уведомлений
"""

import os
import sys
import json
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import time

def load_env():
    """Загружает переменные из .env файла"""
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    if os.path.exists(env_path):
        print(f"📄 Читаю .env из: {env_path}")
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()
        print("✅ .env файл загружен")
    else:
        print(f"⚠️  .env файл не найден: {env_path}")

# Загружаем .env
load_env()

# Настройки
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
PORT = 8080

class NotificationHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            # Сначала отправляем HTTP ответ быстро
            try:
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'OK')
            except:
                pass  # Игнорируем ошибки отправки ответа
            
            # Потом обрабатываем уведомление
            print(f"📨 Получен webhook: {self.path}")
            
            if self.path == '/webhook/new_order':
                self.handle_new_order(data)
            elif self.path == '/webhook/status_change':
                self.handle_status_change(data)
            elif self.path == '/webhook/payment':
                self.handle_payment(data)
            elif self.path == '/webhook/payment_notification':
                print("💰 Обрабатываем уведомление об оплате")
                self.handle_payment_notification(data)
            else:
                print(f"❓ Неизвестный webhook: {self.path}")
            
        except Exception as e:
            print(f"❌ Ошибка обработки webhook: {e}")
            try:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b'Error')
            except:
                pass  # Игнорируем ошибки отправки ответа
    
    def handle_new_order(self, data):
        # Подготавливаем дополнительные поля
        variant_info = data.get('variant_info', '').strip()
        input_data = data.get('input_data', '').strip()
        
        message = f"""
🆕 Новый заказ #{data.get('id', 'N/A')}

👤 Студент: {data.get('student_name', 'N/A')}
👥 Группа: {data.get('student_group', 'N/A')}
📱 Telegram: {data.get('student_telegram', 'N/A')}

📚 Предмет: {data.get('subject_name', 'N/A')}
📝 Название: {data.get('title', 'N/A')}
📄 Описание: {data.get('description', 'N/A')[:200]}{'...' if len(data.get('description', '')) > 200 else ''}

⏰ Дедлайн: {data.get('deadline', 'N/A')}
💰 Стоимость: {data.get('price', 'N/A')} руб.
        """.strip()
        
        # Добавляем дополнительные поля если они заполнены
        if variant_info:
            message += f"\n\n🔢 Информация о варианте:\n{variant_info[:300]}{'...' if len(variant_info) > 300 else ''}"
        
        if input_data:
            message += f"\n\n📋 Дополнительные требования:\n{input_data[:300]}{'...' if len(input_data) > 300 else ''}"
        
        message += f"\n\nСоздан: {datetime.now().strftime('%d.%m.%Y %H:%M')}"
        
        self.send_notification(message)
    
    def handle_status_change(self, data):
        status_names = {
            'new': 'Новый',
            'waiting_payment': 'Ожидание оплаты',
            'paid': 'Оплачен', 
            'in_progress': 'В работе',
            'completed': 'Выполнен'
        }
        
        old_status = status_names.get(data.get('old_status'), data.get('old_status'))
        new_status = status_names.get(data.get('new_status'), data.get('new_status'))
        
        message = f"""
🔄 Изменение статуса заказа #{data.get('order_data', {}).get('id', 'N/A')}

📝 Заказ: {data.get('order_data', {}).get('title', 'N/A')}
👤 Студент: {data.get('order_data', {}).get('student_name', 'N/A')}

Было: {old_status}
Стало: {new_status}

Изменено: {datetime.now().strftime('%d.%m.%Y %H:%M')}
        """.strip()
        
        self.send_notification(message)
    
    def handle_payment(self, data):
        message = f"""
💳 Заказ оплачен!

📝 Заказ #{data.get('id', 'N/A')}: {data.get('title', 'N/A')}
👤 Студент: {data.get('student_name', 'N/A')}
💰 Сумма: {data.get('price', 'N/A')} руб.

Оплачено: {datetime.now().strftime('%d.%m.%Y %H:%M')}
        """.strip()
        
        self.send_notification(message)
    
    def handle_payment_notification(self, data):
        print(f"💰 Начинаем обработку уведомления об оплате")
        print(f"🔍 Полученные данные: {data}")
        
        # Подготавливаем дополнительные поля
        variant_info = data.get('variant_info', '').strip()
        input_data = data.get('input_data', '').strip()
        
        message = f"""
💰 Студент отметил оплату!

📝 Заказ #{data.get('order_id', 'N/A')}: {data.get('title', 'N/A')}
👤 Студент: {data.get('student_name', 'N/A')}
👥 Группа: {data.get('student_group', 'N/A')}
📱 Telegram: {data.get('student_telegram', 'N/A')}

📚 Предмет: {data.get('subject_name', 'N/A')}
📄 Описание: {data.get('description', 'N/A')[:200]}{'...' if len(data.get('description', '')) > 200 else ''}
⏰ Дедлайн: {data.get('deadline', 'N/A')}
💰 Сумма: {data.get('price', 'N/A')} руб.
        """.strip()
        
        # Добавляем дополнительные поля если они заполнены
        if variant_info:
            message += f"\n\n🔢 Информация о варианте:\n{variant_info[:300]}{'...' if len(variant_info) > 300 else ''}"
        
        if input_data:
            message += f"\n\n📋 Дополнительные требования:\n{input_data[:300]}{'...' if len(input_data) > 300 else ''}"
        
        message += f"\n\n⚠️ Проверьте поступление средств и обновите статус заказа!"
        message += f"\n\nУведомление: {datetime.now().strftime('%d.%m.%Y %H:%M')}"
        
        print(f"📝 Готовое сообщение для отправки:\n{message}")
        print(f"🤖 Отправляем в Telegram...")
        
        self.send_notification(message)
        
        print(f"✅ Обработка уведомления об оплате завершена")
    
    def send_notification(self, message):
        print("=" * 50)
        print("📱 УВЕДОМЛЕНИЕ:")
        print(message)
        print("=" * 50)
        
        # Проверяем настройки Telegram
        print(f"🔍 BOT_TOKEN: {'✅ есть' if BOT_TOKEN else '❌ нет'}")
        print(f"🔍 CHAT_ID: {'✅ есть' if CHAT_ID else '❌ нет'}")
        
        # Если есть токен бота - отправляем в Telegram
        if BOT_TOKEN and CHAT_ID:
            try:
                import requests
                url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
                payload = {
                    'chat_id': CHAT_ID,
                    'text': message,
                    'parse_mode': 'HTML'
                }
                print(f"🚀 Отправляем в Telegram: {url}")
                response = requests.post(url, data=payload, timeout=10)
                print(f"📤 Ответ Telegram API: {response.status_code}")
                if response.status_code == 200:
                    print("✅ Отправлено в Telegram")
                else:
                    print(f"❌ Telegram вернул ошибку: {response.text}")
            except Exception as e:
                print(f"❌ Ошибка отправки в Telegram: {e}")
                import traceback
                traceback.print_exc()
        else:
            print("⚠️ Telegram не настроен - уведомление только в консоли")
            if not BOT_TOKEN:
                print("   📝 Добавьте TELEGRAM_BOT_TOKEN в .env файл")
            if not CHAT_ID:
                print("   📝 Добавьте TELEGRAM_CHAT_ID в .env файл")

def run_server():
    """Запуск HTTP сервера для webhook'ов"""
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, NotificationHandler)
    print(f"🤖 Бот-сервер запущен на порту {PORT}")
    print("📱 Готов к приему уведомлений...")
    
    # Показываем статус настроек
    if BOT_TOKEN and CHAT_ID:
        print(f"✅ Telegram настроен:")
        print(f"   📱 Токен: {BOT_TOKEN[:10]}...{BOT_TOKEN[-5:] if len(BOT_TOKEN) > 15 else BOT_TOKEN}")
        print(f"   💬 Chat ID: {CHAT_ID}")
        print("   🚀 Уведомления будут отправляться в Telegram!")
    elif BOT_TOKEN:
        print("⚠️  Токен бота найден, но не указан CHAT_ID")
        print("   Добавьте TELEGRAM_CHAT_ID в .env файл")
    elif CHAT_ID:
        print("⚠️  Chat ID найден, но не указан токен бота")
        print("   Добавьте TELEGRAM_BOT_TOKEN в .env файл") 
    else:
        print("⚠️  Telegram не настроен - уведомления только в консоли")
        print("   Проверьте настройки в .env файле")
    
    print("-" * 50)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Остановка бота...")
        httpd.shutdown()

if __name__ == "__main__":
    run_server()