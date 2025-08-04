# 🚀 СУПЕР ПРОСТОЙ деплой за 10 минут

**Минимальная инструкция без лишних движений**

---

## 📦 Шаг 1: Подготовка (2 минуты)

```bash
# Подключитесь к серверу
ssh root@your-server-ip

# Установите всё одной командой
apt update && apt install -y python3 python3-pip nodejs npm nginx git

# Скачайте проект
cd /var/www
git clone https://github.com/rufkndev/bbifatherSPA.git bbifather
cd bbifather
```

---

## 🐍 Шаг 2: Запуск бэкенда (2 минуты)

```bash
cd backend

# Установите зависимости ГЛОБАЛЬНО (проще чем venv)
pip3 install fastapi uvicorn requests gunicorn python-multipart

# Создайте папку для данных
mkdir -p /var/www/bbifather/data/uploads

# Запустите бэкенд в фоне (БЕЗ systemd)
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > ../logs/backend.log 2>&1 & echo "Бэкенд запущен!"
```

---

## 🤖 Шаг 3: Запуск бота (1 минута)

```bash
cd ../bot

# Запустите бота в фоне
nohup python3 bot.py > ../logs/bot.log 2>&1 &

echo "Бот запущен!"
```

---

## ⚛️ Шаг 4: Фронтенд (3 минуты)

```bash
cd ../frontend

# Соберите фронтенд
npm install
npm run build

# Скопируйте в nginx
cp -r build/* /var/www/html/
```

---

## 🌐 Шаг 5: Nginx (2 минуты)

```bash
# Замените ВЕСЬ файл nginx конфигурации одной командой
cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80 default_server;
    root /var/www/html;
    index index.html;
    
    location / {
        try_files $uri /index.html;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
    }
}
EOF

# Перезапустите nginx
systemctl restart nginx

echo "Готово!"
```

---

## ✅ Всё! Сайт работает!

Откройте `http://your-server-ip` в браузере.

### Проверка что всё работает:
```bash
# Проверьте процессы
ps aux | grep python
ps aux | grep nginx

# Проверьте логи
tail /var/www/bbifather/logs/backend.log
tail /var/www/bbifather/logs/bot.log
```

### Перезапуск после перезагрузки сервера:
```bash
cd /var/www/bbifather
mkdir -p logs

# Перезапуск всего одной командой
cd backend && nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > ../logs/backend.log 2>&1 &
cd ../bot && nohup python3 bot.py > ../logs/bot.log 2>&1 &
```

---

## 🔄 Обновление кода:
```bash
cd /var/www/bbifather
git pull
cd frontend && npm run build && cp -r build/* /var/www/html/
pkill -f "uvicorn main:app"
pkill -f "bot.py"
cd backend && nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > ../logs/backend.log 2>&1 &
cd ../bot && nohup python3 bot.py > ../logs/bot.log 2>&1 &
```

**Вот и всё! 🎉**