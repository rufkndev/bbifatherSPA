#!/usr/bin/env python3
"""
Telegram Bot для BBI Father
Основной бот с Web App интеграцией
"""

import os
import asyncio
import logging
import requests
import re
import urllib.parse
from typing import Optional, List, Set

from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo, BotCommand
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Убираем спам из библиотек HTTP-уровня
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("telegram.vendor.ptb_urllib3").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

# Константы для бота (только то что нужно боту)
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT_ID = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")  # ID администратора для тех поддержки

def parse_chat_ids(*raw_values: str) -> List[str]:
    chat_ids: List[str] = []
    for raw_value in raw_values:
        for chat_id in re.split(r"[\s,;]+", raw_value or ""):
            cleaned = chat_id.strip()
            if cleaned:
                chat_ids.append(cleaned)
    return list(dict.fromkeys(chat_ids))

# Поддержка нескольких администраторов через список chat_id (через запятую)
ADMIN_CHAT_IDS: List[str] = parse_chat_ids(
    os.getenv("TELEGRAM_ADMIN_CHAT_IDS", ""),
    ADMIN_CHAT_ID,
    "814032949,8296182614"
)
# Поддержка списка админов по username (для авто-обнаружения chat_id при первом сообщении боту)
ADMIN_USERNAMES: List[str] = [u.strip().lstrip('@').lower() for u in os.getenv("TELEGRAM_ADMIN_USERNAMES", "artemonnnnnnn,artemonsup").split(",") if u.strip()]
# Динамически собранные chat_id админов, которые писали боту
ADMIN_DYNAMIC_CHAT_IDS: Set[str] = set()
# Username для отображения в /support
SUPPORT_USERNAME = os.getenv("TELEGRAM_SUPPORT_USERNAME", "artemonsup")
WEB_APP_URL = os.getenv("WEB_APP_URL", "https://bbifather.ru")
# Бот и backend обычно работают на одном сервере. Локальный адрес не зависит от nginx
# и не ловит 502, пока публичный прокси еще поднимается.
API_BASE_URL = (
    os.getenv("BOT_API_BASE_URL")
    or os.getenv("INTERNAL_API_BASE_URL")
    or "http://127.0.0.1:8000/api"
)
FORCE_REFRESH_BOT_USERS_ON_STARTUP = os.getenv("FORCE_REFRESH_BOT_USERS_ON_STARTUP", "true").lower() == "true"
FORCE_REFRESH_STARTUP_DELAY_SECONDS = float(os.getenv("FORCE_REFRESH_STARTUP_DELAY_SECONDS", "3"))

if not BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN не задан в .env файле!")

