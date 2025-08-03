#!/bin/bash

# Скрипт для сборки фронтенда

echo "🔨 Сборка фронтенда..."

cd frontend

# Проверяем наличие node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 Устанавливаем зависимости..."
    npm install
fi

# Собираем проект
echo "⚙️ Сборка проекта..."
GENERATE_SOURCEMAP=false npm run build

echo "✅ Фронтенд собран в папку frontend/build"