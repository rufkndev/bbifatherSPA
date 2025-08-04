# 🎓 BBI Father - Система заказов практических работ

Современная веб-система для заказа и управления практическими работами студентов с интеграцией Supabase и Telegram уведомлениями.

## ✨ Основные возможности

- 📝 **Создание заказов** - удобная пошаговая форма для студентов
- 👥 **Управление студентами** - автоматическое создание профилей
- 📚 **Каталог предметов** - настраиваемый список дисциплин
- 💰 **Расчет стоимости** - гибкая система ценообразования
- 📁 **Загрузка файлов** - прикрепление выполненных работ
- 📱 **Telegram уведомления** - мгновенные уведомления администратору
- 🔄 **Система исправлений** - запрос доработок через интерфейс
- 💳 **Отслеживание оплат** - уведомления об оплате студентами

## 🏗️ Архитектура

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   React Frontend    │───▶│   FastAPI Backend   │───▶│   Supabase DB       │
│   (TypeScript)      │    │   (Python)          │    │   (PostgreSQL)      │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
                                      │
                                      ▼
                           ┌─────────────────────┐
                           │  Telegram API       │
                           │  (Уведомления)      │
                           └─────────────────────┘
```

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 18+
- Python 3.8+
- Аккаунт в [Supabase](https://supabase.com)

### 1. Клонирование репозитория

```bash
git clone https://github.com/yourusername/bbifatherSPA.git
cd bbifatherSPA
```

### 2. Настройка Supabase

1. Создайте проект в [Supabase Dashboard](https://app.supabase.com)
2. Выполните SQL команды из файла `DEPLOYMENT_GUIDE.md` для создания таблиц
3. Получите Project URL и API Key

### 3. Настройка Backend

```bash
cd backend

# Создание виртуального окружения
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate     # Windows

# Установка зависимостей
pip install -r requirements.txt

# Создание .env файла
cp .env.example .env
# Отредактируйте .env файл с вашими настройками
```

### 4. Настройка Frontend

```bash
cd frontend

# Установка зависимостей
npm install

# Настройка API URL в src/api.ts если нужно
```

### 5. Запуск для разработки

```bash
# Backend (в одном терминале)
cd backend
source venv/bin/activate
python main.py

# Frontend (в другом терминале)
cd frontend
npm start
```

Приложение будет доступно по адресу: http://localhost:3000

## 📦 Структура проекта

```
bbifatherSPA/
├── backend/                 # FastAPI Backend
│   ├── main.py             # Основное приложение
│   ├── requirements.txt    # Python зависимости
│   ├── gunicorn.conf.py   # Конфигурация для продакшена
│   ├── start.sh           # Скрипт запуска
│   └── .env.example       # Пример переменных окружения
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── components/    # React компоненты
│   │   ├── data/         # Данные предметов
│   │   ├── api.ts        # API клиент
│   │   └── types.ts      # TypeScript типы
│   ├── package.json      # Node.js зависимости
│   └── tsconfig.json     # TypeScript конфигурация
├── DEPLOYMENT_GUIDE.md    # Подробный гайд по деплою
└── README.md             # Этот файл
```

## 🛠️ Технологии

### Backend
- **FastAPI** - современный веб-фреймворк для Python
- **Supabase** - Backend-as-a-Service на базе PostgreSQL
- **Uvicorn/Gunicorn** - ASGI сервер для продакшена
- **Requests** - HTTP клиент для Telegram API

### Frontend
- **React 18** - пользовательский интерфейс
- **TypeScript** - типизированный JavaScript
- **Material-UI** - компоненты дизайна
- **React Router** - навигация
- **Date-fns** - работа с датами

### База данных
- **PostgreSQL** (через Supabase) - основная база данных
- **Row Level Security** - политики безопасности
- **Автоматические триггеры** - обновление временных меток

## 🌐 Деплой на продакшен

Подробное руководство по деплою находится в файле [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md).

### Краткая инструкция:

1. Настройте Supabase проект и создайте таблицы
2. Подготовьте сервер (Ubuntu/CentOS)
3. Настройте домен и SSL
4. Деплойте backend через PM2
5. Соберите и разместите frontend
6. Настройте Nginx как reverse proxy

## 📱 Telegram интеграция

### Настройка бота:

1. Создайте бота через [@BotFather](https://t.me/botfather)
2. Получите токен бота
3. Найдите свой Chat ID
4. Добавьте данные в `.env` файл:

```env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

### Типы уведомлений:

- 🆕 **Новый заказ** - при создании заказа студентом
- 💰 **Уведомление об оплате** - когда студент отмечает оплату
- 🔄 **Запрос исправлений** - при запросе доработок

## 🔧 API Endpoints

### Основные endpoints:

- `GET /api/subjects` - получить список предметов
- `GET /api/orders` - получить заказы (с пагинацией)
- `POST /api/orders` - создать новый заказ
- `PATCH /api/orders/{id}/status` - обновить статус заказа
- `POST /api/orders/{id}/files` - загрузить файлы к заказу
- `POST /api/orders/{id}/payment-notification` - уведомить об оплате

### Тестирование:

```bash
# Проверка работы API
curl https://your-domain.com/api/subjects

# Тест уведомлений
curl -X POST https://your-domain.com/api/test-notification
```

## 📊 Мониторинг

### Production мониторинг:

```bash
# Статус приложений PM2
pm2 status

# Логи приложения
pm2 logs bbifather-backend

# Логи Nginx
sudo tail -f /var/log/nginx/bbifather_access.log
```

## 🤝 Участие в разработке

1. Создайте форк репозитория
2. Создайте ветку для изменений (`git checkout -b feature/amazing-feature`)
3. Зафиксируйте изменения (`git commit -m 'Add amazing feature'`)
4. Отправьте в ветку (`git push origin feature/amazing-feature`)
5. Создайте Pull Request

## 📄 Лицензия

Этот проект распространяется под лицензией MIT. Подробности в файле [LICENSE](LICENSE).

## 💬 Поддержка

Если у вас есть вопросы или проблемы:

1. Проверьте [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) для решения типичных проблем
2. Создайте [Issue](https://github.com/yourusername/bbifatherSPA/issues) в репозитории
3. Напишите в Telegram: [@artemonnnnnnn](https://t.me/artemonnnnnnn)

---

**Сделано с ❤️ для студентов BBI**