class BBIFatherBot:
    def __init__(self):
        self.app = Application.builder().token(BOT_TOKEN).post_init(self.on_post_init).build()
        self.setup_handlers()

    async def on_post_init(self, application: Application):
        """Действия сразу после запуска приложения."""
        try:
            await application.bot.set_my_commands([
                BotCommand("start", "Открыть главное меню"),
                BotCommand("help", "Как пользоваться сервисом"),
                BotCommand("rules", "Правила сервиса"),
                BotCommand("support", "Связаться с поддержкой"),
                BotCommand("id", "Показать ваш Telegram ID"),
            ])
            logger.info("✅ Команды Telegram-бота обновлены")
        except Exception as e:
            logger.error(f"⚠️ Не удалось обновить команды Telegram, бот продолжит запуск: {e}")

        if FORCE_REFRESH_BOT_USERS_ON_STARTUP:
            asyncio.create_task(self.force_refresh_all_users_keyboards_after_delay())

    async def force_refresh_all_users_keyboards_after_delay(self):
        """Обновляет клавиатуры после старта polling, не блокируя запуск бота."""
        if FORCE_REFRESH_STARTUP_DELAY_SECONDS > 0:
            await asyncio.sleep(FORCE_REFRESH_STARTUP_DELAY_SECONDS)
        try:
            await self.force_refresh_all_users_keyboards()
        except Exception as e:
            logger.error(f"⚠️ Не удалось принудительно обновить клавиатуры: {e}")

    def get_api_base_url(self) -> str:
        """Нормализует базовый URL API с суффиксом /api."""
        api_url = API_BASE_URL.rstrip("/")
        if not api_url.endswith("/api"):
            api_url = f"{api_url}/api"
        return api_url

    def get_backend_root_url(self) -> str:
        """Нормализует корневой URL backend (без /api)."""
        api_url = API_BASE_URL.rstrip("/")
        if api_url.endswith("/api"):
            return api_url[:-4]
        return api_url

    async def force_refresh_all_users_keyboards(self):
        """Принудительное обновление клавиатуры для всех пользователей в базе."""
        refresh_urls = [
            f"{self.get_api_base_url()}/bot/force-refresh-keyboards",
            f"{self.get_backend_root_url()}/api/bot/force-refresh-keyboards"
        ]
        # Убираем дубликаты URL
        refresh_urls = list(dict.fromkeys(refresh_urls))
        logger.info(f"♻️ Принудительное обновление меню пользователей: {refresh_urls[0]}")

        max_attempts = 2
        for attempt in range(1, max_attempts + 1):
            for refresh_url in refresh_urls:
                try:
                    response = await asyncio.to_thread(
                        requests.post,
                        refresh_url,
                        json={"silent": True},
                        timeout=20
                    )
                    if response.status_code == 200:
                        logger.info(f"✅ Обновление меню выполнено: {response.text}")
                        return
                    logger.warning(
                        f"⚠️ Попытка {attempt}/{max_attempts}: не удалось обновить меню пользователей через {refresh_url}: "
                        f"{response.status_code} {response.text}"
                    )
                except Exception as e:
                    logger.error(f"❌ Попытка {attempt}/{max_attempts}: ошибка обновления меню пользователей через {refresh_url}: {e}")

            if attempt < max_attempts:
                await asyncio.sleep(min(2 * attempt, 10))

        logger.error("❌ Не удалось выполнить принудительное обновление меню после всех попыток")

    def setup_handlers(self):
        """Настройка обработчиков команд и сообщений"""
        # Команды
        self.app.add_handler(CommandHandler("start", self.start_command))
        self.app.add_handler(CommandHandler("help", self.help_command))
        self.app.add_handler(CommandHandler("rules", self.rules_command))
        self.app.add_handler(CommandHandler("support", self.support_command))
        self.app.add_handler(CommandHandler("id", self.id_command))
        
        # Обработчик текстовых сообщений (включая кнопки меню)
        self.app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))
        
        # Дополнительное логирование
        logger.info("🔧 Все обработчики зарегистрированы")

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка команды /start"""
        user = update.effective_user
        
        # Сохраняем chat_id пользователя для отправки уведомлений (без задержки ответа)
        asyncio.create_task(self.save_user_chat_id(user))
        
        welcome_text = f"""
👋 Привет, {user.first_name}!

Добро пожаловать в <b>BBI Father</b> - сервис для заказа практических работ!

🎓 Здесь вы можете:
• Заказать выполнение практических работ
• Отслеживать статус ваших заказов  
• Получать готовые работы прямо в Telegram

