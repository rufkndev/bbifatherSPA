#!/bin/bash

# Скрипт для запуска приложения в продакшене

echo "🚀 Запуск BBIFather SPA в продакшене..."

# Проверяем наличие .env файла
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    echo "Создайте файл .env на основе .env.example"
    exit 1
fi

# Создаем необходимые директории
mkdir -p data/certbot/conf
mkdir -p data/certbot/www

echo "📦 Сборка и запуск контейнеров..."
docker-compose -f docker-compose.prod.yml up --build -d

echo "✅ Приложение запущено!"
echo "🌐 HTTP: http://bbifather.ru:8080"
echo "🔒 HTTPS: https://bbifather.ru:8443"
echo ""
echo "📋 Полезные команды:"
echo "  Просмотр логов: docker-compose -f docker-compose.prod.yml logs -f"
echo "  Остановка: docker-compose -f docker-compose.prod.yml down"
echo "  Перезапуск: docker-compose -f docker-compose.prod.yml restart"