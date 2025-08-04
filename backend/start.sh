#!/bin/bash

# Скрипт запуска для продакшена
echo "🚀 Запуск BBI Father Backend..."

# Переходим в директорию backend
cd "$(dirname "$0")"

# Загружаем переменные из .env файла если он существует
if [ -f .env ]; then
    echo "📁 Загружаем переменные из .env файла..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️ Файл .env не найден!"
fi

# Проверяем переменные окружения
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "❌ Ошибка: SUPABASE_URL и SUPABASE_KEY должны быть установлены!"
    echo "💡 Создайте файл .env с необходимыми переменными"
    exit 1
fi

echo "✅ Переменные окружения настроены"

# Активируем виртуальное окружение если оно существует
if [ -d "venv" ]; then
    echo "🐍 Активируем виртуальное окружение..."
    source venv/bin/activate
fi

# Запускаем приложение
if [ "$ENVIRONMENT" = "development" ]; then
    echo "🔧 Режим разработки"
    python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
else
    echo "🏭 Продакшен режим"
    gunicorn -c gunicorn.conf.py main:app
fi