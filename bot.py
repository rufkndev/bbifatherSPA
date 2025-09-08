#!/usr/bin/env python3
"""
Telegram Bot для BBI Father
Основной бот с Web App интеграцией
"""

import os
import asyncio
import logging
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

# Константы для бота (только то что нужно боту)
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT_ID = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")  # ID администратора для тех поддержки
ADMIN_USERNAME = os.getenv("TELEGRAM_ADMIN_USERNAME", "bbifatheradmin")  # Username администратора  
WEB_APP_URL = os.getenv("WEB_APP_URL", "https://bbifather.ru")

if not BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN не задан в .env файле!")

class BBIFatherBot:
    def __init__(self):
        self.app = Application.builder().token(BOT_TOKEN).build()
        self.setup_handlers()

    def setup_handlers(self):
        """Настройка обработчиков команд и сообщений"""
        # КРИТИЧЕСКИ ВАЖНО: CallbackQueryHandler должен быть ПЕРВЫМ!
        self.app.add_handler(CallbackQueryHandler(self.button_callback))
        
        # Команды
        self.app.add_handler(CommandHandler("start", self.start_command))
        self.app.add_handler(CommandHandler("help", self.help_command))
        self.app.add_handler(CommandHandler("rules", self.rules_command))
        self.app.add_handler(CommandHandler("support", self.support_command))
        self.app.add_handler(CommandHandler("download", self.download_command))
        
        # Обработчик текстовых сообщений для тех поддержки (ДОЛЖЕН быть ПОСЛЕДНИМ!)
        self.app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))
        
        # Дополнительное логирование
        logger.info("🔧 Все обработчики зарегистрированы")

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
                InlineKeyboardButton("💬 Техподдержка", callback_data="support"),
                InlineKeyboardButton("📋 Правила", callback_data="rules")
            ],
            [
                InlineKeyboardButton("ℹ️ Справка", callback_data="help"),
                InlineKeyboardButton("📥 Скачать файлы", callback_data="download")
            ]
        ]
        return InlineKeyboardMarkup(keyboard)

    async def button_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка нажатий на inline кнопки"""
        # КРИТИЧЕСКАЯ ПРОВЕРКА: есть ли callback_query
        if not update.callback_query:
            logger.error("❌ CRITICAL: update.callback_query is None!")
            return
            
        query = update.callback_query
        user = update.effective_user
        
        logger.info(f"🔘 CALLBACK ПОЛУЧЕН! Кнопка: '{query.data}' от {user.username or user.first_name} (ID: {user.id})")
        
        # Сначала отвечаем на callback query - ОБЯЗАТЕЛЬНО!
        try:
            await query.answer()
            logger.info(f"✅ Callback query answered для '{query.data}'")
        except Exception as e:
            logger.error(f"❌ КРИТИЧЕСКАЯ ОШИБКА query.answer(): {e}")
            # Пробуем повторно без параметров
            try:
                await query.answer()
            except Exception as e2:
                logger.error(f"❌ ПОВТОРНАЯ ОШИБКА query.answer(): {e2}")
                return
        
        # Обработка callback'ов
        try:
            if query.data == "rules":
                logger.info("📋 Обрабатываем кнопку 'Правила'")
                await query.edit_message_text(
                    "📋 <b>Правила BBI Father</b>\n\nЭто тестовое сообщение правил.\nКнопка работает!",
                    parse_mode='HTML',
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("🔙 Назад", callback_data="back_to_menu")
                    ]])
                )
            elif query.data == "support":
                logger.info("💬 Обрабатываем кнопку 'Техподдержка'")
                await query.edit_message_text(
                    f"💬 <b>Техподдержка</b>\n\nСвяжитесь с админом: @{ADMIN_USERNAME}",
                    parse_mode='HTML',
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton(f"✉️ Написать @{ADMIN_USERNAME}", url=f"https://t.me/{ADMIN_USERNAME}")
                    ], [
                        InlineKeyboardButton("🔙 Назад", callback_data="back_to_menu")
                    ]])
                )
            elif query.data == "help":
                logger.info("ℹ️ Обрабатываем кнопку 'Справка'")
                await query.edit_message_text(
                    "ℹ️ <b>Справка</b>\n\nЭто справочная информация.\nКнопка работает!",
                    parse_mode='HTML',
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("🔙 Назад", callback_data="back_to_menu")
                    ]])
                )
            elif query.data == "download":
                logger.info("📥 Обрабатываем кнопку 'Скачать файлы'")
                await query.edit_message_text(
                    "📥 <b>Скачивание файлов</b>\n\n"
                    "Для скачивания готовых файлов:\n"
                    "1. Откройте веб-приложение\n"
                    "2. Перейдите в раздел 'Мои заказы'\n"
                    "3. Нажмите кнопку скачивания у нужного заказа\n\n"
                    "Файлы также приходят в уведомлениях при готовности.",
                    parse_mode='HTML',
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("📱 Открыть приложение", web_app=WebAppInfo(url=WEB_APP_URL)),
                        InlineKeyboardButton("🔙 Назад", callback_data="back_to_menu")
                    ]])
                )
            elif query.data == "back_to_menu":
                logger.info("🔙 Возвращаемся в главное меню")
                user = update.effective_user
                welcome_text = f"""
