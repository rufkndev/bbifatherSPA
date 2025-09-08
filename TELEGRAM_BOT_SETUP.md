# 🤖 Настройка Telegram Bot для BBI Father

## Шаг 1: Создание бота в Telegram

1. Найдите @BotFather в Telegram
2. Отправьте команду `/newbot`
3. Выберите имя для бота: `BBI Father Bot`
4. Выберите username: `bbifather_bot` (должен заканчиваться на `bot`)
5. Сохраните полученный токен бота

## Шаг 2: Настройка Web App

1. Отправьте @BotFather команду `/mybots`
2. Выберите вашего бота
3. Выберите `Bot Settings` → `Menu Button` → `Configure Menu Button`
4. Введите URL: `https://bbifather.ru`
5. Введите текст: `📱 Открыть приложение`

Или выполните команды:
```
/setmenubutton
@your_bot_username
https://bbifather.ru
📱 Открыть приложение
```

## Шаг 3: Настройка переменных окружения

Добавьте в ваш `.env` файл:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID=your_admin_chat_id_for_notifications
TELEGRAM_ADMIN_CHAT_ID=your_admin_chat_id_for_support

# Web App Configuration  
WEB_APP_URL=https://bbifather.ru
```

### Как получить CHAT_ID:

1. Отправьте сообщение вашему боту
2. Откройте в браузере: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Найдите `"chat":{"id":123456789}` - это и есть ваш CHAT_ID

## Шаг 4: Установка зависимостей

```bash
pip install -r bot_requirements.txt
```

## Шаг 5: Запуск бота

### Для разработки:
```bash
python bot.py
```

### Для продакшена (с PM2):
```bash
# Установка PM2 (если не установлен)
npm install -g pm2

# Запуск бота
pm2 start bot.py --name telegram-bot --interpreter python3

# Просмотр логов
pm2 logs telegram-bot

# Перезапуск
pm2 restart telegram-bot
```

## Шаг 6: Настройка команд бота

Отправьте @BotFather команду `/setcommands` и выберите вашего бота, затем отправьте:

```
start - 🏠 Главное меню
help - ❓ Справка по боту  
rules - 📋 Правила использования
support - 💬 Техническая поддержка
```

## Шаг 7: Проверка работы

1. Найдите вашего бота в Telegram
2. Нажмите `/start`
3. Убедитесь, что появилось меню с кнопками
4. Нажмите "📱 Открыть приложение" - должно открыться ваше веб-приложение
5. Проверьте автоматическую авторизацию

## Структура проекта

```
├── bot.py                 # Основной файл бота
├── bot_requirements.txt   # Зависимости для бота
├── frontend/
│   ├── public/
│   │   └── index.html    # Добавлен Telegram WebApp SDK
│   └── src/
│       └── hooks/
│           └── useTelegramWebApp.ts  # Хук для работы с WebApp
├── backend/
│   └── main.py          # API сервер (уже настроен)
```

## Возможности бота

### 🤖 Основные команды:
- `/start` - Главное меню с кнопками
- `/help` - Справка по использованию
- `/rules` - Правила работы сервиса
- `/support` - Техподдержка

### 📱 Web App функции:
- Автоматическая авторизация через Telegram
- Автозаполнение данных пользователя
- Тактильная обратная связь (вибрация)
- Нативные уведомления Telegram
- Back Button интеграция

### 💬 Техподдержка:
- Пересылка сообщений администратору
- Автоматические уведомления
- Контекстная информация о пользователе

## Диагностика проблем

### Бот не отвечает:
- Проверьте правильность токена
- Убедитесь что бот запущен: `pm2 status`
- Проверьте логи: `pm2 logs telegram-bot`

### Web App не открывается:
- Проверьте URL в настройках бота
- Убедитесь что сайт работает по HTTPS
- Проверьте переменную `WEB_APP_URL`

### Автоматическая авторизация не работает:
- Проверьте что добавлен Telegram WebApp SDK
- Убедитесь что приложение открыто именно через бота
- Проверьте консоль браузера на ошибки

## Мониторинг

```bash
# Статус всех процессов
pm2 status

# Подробная информация
pm2 info telegram-bot

# Мониторинг в реальном времени
pm2 monit
```
