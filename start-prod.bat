@echo off
echo 🚀 Запуск BBIFather SPA в продакшене...

REM Проверяем наличие .env файла
if not exist .env (
    echo ❌ Файл .env не найден!
    echo Создайте файл .env на основе .env.example
    pause
    exit /b 1
)

REM Создаем необходимые директории
if not exist data\certbot\conf mkdir data\certbot\conf
if not exist data\certbot\www mkdir data\certbot\www

echo 📦 Сборка и запуск контейнеров...
docker-compose -f docker-compose.prod.yml up --build -d

echo ✅ Приложение запущено!
echo 🌐 HTTP: http://bbifather.ru:8080
echo 🔒 HTTPS: https://bbifather.ru:8443
echo.
echo 📋 Полезные команды:
echo   Просмотр логов: docker-compose -f docker-compose.prod.yml logs -f
echo   Остановка: docker-compose -f docker-compose.prod.yml down
echo   Перезапуск: docker-compose -f docker-compose.prod.yml restart
pause