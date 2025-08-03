#!/bin/bash

# Альтернативный скрипт установки через snap

set -e

echo "🚀 Альтернативная установка BBIFather SPA..."

# Проверяем права root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт от имени root: sudo ./install-alt.sh"
    exit 1
fi

# Устанавливаем зависимости
echo "📦 Установка зависимостей..."
apt update

# Устанавливаем Python, Nginx и Certbot
apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx snapd

# Устанавливаем Node.js через snap
echo "📦 Установка Node.js через snap..."
snap install node --classic

# Создаем директории
echo "📁 Создание директорий..."
mkdir -p /var/www/bbifather
mkdir -p /var/www/bbifather/data

# Копируем файлы проекта
echo "📋 Копирование файлов..."
cp -r backend /var/www/bbifather/
cp -r bot /var/www/bbifather/
cp -r frontend /var/www/bbifather/

# Устанавливаем Python зависимости для бэкенда
echo "🐍 Установка Python зависимостей для бэкенда..."
cd /var/www/bbifather/backend
pip3 install -r requirements.txt

# Устанавливаем Python зависимости для бота
echo "🤖 Установка Python зависимостей для бота..."
cd /var/www/bbifather/bot
pip3 install -r requirements.txt

# Собираем фронтенд
echo "⚙️ Сборка фронтенда..."
cd /var/www/bbifather/frontend
npm install
GENERATE_SOURCEMAP=false npm run build

# Настраиваем права доступа
echo "🔐 Настройка прав доступа..."
chown -R www-data:www-data /var/www/bbifather
chmod -R 755 /var/www/bbifather

# Устанавливаем systemd сервисы
echo "⚙️ Установка systemd сервисов..."
cp bbifather-backend.service /etc/systemd/system/
cp bbifather-bot.service /etc/systemd/system/

# Настраиваем Nginx
echo "🌐 Настройка Nginx..."
cp nginx-site.conf /etc/nginx/sites-available/bbifather.ru
ln -sf /etc/nginx/sites-available/bbifather.ru /etc/nginx/sites-enabled/
nginx -t

echo "✅ Установка завершена!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Отредактируйте файлы сервисов:"
echo "   - /etc/systemd/system/bbifather-backend.service"
echo "   - /etc/systemd/system/bbifather-bot.service"
echo "   Укажите ваши TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID"
echo ""
echo "2. Получите SSL сертификат:"
echo "   certbot --nginx -d bbifather.ru -d www.bbifather.ru"
echo ""
echo "3. Запустите сервисы:"
echo "   systemctl daemon-reload"
echo "   systemctl enable bbifather-backend bbifather-bot"
echo "   systemctl start bbifather-backend bbifather-bot"
echo "   systemctl reload nginx"