#!/usr/bin/env python3
"""
Telegram Bot для BBI Father
Основной бот с Web App интеграцией
"""

import os
import asyncio
import logging
from datetime import datetime
from typing import Optional

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Константы
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT_ID = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")  # ID администратора для тех поддержки
WEB_APP_URL = os.getenv("WEB_APP_URL", "https://bbifather.ru")

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
        
        # Обработчик нажатий на кнопки
        self.app.add_handler(CallbackQueryHandler(self.button_callback))
        
        # Обработчик текстовых сообщений для тех поддержки
        self.app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка команды /start"""
        user = update.effective_user
        
        welcome_text = f"""
👋 Привет, {user.first_name}!

Добро пожаловать в <b>BBI Father</b> - сервис для заказа практических работ!

🎓 Здесь вы можете:
• Заказать выполнение лабораторных работ
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
4️⃣ Скачайте готовую работу через приложение

<b>Нужна помощь?</b>
Нажмите "💬 Техподдержка" для связи с администратором
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

    def get_main_keyboard(self, username: Optional[str] = None) -> InlineKeyboardMarkup:
        """Создание главной клавиатуры"""
        keyboard = [
            [
                InlineKeyboardButton(
                    "📱 Открыть приложение",
                    web_app=WebAppInfo(url=f"{WEB_APP_URL}?telegram={username or 'user'}")
                )
            ],
            [
                InlineKeyboardButton("📋 Правила", callback_data="rules"),
                InlineKeyboardButton("💬 Техподдержка", callback_data="support")
            ],
            [
                InlineKeyboardButton("ℹ️ Справка", callback_data="help")
            ]
        ]
        return InlineKeyboardMarkup(keyboard)

    async def button_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка нажатий на inline кнопки"""
        query = update.callback_query
        await query.answer()
        
        if query.data == "rules":
            await self.send_rules(update, context, edit=True)
        elif query.data == "support":
            await self.handle_support_request(update, context, edit=True)
        elif query.data == "help":
            await self.help_command(update, context)
        elif query.data == "back_to_menu":
            await self.back_to_main_menu(update, context)

    async def send_rules(self, update: Update, context: ContextTypes.DEFAULT_TYPE, edit: bool = False):
        """Отправка правил пользования сервисом"""
        rules_text = """
📋 <b>Правила использования BBI Father</b>

<b>🎯 Что мы делаем:</b>
✅ Лабораторные работы по программированию
✅ Курсовые проекты
✅ Практические задания
✅ Консультации по коду

<b>⏰ Сроки выполнения:</b>
• Стандартная лаба: 1-3 дня
• Курсовая работа: 5-7 дней
• Срочные заказы: +50% к стоимости

<b>💰 Оплата:</b>
• Предоплата 100%
• Оплата на карту Тинькофф
• Чек отправляем в боте

<b>📝 Гарантии:</b>
• Бесплатные правки в течение 14 дней
• Проверка на плагиат
• Подробные комментарии в коде

<b>🚫 Не выполняем:</b>
❌ Экзамены и зачеты онлайн
❌ Написание дипломных работ
❌ Нарушение академических правил

<b>📞 Поддержка:</b>
Техподдержка работает ежедневно с 9:00 до 21:00 MSK
        """
        
        back_keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("🔙 Главное меню", callback_data="back_to_menu")]
        ])
        
        if edit and update.callback_query:
            await update.callback_query.edit_message_text(
                rules_text,
                reply_markup=back_keyboard,
                parse_mode='HTML'
            )
        else:
            await update.message.reply_text(
                rules_text,
                reply_markup=back_keyboard,
                parse_mode='HTML'
            )

    async def handle_support_request(self, update: Update, context: ContextTypes.DEFAULT_TYPE, edit: bool = False):
        """Обработка запроса в техподдержку"""
        user = update.effective_user
        
        support_text = f"""
💬 <b>Техническая поддержка</b>

Привет, {user.first_name}! 

Если у вас возникли вопросы или проблемы, опишите их в следующем сообщении.

<b>Наша команда поможет с:</b>
• Техническими проблемами
• Вопросами по заказам  
• Изменением требований
• Возвратом средств

<b>⏰ Время ответа:</b> обычно до 1 часа в рабочее время

Просто напишите ваш вопрос следующим сообщением 👇
        """
        
        # Сохраняем состояние ожидания сообщения для поддержки
        context.user_data['waiting_for_support'] = True
        
        back_keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("🔙 Главное меню", callback_data="back_to_menu")]
        ])
        
        if edit and update.callback_query:
            await update.callback_query.edit_message_text(
                support_text,
                reply_markup=back_keyboard,
                parse_mode='HTML'
            )
        else:
            await update.message.reply_text(
                support_text,
                reply_markup=back_keyboard,
                parse_mode='HTML'
            )

    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка текстовых сообщений"""
        user = update.effective_user
        
        # Если пользователь ждет ответа поддержки
        if context.user_data.get('waiting_for_support'):
            await self.forward_to_support(update, context)
            context.user_data['waiting_for_support'] = False
        else:
            # Обычное сообщение - показываем главное меню
            await update.message.reply_text(
                "Используйте кнопки ниже для навигации:",
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
        
        # Отправка администратору (если ID задан)
        if ADMIN_CHAT_ID:
            admin_message = f"""
🆘 <b>Новое обращение в техподдержку</b>

👤 <b>Пользователь:</b> {user.full_name}
🆔 <b>Username:</b> @{user.username or 'не указан'}
📱 <b>Telegram ID:</b> <code>{user.id}</code>
🕐 <b>Время:</b> {datetime.now().strftime('%d.%m.%Y %H:%M')}

💬 <b>Сообщение:</b>
{message_text}
            """
            
            try:
                await context.bot.send_message(
                    chat_id=ADMIN_CHAT_ID,
                    text=admin_message,
                    parse_mode='HTML'
                )
                logger.info(f"Support message forwarded to admin from user {user.id}")
            except Exception as e:
                logger.error(f"Failed to forward message to admin: {e}")

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

    def run(self):
        """Запуск бота"""
        logger.info("🤖 Запуск BBI Father Telegram Bot...")
        self.app.run_polling(drop_pending_updates=True)


def main():
    """Главная функция"""
    try:
        bot = BBIFatherBot()
        logger.info("🤖 BBI Father Telegram Bot запущен успешно!")
        # Запускаем бота
        bot.run()
    except KeyboardInterrupt:
        logger.info("👋 Бот остановлен пользователем")
    except Exception as e:
        logger.error(f"❌ Критическая ошибка: {e}")
    finally:
        logger.info("🔄 Завершение работы бота...")


if __name__ == "__main__":
    main()
