#!/bin/bash

# Скрипт запуска для продакшена
echo "🚀 Запуск BBI Father Backend..."

# Проверяем переменные окружения
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "❌ Ошибка: SUPABASE_URL и SUPABASE_KEY должны быть установлены!"
    exit 1
fi

echo "✅ Переменные окружения настроены"

# Запускаем приложение
if [ "$ENVIRONMENT" = "development" ]; then
    echo "🔧 Режим разработки"
    python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
else
    echo "🏭 Продакшен режим"
    gunicorn -c gunicorn.conf.py main:app
fi