👋 Привет, {user.first_name}!

Добро пожаловать в <b>BBI Father</b> - сервис для заказа практических работ!

🎓 Здесь вы можете:
• Заказать выполнение лабораторных работ
• Отслеживать статус ваших заказов  
• Получать готовые работы прямо в Telegram

Выберите действие из меню ниже:
                """.strip()
                
                keyboard = self.get_main_keyboard(user.username)
                await query.edit_message_text(welcome_text, reply_markup=keyboard, parse_mode='HTML')
            elif query.data.startswith("download_"):
                logger.info(f"📥 Обрабатываем скачивание заказа")
                order_id = query.data.split("_")[1]
                await query.edit_message_text(
                    f"📥 <b>Скачивание заказа #{order_id}</b>\n\n"
                    "Скачивание файлов теперь доступно в веб-приложении.\n"
                    "Откройте приложение и перейдите в раздел 'Мои заказы'.",
                    parse_mode='HTML',
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("📱 Открыть приложение", web_app=WebAppInfo(url=WEB_APP_URL)),
                        InlineKeyboardButton("🔙 Назад", callback_data="back_to_menu")
                    ]])
                )
            else:
                logger.warning(f"❓ Неизвестная кнопка: {query.data}")
                await query.edit_message_text("❓ Неизвестная команда")
                
        except Exception as e:
            logger.error(f"❌ КРИТИЧЕСКАЯ ОШИБКА в button_callback: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            try:
                await query.edit_message_text("❌ Произошла ошибка. Попробуйте позже.")
            except:
                pass

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
        """Обработка запроса в техподдержку - перенаправление к админу"""
        user = update.effective_user
        
        support_text = f"""
💬 <b>Техническая поддержка</b>

Привет, {user.first_name}! 

Для получения помощи свяжитесь с нашим администратором напрямую.

<b>Наша команда поможет с:</b>
• Техническими проблемами
• Вопросами по заказам  
• Изменением требований
• Возвратом средств

<b>⏰ Время ответа:</b> обычно до 1 часа в рабочее время

Нажмите кнопку ниже для связи с администратором 👇
        """
        
        keyboard = [
            [InlineKeyboardButton(
                f"✉️ Написать @{ADMIN_USERNAME}",
                url=f"https://t.me/{ADMIN_USERNAME}"
            )],
            [InlineKeyboardButton("🔙 Главное меню", callback_data="back_to_menu")]
        ]
        support_keyboard = InlineKeyboardMarkup(keyboard)
        
        if edit and update.callback_query:
            await update.callback_query.edit_message_text(
                support_text,
                reply_markup=support_keyboard,
                parse_mode='HTML'
            )
        else:
            await update.message.reply_text(
                support_text,
                reply_markup=support_keyboard,
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
🕐 <b>Время:</b> сейчас

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
• Нажмите "📥 Скачать файлы" в главном меню

<b>🔄 Если нужны исправления:</b>
• Откройте готовую работу в приложении
• Нажмите "Нужны исправления"
• Опишите что нужно изменить
• Получите исправленную версию бесплатно

<b>💬 Нужна помощь?</b>
Свяжитесь с администратором через "Техподдержка"
        """
        
        back_keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("🔙 Главное меню", callback_data="back_to_menu")]
        ])
        
        if edit and update.callback_query:
            await update.callback_query.edit_message_text(
                guide_text,
                reply_markup=back_keyboard,
                parse_mode='HTML'
            )
        else:
            await update.message.reply_text(
                guide_text,
                reply_markup=back_keyboard,
                parse_mode='HTML'
            )


    async def download_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Команда /download для скачивания файлов"""
        await update.message.reply_text(
            "📥 <b>Скачивание файлов</b>\n\n"
            "Для скачивания готовых файлов:\n"
            "1. Откройте веб-приложение\n" 
            "2. Перейдите в раздел 'Мои заказы'\n"
            "3. Нажмите кнопку скачивания у нужного заказа\n\n"
            "Файлы также приходят в уведомлениях при готовности.",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("📱 Открыть приложение", web_app=WebAppInfo(url=WEB_APP_URL))
            ]])
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
            
        if ADMIN_CHAT_ID:
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
