#!/usr/bin/env python3
"""
Telegram Bot для BBI Father
Основной бот с Web App интеграцией
"""

import os
import asyncio
import logging
import requests
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
ADMIN_USERNAME = os.getenv("TELEGRAM_ADMIN_USERNAME", "bbifatheradmin")  # Username администратора
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
        self.app.add_handler(CommandHandler("download", self.download_command))
        
        # Обработчик нажатий на кнопки (ВАЖНО: должен быть первым среди CallbackQuery!)
        self.app.add_handler(CallbackQueryHandler(self.button_callback))
        
        # Обработчик текстовых сообщений для тех поддержки
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
        query = update.callback_query
        user = update.effective_user
        
        logger.info(f"🔘 CALLBACK ПОЛУЧЕН! Кнопка: {query.data} от {user.username or user.first_name}")
        
        # Сначала отвечаем на callback query
        try:
            await query.answer()
            logger.info(f"✅ Callback query answered для {query.data}")
        except Exception as e:
            logger.error(f"❌ Ошибка ответа на callback: {e}")
            return
        
        # Простая обработка для тестирования
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
                logger.info("📥 Обрабатываем кнопку 'Скачать'")
                await query.edit_message_text(
                    "📥 <b>Скачивание файлов</b>\n\nФункция в разработке.\nКнопка работает!",
                    parse_mode='HTML',
                    reply_markup=InlineKeyboardMarkup([[
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

    async def handle_download_request(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка запроса на скачивание файлов"""
        user = update.effective_user
        user_telegram = user.username
        
        if not user_telegram:
            await update.callback_query.answer("❌ У вас не указан username в Telegram!")
            return
            
        try:
            # Получаем заказы пользователя с готовыми файлами
            response = requests.get(
                f"{API_BASE_URL}/orders",
                params={'telegram': user_telegram, 'limit': 50}
            )
            
            if response.status_code == 200:
                data = response.json()
                orders_with_files = [
                    order for order in data['orders'] 
                    if order.get('status') == 'completed' and order.get('files')
                ]
                
                if not orders_with_files:
                    await update.callback_query.edit_message_text(
                        "📭 У вас пока нет готовых работ для скачивания.\n\n"
                        "Готовые файлы появятся здесь после завершения заказов.",
                        reply_markup=InlineKeyboardMarkup([
                            [InlineKeyboardButton("🔙 Главное меню", callback_data="back_to_menu")]
                        ])
                    )
                    return
                
                # Создаем кнопки для каждого заказа
                keyboard = []
                for order in orders_with_files[:10]:  # Показываем максимум 10 заказов
                    keyboard.append([InlineKeyboardButton(
                        f"📥 {order['title'][:30]}... (#{order['id']})",
                        callback_data=f"download_{order['id']}"
                    )])
                
                keyboard.append([InlineKeyboardButton("🔙 Главное меню", callback_data="back_to_menu")])
                
                await update.callback_query.edit_message_text(
                    f"📥 <b>Доступные для скачивания работы:</b>\n\n"
                    f"Найдено {len(orders_with_files)} готовых работ.\n"
                    f"Выберите заказ для скачивания файлов:",
                    reply_markup=InlineKeyboardMarkup(keyboard),
                    parse_mode='HTML'
                )
            else:
                await update.callback_query.edit_message_text(
                    "❌ Ошибка при получении списка заказов. Попробуйте позже.",
                    reply_markup=InlineKeyboardMarkup([
                        [InlineKeyboardButton("🔙 Главное меню", callback_data="back_to_menu")]
                    ])
                )
                
        except Exception as e:
            logger.error(f"Ошибка при обработке запроса скачивания: {e}")
            await update.callback_query.edit_message_text(
                "❌ Произошла ошибка. Попробуйте позже.",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("🔙 Главное меню", callback_data="back_to_menu")]
                ])
            )

    async def download_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Команда /download для скачивания файлов"""
        await self.handle_download_request(update, context)

    async def send_order_files(self, update: Update, context: ContextTypes.DEFAULT_TYPE, order_id: int):
        """Отправка файлов заказа пользователю"""
        try:
            # Получаем информацию о заказе
            response = requests.get(f"{API_BASE_URL}/orders/{order_id}")
            
            if response.status_code != 200:
                await update.callback_query.edit_message_text(
                    "❌ Заказ не найден или недоступен.",
                    reply_markup=InlineKeyboardMarkup([
                        [InlineKeyboardButton("🔙 Главное меню", callback_data="back_to_menu")]
                    ])
                )
                return
            
            order = response.json()
            files = order.get('files', [])
            
            if not files:
                await update.callback_query.edit_message_text(
                    f"📭 В заказе #{order_id} пока нет файлов.",
                    reply_markup=InlineKeyboardMarkup([
                        [InlineKeyboardButton("🔙 Главное меню", callback_data="back_to_menu")]
                    ])
                )
                return
            
            # Отправляем сообщение о начале отправки файлов
            await update.callback_query.edit_message_text(
                f"📤 <b>Отправляем файлы для заказа #{order_id}</b>\n\n"
                f"📝 <b>Название:</b> {order['title']}\n"
                f"📁 <b>Файлов:</b> {len(files)}\n\n"
                f"Пожалуйста, подождите...",
                parse_mode='HTML'
            )
            
            # Отправляем каждый файл
            files_sent = 0
            for filename in files:
                try:
                    # Скачиваем файл с сервера
                    file_response = requests.get(
                        f"{API_BASE_URL}/orders/{order_id}/download/{filename}",
                        stream=True
                    )
                    
                    if file_response.status_code == 200:
                        # Отправляем файл пользователю
                        await context.bot.send_document(
                            chat_id=update.effective_user.id,
                            document=file_response.content,
                            filename=filename,
                            caption=f"📎 Файл из заказа #{order_id}: {order['title']}"
                        )
                        files_sent += 1
                        
                except Exception as file_error:
                    logger.error(f"Ошибка отправки файла {filename}: {file_error}")
                    await context.bot.send_message(
                        chat_id=update.effective_user.id,
                        text=f"❌ Не удалось отправить файл: {filename}"
                    )
            
            # Итоговое сообщение
            if files_sent > 0:
                final_message = (
                    f"✅ <b>Файлы успешно отправлены!</b>\n\n"
                    f"📝 <b>Заказ:</b> #{order_id} - {order['title']}\n"
                    f"📁 <b>Отправлено файлов:</b> {files_sent} из {len(files)}\n\n"
                    f"Все файлы сохранены в чате выше 👆"
                )
            else:
                final_message = (
                    f"❌ <b>Не удалось отправить файлы</b>\n\n"
                    f"Попробуйте позже или обратитесь в техподдержку."
                )
            
            await context.bot.send_message(
                chat_id=update.effective_user.id,
                text=final_message,
                parse_mode='HTML',
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("🔙 Главное меню", callback_data="back_to_menu")]
                ])
            )
                
        except Exception as e:
            logger.error(f"Ошибка при отправке файлов заказа {order_id}: {e}")
            await context.bot.send_message(
                chat_id=update.effective_user.id,
                text="❌ Произошла ошибка при отправке файлов. Попробуйте позже.",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("🔙 Главное меню", callback_data="back_to_menu")]
                ])
            )

    @staticmethod
    async def send_status_notification(user_telegram: str, order_id: int, status: str, order_title: str):
        """Статический метод для отправки уведомлений о статусе пользователям"""
        try:
            status_messages = {
                'paid': '💳 Оплата подтверждена! Ваш заказ принят в работу.',
                'in_progress': '⚙️ Работа началась! Мы приступили к выполнению вашего заказа.',
                'completed': '✅ Работа выполнена! Готовые файлы доступны в приложении и боте.',
                'needs_revision': '🔄 Требуются исправления. Проверьте детали в приложении.',
            }
            
            status_message = status_messages.get(status)
            if not status_message:
                return
            
            # Получаем user_id по username
            bot_token = BOT_TOKEN
            
            # Сначала пробуем найти пользователя через getUpdates или используем username напрямую
            message_text = f"""
🔔 <b>Обновление по заказу #{order_id}</b>

📝 <b>Заказ:</b> {order_title}
📊 <b>Статус:</b> {status_message}

Детали заказа доступны в приложении и боте 👇

Нажмите /start чтобы открыть меню
            """.strip()
            
            # Отправляем уведомление через Telegram API
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            
            # Пробуем отправить по username (если начинается с @, убираем его)
            clean_username = user_telegram.lstrip('@')
            
            payload = {
                'chat_id': f'@{clean_username}',
                'text': message_text,
                'parse_mode': 'HTML'
            }
            
            response = requests.post(url, json=payload, timeout=10)
            
            if response.status_code == 200:
                logger.info(f"✅ Уведомление отправлено пользователю @{clean_username}")
            else:
                logger.warning(f"⚠️ Не удалось отправить уведомление @{clean_username}: {response.text}")
                
        except Exception as e:
            logger.error(f"❌ Ошибка отправки уведомления пользователю {user_telegram}: {e}")

    def run(self):
        """Запуск бота"""
        logger.info("🤖 Запуск BBI Father Telegram Bot...")
        try:
            # Запускаем polling в синхронном режиме
            self.app.run_polling(drop_pending_updates=True)
        except KeyboardInterrupt:
            logger.info("👋 Бот остановлен пользователем")
        except Exception as e:
            logger.error(f"❌ Ошибка при запуске: {e}")
            raise


def main():
    """Главная функция"""
    try:
        logger.info("🚀 Инициализация BBI Father Telegram Bot...")
        bot = BBIFatherBot()
        logger.info("🤖 BBI Father Telegram Bot запущен успешно!")
        
        # Проверяем зарегистрированные handlers
        handlers = bot.app.handlers
        logger.info(f"📋 Зарегистрировано handlers: {len(handlers[0])} в группе 0")
        
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