Выберите действие из меню ниже:
        """
        
        keyboard = self.get_main_keyboard(user.username)
        
        await update.message.reply_text(
            welcome_text,
            reply_markup=keyboard,
            parse_mode='HTML'
        )

    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка команды /help"""
        help_text = """
📖 <b>Справка по боту BBI Father</b>

<b>Основные команды:</b>
/start - Главное меню
/help - Эта справка
/rules - Правила использования
/support - Техническая поддержка

<b>Как пользоваться:</b>
1️⃣ Нажмите "📱 Открыть мини-апп" для создания заказа
2️⃣ Заполните форму с деталями работы
3️⃣ Получите уведомления о статусе заказа
4️⃣ Готовые файлы придут прямо в Telegram или скачайте их через браузер

<b>Нужна помощь?</b>
Нажмите "❓ Как пользоваться сервисом?" или "💬 Техподдержка"
        """
        
        keyboard = self.get_main_keyboard(update.effective_user.username)
        
        await update.message.reply_text(
            help_text,
            reply_markup=keyboard,
            parse_mode='HTML'
        )

    async def rules_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка команды /rules"""
        await self.send_rules(update, context)

    async def support_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка команды /support"""
        await self.handle_support_request(update, context)

    def get_webapp_url(self, username: Optional[str] = None) -> str:
        """Создание стабильного URL для WebApp (desktop/mobile friendly)."""
        base_url = WEB_APP_URL.rstrip("/")
        params = {"source": "bot_keyboard"}
        if username:
            params["telegram"] = username.lstrip("@")

        query = urllib.parse.urlencode(params)
        return f"{base_url}?{query}" if query else base_url

    def get_main_keyboard(self, username: Optional[str] = None) -> ReplyKeyboardMarkup:
        """Создание главной клавиатуры"""
        keyboard = [
            [
                KeyboardButton("📱 Открыть мини-апп", web_app=WebAppInfo(url=self.get_webapp_url(username)))
            ],
            [
                KeyboardButton("💬 Техподдержка"),
                KeyboardButton("📋 Правила")
            ],
            [
                KeyboardButton("❓ Как пользоваться сервисом?")
            ]
        ]
        return ReplyKeyboardMarkup(
            keyboard, 
            resize_keyboard=True, 
            one_time_keyboard=False,
            input_field_placeholder="Выберите действие из меню ниже"
        )

    async def save_user_chat_id(self, user):
        """Сохранение chat_id пользователя для отправки уведомлений"""
        if not user.username:
            logger.warning(f"У пользователя {user.first_name} (ID: {user.id}) нет username")
            return
            
        try:
            full_url = f"{self.get_api_base_url()}/save-chat-id"
            logger.info(f"🌐 Отправляем chat_id на: {full_url}")

            # Выполняем блокирующий HTTP-запрос в отдельном потоке, чтобы не блокировать event loop
            response = await asyncio.to_thread(
                requests.post,
                full_url,
                json={
                    "telegram_username": user.username,
                    "chat_id": user.id,
                    "first_name": user.first_name,
                    "last_name": user.last_name or ""
                },
                timeout=5
            )

            if response.status_code == 200:
                logger.info(f"✅ Chat ID сохранен для @{user.username}")
            else:
                logger.warning(f"⚠️ Не удалось сохранить chat_id: {response.text}")

        except Exception as e:
            logger.error(f"❌ Ошибка сохранения chat_id: {e}")

        # Авто-обнаружение админов по username и добавление их chat_id в список получателей
        try:
            username_l = (user.username or '').lower()
            if username_l in ADMIN_USERNAMES:
                ADMIN_DYNAMIC_CHAT_IDS.add(str(user.id))
                logger.info(f"👑 Добавлен admin chat_id {user.id} для @{user.username}")
        except Exception as e:
            logger.error(f"❌ Ошибка добавления admin chat_id: {e}")

    async def send_rules(self, update: Update, context: ContextTypes.DEFAULT_TYPE, edit: bool = False):
        """Отправка правил пользования сервисом"""
        rules_text = """
📋 <b>Правила использования BBI Father</b>

⚖️ Продолжая пользоваться ботом, вы автоматически подтверждаете согласие с правилами.

<b>1. Оплата</b>
• Предоплата 100% на банковскую карту

<b>2. Сроки выполнения</b>
• Стандартно: до 4 суток (96 часов) после оплаты и назначения исполнителя  
• Сложные/большие заказы или очередь: до 14 дней  
• Срочно (1–2 дня): +25% к стоимости, обсуждается с администратором

<b>3. Исправления</b>
• 1 правка бесплатно на каждую работу  
• Последующие правки — по индивидуальной оценке  
• Администратор не «угадывает» требования: уточнения по правкам с преподавателем ведёт студент

<b>4. Гарантии</b>
• Гарантируем выполнение работы в срок
• Гарантируем качественное выполнение работы по всем требованиям, иначе исправим бесплатно и предоставим скидку на следующий заказ
• Объясним содержание выполненной работы
• Ответим на вопросы по готовой работе  
• Предоставим исходные материалы по запросу  
• Если есть код — объясним логику и добавим понятные комментарии
        """
        
        keyboard = self.get_main_keyboard(update.effective_user.username)
        
        await update.message.reply_text(
            rules_text,
            reply_markup=keyboard,
            parse_mode='HTML'
        )

    async def id_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Показывает пользователю его chat_id и username для настройки уведомлений"""
        user = update.effective_user
        text = (
            f"🆔 Ваш Telegram ID: <code>{user.id}</code>\n"
            f"👤 Username: @{user.username or 'не указан'}"
        )
        await update.message.reply_text(text, parse_mode='HTML', reply_markup=self.get_main_keyboard(user.username))

    async def handle_support_request(self, update: Update, context: ContextTypes.DEFAULT_TYPE, edit: bool = False):
        """Обработка запроса в техподдержку - перенаправление к админу"""
        user = update.effective_user
        
        support_text = f"""
