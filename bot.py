#!/usr/bin/env python3
"""
Telegram Bot для BBI Father
Основной бот с Web App интеграцией
"""

import os
import asyncio
import logging
import requests
import time
from typing import Optional, List, Set

from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
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

# Константы для бота (только то что нужно боту)
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT_ID = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")  # ID администратора для тех поддержки
# Поддержка нескольких администраторов через список chat_id (через запятую)
ADMIN_CHAT_IDS: List[str] = [cid.strip() for cid in os.getenv("TELEGRAM_ADMIN_CHAT_IDS", "").split(",") if cid.strip()]
# Поддержка списка админов по username (для авто-обнаружения chat_id при первом сообщении боту)
ADMIN_USERNAMES: List[str] = [u.strip().lstrip('@').lower() for u in os.getenv("TELEGRAM_ADMIN_USERNAMES", "artemonnnnnnn,artemonsup").split(",") if u.strip()]
# Динамически собранные chat_id админов, которые писали боту
ADMIN_DYNAMIC_CHAT_IDS: Set[str] = set()
# Username для отображения в /support
SUPPORT_USERNAME = os.getenv("TELEGRAM_SUPPORT_USERNAME", "artemonsup")
WEB_APP_URL = os.getenv("WEB_APP_URL", "https://bbifather.ru")
API_BASE_URL = os.getenv("API_BASE_URL", "https://bbifather.ru/api")  # URL для API запросов

if not BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN не задан в .env файле!")

class BBIFatherBot:
    def __init__(self):
        self.app = Application.builder().token(BOT_TOKEN).build()
        self.setup_handlers()

    def setup_handlers(self):
        """Настройка обработчиков команд и сообщений"""
        # Команды
        self.app.add_handler(CommandHandler("start", self.start_command))
        self.app.add_handler(CommandHandler("help", self.help_command))
        self.app.add_handler(CommandHandler("rules", self.rules_command))
        self.app.add_handler(CommandHandler("support", self.support_command))
        
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
1️⃣ Нажмите "📱 Открыть приложение" для создания заказа
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
        """Создание URL для WebApp с cache-busting параметрами"""
        timestamp = int(time.time())
        base_url = f"{WEB_APP_URL}?telegram={username or 'user'}"
        cache_busting_url = f"{base_url}&v={timestamp}&_cb={timestamp}"
        return cache_busting_url

    def get_main_keyboard(self, username: Optional[str] = None) -> ReplyKeyboardMarkup:
        """Создание главной клавиатуры"""
        keyboard = [
            [
                KeyboardButton(
                    "📱 Открыть приложение",
                    web_app=WebAppInfo(url=self.get_webapp_url(username))
                )
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
            # Убеждаемся что URL содержит /api
            api_url = API_BASE_URL
            if not api_url.endswith('/api'):
                api_url = api_url.rstrip('/') + '/api'

            full_url = f"{api_url}/save-chat-id"
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
📋 <b>Правила Использования BBI Father</b>

⚖️ <b>Продолжая пользоваться ботом, вы автоматически подтверждаете свое согласие с Правилами Использования BBI Father:</b>

<b>💰 1. Оплата:</b>
• Предоплата 100% на банковскую карту

<b>⏰ 2. Сроки выполнения:</b>
• Стандартное время выполнения практических работ с момента получения оплаты - до 7 дней
• В сложных случаях, при больших объемах, при непредвиденных обстоятельствах время выполнения может быть увеличено до двух недель
• Срочные заказы (1-2 дня) выполняются с 25% прибавкой к стоимости заказа и обговариваются в специальном порядке с администратором

<b>🔧 3. Исправления:</b>
• Сервис бесплатно предоставляет 1 правку по каждой заказанной практической работе. Стоимость последующих правок оценивается специально по каждому случаю
• В обязанности администратора не входит разгадывание ребусов преподавателей - все обсуждения и уточнения по поводу того, что конкретно необходимо исправить в отдельной практической работе ведутся исключительно студентом

<b>🛡️ 4. Гарантии:</b>
• Администратор подробно объясняет и разъясняет любые моменты, которые входят в содержание практической работы
• Администратор ответит на любые вопросы по поводу содержания выполненной практической работы
• Исходные материалы практической работы будут предоставлены по запросу
• В случаях, когда практическая работа включает в себя написание кода, весь код и логика его работы будет объяснена, написаны подробные комментарии
        """
        
        keyboard = self.get_main_keyboard(update.effective_user.username)
        
        await update.message.reply_text(
            rules_text,
            reply_markup=keyboard,
            parse_mode='HTML'
        )

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
        if message_text == "📋 Правила":
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

📱 <b>Открыть приложение</b> - создать заказ и отслеживать статус
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

<b>📋 Как заказать работу:</b>
1️⃣ Нажмите "📱 Открыть приложение"
2️⃣ Выберите предмет из списка
3️⃣ Выберите нужные работы или весь курс
4️⃣ Заполните ваши данные и требования
5️⃣ Укажите дедлайн и создайте заказ

<b>💰 Процесс оплаты:</b>
• После создания заказа вы получите реквизиты
• Переведите указанную сумму на карту
• Нажмите "Я оплатил" в приложении
• Ожидайте подтверждения оплаты

<b>📊 Отслеживание статуса:</b>
• <b>Новый</b> - заказ только что создан
• <b>Ожидание оплаты</b> - ждем вашу оплату
• <b>Оплачен</b> - оплата подтверждена
• <b>В работе</b> - мы выполняем заказ
• <b>Выполнен</b> - работа готова к скачиванию

<b>📥 Получение работы:</b>
• Готовые файлы появятся в приложении
• Вы также получите файлы прямо в этом боте

<b>🔄 Если нужны исправления:</b>
• Откройте готовую работу в приложении
• Нажмите "Нужны исправления"
• Опишите что нужно изменить
• Получите исправленную версию бесплатно

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