💬 <b>Техническая поддержка</b>

Привет, {user.first_name}! 

Для получения любой помощи <b>по сложным вопросам</b> свяжитесь с нашим администратором напрямую.

<b>⏰ Время ответа:</b> В течение дня

Нажмите кнопку ниже для связи с администратором 👇
        """
        
        support_text += f"\n\n📞 <b>Контакт:</b> @{SUPPORT_USERNAME}"
        
        keyboard = self.get_main_keyboard(user.username)
        
        await update.message.reply_text(
            support_text,
            reply_markup=keyboard,
            parse_mode='HTML'
        )

    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка текстовых сообщений и кнопок меню"""
        user = update.effective_user
        message_text = update.message.text
        
        logger.info(f"📨 Получено сообщение: '{message_text}' от {user.username or user.first_name}")
        
        # Сохраняем chat_id пользователя для отправки уведомлений (без задержки ответа)
        asyncio.create_task(self.save_user_chat_id(user))
        
        # Если пользователь ждет ответа поддержки
        if context.user_data.get('waiting_for_support'):
            await self.forward_to_support(update, context)
            context.user_data['waiting_for_support'] = False
            return
        
        # Обработка кнопок меню
        if message_text in ("📱 Открыть мини-апп", "📱 Открыть приложение", "📥 Скачать файлы"):
            await update.message.reply_text(
                "Используйте кнопку `📱 Открыть мини-апп` в меню, чтобы открыть актуальную версию сервиса.",
                reply_markup=self.get_main_keyboard(user.username),
                parse_mode='Markdown'
            )
        elif message_text == "📋 Правила":
            await self.send_rules(update, context)
        elif message_text == "💬 Техподдержка":
            await self.handle_support_request(update, context)
        elif message_text == "❓ Как пользоваться сервисом?":
            await self.send_user_guide(update, context)
        else:
            # Неизвестное сообщение - показываем главное меню
            await update.message.reply_text(
                "Выберите одну из кнопок меню ниже:",
                reply_markup=self.get_main_keyboard(user.username)
            )

    async def forward_to_support(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Пересылка сообщения администратору"""
        user = update.effective_user
        message_text = update.message.text
        
        # Подтверждение пользователю
        await update.message.reply_text(
            "✅ Ваше сообщение отправлено в техподдержку!\n\n"
            "Мы ответим вам в ближайшее время.",
            reply_markup=self.get_main_keyboard(user.username)
        )
        
        # Отправка администраторам (если ID заданы)
        admin_targets: List[str] = []
        if ADMIN_CHAT_IDS:
            admin_targets.extend(ADMIN_CHAT_IDS)
        if ADMIN_CHAT_ID:
            admin_targets.append(ADMIN_CHAT_ID)
        if ADMIN_DYNAMIC_CHAT_IDS:
            admin_targets.extend(list(ADMIN_DYNAMIC_CHAT_IDS))

        if admin_targets:
            admin_message = f"""
🆘 <b>Новое обращение в техподдержку</b>

👤 <b>Пользователь:</b> {user.full_name}
🆔 <b>Username:</b> @{user.username or 'не указан'}
📱 <b>Telegram ID:</b> <code>{user.id}</code>
🕐 <b>Время:</b> сейчас

💬 <b>Сообщение:</b>
{message_text}
            """
            
            for admin_id in list(dict.fromkeys(admin_targets)):
                try:
                    await context.bot.send_message(
                        chat_id=admin_id,
                        text=admin_message,
                        parse_mode='HTML'
                    )
                    logger.info(f"Support message forwarded to admin {admin_id} from user {user.id}")
                except Exception as e:
                    logger.error(f"Failed to forward message to admin {admin_id}: {e}")

    async def back_to_main_menu(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Возврат в главное меню"""
        user = update.effective_user
        
        main_text = f"""
🏠 <b>Главное меню BBI Father</b>

Привет, {user.first_name}! Выберите действие:

📋 <b>Правила</b> - ознакомиться с условиями работы  
💬 <b>Техподдержка</b> - связаться с администратором
        """
        
        keyboard = self.get_main_keyboard(user.username)
        
        if update.callback_query:
            await update.callback_query.edit_message_text(
                main_text,
                reply_markup=keyboard,
                parse_mode='HTML'
            )

    async def send_user_guide(self, update: Update, context: ContextTypes.DEFAULT_TYPE, edit: bool = False):
        """Отправка справки по работе сервиса"""
        guide_text = """
ℹ️ <b>Справка по работе BBI Father</b>

<b>Как заказать работу</b>
1. Откройте приложение  
2. Выберите ваш курс  
3. Выберите ваш семестр  
4. Выберите нужные практические работы  
5. Укажите данные для выполнения работы и создайте заказ

<b>Процесс оплаты</b>
• После подтверждения заказа вы получите реквизиты  
• Переведите указанную сумму по реквизитам  
• Нажмите «Я оплатил» и ожидайте подтверждения  
• После оплаты начнётся выполнение вашего заказа

<b>Отслеживание статуса заказа</b>
• Новый — заказ создан и ждёт подтверждения  
• Ожидание оплаты — заказ ожидает оплаты  
• Оплачен — оплата подтверждена  
• В работе — назначен исполнитель и идёт выполнение  
• Выполнен — работы готовы к скачиванию

<b>Если нужны исправления</b>
1. Откройте карточку заказа в приложении  
2. Нажмите «Нужны исправления»  
3. Опишите, что нужно изменить  
4. Ожидайте исправления

        """
        
        keyboard = self.get_main_keyboard(update.effective_user.username)
        
        await update.message.reply_text(
            guide_text,
            reply_markup=keyboard,
            parse_mode='HTML'
        )



    def run(self):
        """Запуск бота"""
        logger.info("🤖 Запуск BBI Father Telegram Bot...")
        
        try:
            # Запускаем polling с правильными настройками
            self.app.run_polling(
                drop_pending_updates=True,
                bootstrap_retries=-1,
                timeout=30,
                close_loop=False,
                stop_signals=None  # Для Windows
            )
        except KeyboardInterrupt:
            logger.info("👋 Бот остановлен пользователем")
        except Exception as e:
            logger.error(f"❌ Ошибка при запуске: {e}")
            raise


def main():
    """Главная функция"""
    try:
        logger.info("🚀 Инициализация BBI Father Telegram Bot...")
        
        # Проверяем переменные окружения
        if not BOT_TOKEN:
            logger.error("❌ TELEGRAM_BOT_TOKEN не задан!")
            return
            
        if ADMIN_CHAT_IDS or ADMIN_CHAT_ID:
            logger.info("👨‍💼 Техподдержка настроена")
        else:
            logger.warning("⚠️ Техподдержка не настроена")
        
        bot = BBIFatherBot()
        logger.info("🤖 BBI Father Telegram Bot запущен!")
        
        # Запускаем бота
        bot.run()
    except Exception as e:
        logger.error(f"❌ Критическая ошибка: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
    finally:
        logger.info("🔄 Завершение работы бота...")


if __name__ == "__main__":
    main()
