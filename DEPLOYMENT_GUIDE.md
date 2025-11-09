# 🚀 Гайд по деплою BBI Father на сервер

Подробное руководство по развертыванию веб-приложения BBI Father на продакшен сервере с использованием Supabase, Nginx и PM2.

## 📋 Содержание

1. [Предварительные требования](#предварительные-требования)
2. [Настройка Supabase](#настройка-supabase)
3. [Подготовка сервера](#подготовка-сервера)
4. [Деплой backend](#деплой-backend)
5. [Деплой frontend](#деплой-frontend)
6. [Настройка Nginx](#настройка-nginx)
7. [Настройка SSL](#настройка-ssl)
8. [Telegram уведомления](#telegram-уведомления)
9. [Мониторинг и обслуживание](#мониторинг-и-обслуживание)

## 🔧 Предварительные требования

### Сервер
- Ubuntu 20.04+ или CentOS 8+
- Минимум 1GB RAM, 1 CPU
- Доступ по SSH
- Доменное имя (например, `bbifather.ru`)

### Локальная машина
- Node.js 18+
- Git
- SSH доступ к серверу

## 🗃️ Настройка Supabase

### 1. Создание проекта в Supabase

1. Зайдите на [supabase.com](https://supabase.com)
2. Создайте новый проект
3. Дождитесь завершения настройки (2-3 минуты)
4. Сохраните:
   - Project URL
   - Anon public key
   - Service role key (для админских операций)

### 2. Создание таблиц в базе данных

Зайдите в SQL Editor в Supabase Dashboard и выполните следующие запросы:

```sql
-- Создание таблицы студентов
CREATE TABLE IF NOT EXISTS students (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    group_name TEXT,
    telegram TEXT,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание таблицы предметов
CREATE TABLE IF NOT EXISTS subjects (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание таблицы заказов
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id),
    subject_id BIGINT NOT NULL REFERENCES subjects(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    input_data TEXT,
    variant_info TEXT,
    deadline DATE NOT NULL,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'waiting_payment', 'paid', 'in_progress', 'completed', 'needs_revision')),
    is_paid BOOLEAN DEFAULT false,
    files JSONB,
    selected_works JSONB,
    is_full_course BOOLEAN DEFAULT false,
    actual_price DECIMAL(10,2) DEFAULT 0.0,
    revision_comment TEXT,
    revision_grade TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание индексов для производительности
CREATE INDEX IF NOT EXISTS idx_orders_student_id ON orders(student_id);
CREATE INDEX IF NOT EXISTS idx_orders_subject_id ON orders(subject_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_telegram ON students(telegram);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для обновления updated_at в таблице orders
CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Обновление допустимых статусов заказов (добавляем 'queued' и 'under_review')
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
    CHECK (status IN ('new', 'waiting_payment', 'paid', 'in_progress', 'completed', 'needs_revision', 'queued', 'under_review'));

-- Если у ограничения статусa не было имени и DROP выше не сработал:
-- Найдите имя CHECK-ограничения и удалите его
-- (выполните, посмотрите conname, затем подставьте его в DROP CONSTRAINT)
SELECT conname 
FROM pg_constraint c 
JOIN pg_class t ON c.conrelid = t.oid 
WHERE t.relname = 'orders' AND c.contype = 'c';
-- Пример:
-- ALTER TABLE public.orders DROP CONSTRAINT orders_status_check_legacy;
-- После удаления — добавьте новое, как выше

-- Добавление базовых предметов
INSERT INTO subjects (name, description, price) VALUES
    ('Летняя практика', 'Системный анализ предприятия, архитектурное моделирование, управление проектами', 2500.0),
    ('Статистические методы', 'Практические работы по статистическим методам', 2000.0),
    ('ПУП', 'Практики, ИКР, рефераты по проектированию программного обеспечения', 2200.0),
    ('Цифровая экономика', 'Практические и лабораторные работы по цифровой экономике', 1800.0),
    ('Моделирование бизнес-процессов', 'Практические работы по моделированию БП', 2000.0),
    ('Другой предмет', 'Индивидуальное задание по другому предмету', 1500.0)
ON CONFLICT DO NOTHING;
```

### 3. Настройка RLS (Row Level Security)

Для безопасности настройте политики доступа:

```sql
-- Включаем RLS для всех таблиц
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Политики для публичного доступа (можно ограничить)
CREATE POLICY "Allow all for service role" ON students FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow all for service role" ON subjects FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow all for service role" ON orders FOR ALL USING (auth.role() = 'service_role');

-- Политики для анонимного доступа (только чтение предметов и создание заказов)
CREATE POLICY "Allow read subjects" ON subjects FOR SELECT USING (is_active = true);
CREATE POLICY "Allow insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read own orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Allow update own orders" ON orders FOR UPDATE USING (true);
CREATE POLICY "Allow insert students" ON students FOR INSERT WITH CHECK (true);
```

## 🖥️ Подготовка сервера

### 1. Подключение к серверу

```bash
ssh root@your-server-ip
```

### 2. Обновление системы

```bash
# Ubuntu/Debian
apt update && apt upgrade -y

# CentOS/RHEL
yum update -y
```

### 3. Установка необходимых пакетов

```bash
# Ubuntu/Debian
apt install -y curl wget git nginx certbot python3-certbot-nginx

# CentOS/RHEL
yum install -y curl wget git nginx certbot python3-certbot-nginx
```

### 4. Установка Node.js и npm

```bash
# Устанавливаем NodeSource репозиторий
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# Проверяем установку
node --version
npm --version
```

### 5. Установка Python и pip

```bash
apt install -y python3 python3-pip python3-venv
```

### 6. Установка PM2 для управления процессами

```bash
npm install -g pm2
```

## 🔙 Деплой Backend

### 1. Создание пользователя для приложения

```bash
useradd -m -s /bin/bash bbifather
usermod -aG sudo bbifather
```

### 2. Клонирование и настройка проекта

```bash
# Переключаемся на пользователя bbifather
su - bbifather

# Клонируем проект
git clone https://github.com/rufkndev/bbifatherSPA.git
cd bbifatherSPA

# Переходим в backend
cd backend
```

### 3. Создание виртуального окружения

```bash
python3 -m venv venv
source venv/bin/activate
```

### 4. Установка зависимостей

```bash
pip install -r requirements.txt
```

### 5. Настройка переменных окружения

```bash
# Создаем .env файл
nano .env
```

Содержимое `.env`:

```env
# Supabase настройки
SUPABASE_URL=https://yvtobwpaxdgvvobhaymq.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2dG9id3BheGRndnZvYmhheW1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5MTksImV4cCI6MjA2OTg4NDkxOX0.yrfE7RBIoMfrhRWD2ptU9pyerTvxwXHW_y6V3FzNi80

# Telegram Bot настройки (опционально)
TELEGRAM_BOT_TOKEN=7582178055:AAFcTdIt3g1LiJ-6-W0QDR1p1MPm9LkSFCY
TELEGRAM_CHAT_ID=814032949
# Отдельный чат для уведомлений по предмету ERP (можно изменить)
TELEGRAM_ERP_CHAT_ID=814032949

# Frontend URLs для CORS
FRONTEND_URLS=https://bbifather.ru,https://www.bbifather.ru

# Режим работы
ENVIRONMENT=production
```

### 6. Тестирование backend

```bash
# Активируем виртуальное окружение
source venv/bin/activate

# Тестовый запуск
python main.py
```

Откройте в браузере `http://your-server-ip:8000` - должно появиться сообщение "Student Orders API is running".

### 7. Настройка PM2 для backend

```bash
# Создаем конфигурацию PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'bbifather-backend',
    script: 'start.sh',
    cwd: '/home/bbifather/bbifatherSPA/backend',
    interpreter: '/bin/bash',
    env: {
      ENVIRONMENT: 'production'
    },
    error_file: '/home/bbifather/logs/backend-error.log',
    out_file: '/home/bbifather/logs/backend-out.log',
    log_file: '/home/bbifather/logs/backend.log',
    time: true,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
EOF

# Создаем директорию для логов
mkdir -p /home/bbifather/logs

# Запускаем приложение через PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🎨 Деплой Frontend

### 1. Переход в директорию frontend

```bash
cd /home/bbifather/bbifatherSPA/frontend
```

### 2. Настройка API URL

Отредактируйте `src/api.ts`:

```typescript
// Замените localhost на ваш домен
const API_BASE_URL = 'https://bbifather.ru/api';
```

### 3. Установка зависимостей и сборка

```bash
npm install
npm run build
```
dMa87H_?+yU2bP
### 4. Перемещение build в nginx директорию

```bash
sudo mkdir -p /var/www/bbifather
sudo cp -r build/* /var/www/bbifather/
sudo chown -R www-data:www-data /var/www/bbifather
```

## 🌐 Настройка Nginx

### 1. Создание конфигурации Nginx

```bash
sudo nano /etc/nginx/sites-available/bbifather
```

Содержимое конфигурации:

```nginx
# Перенаправление с www на без www
server {
    listen 80;
    listen [::]:80;
    server_name www.bbifather.ru;
    return 301 http://bbifather.ru$request_uri;
}

# Основной сервер
server {
    listen 80;
    listen [::]:80;
    server_name bbifather.ru;

    # Логи
    access_log /var/log/nginx/bbifather_access.log;
    error_log /var/log/nginx/bbifather_error.log;

    # Корневая директория для фронтенда
    root /var/www/bbifather;
    index index.html index.htm;

    # Максимальный размер загружаемых файлов
    client_max_body_size 10M;

    # Gzip сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private no_last_modified no_etag auth;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # API проксирование на backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Обработка React Router (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кэширование статических файлов
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Безопасность
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Скрытие версии Nginx
    server_tokens off;
}
```

### 2. Активация конфигурации

```bash
# Создаем симлинк
sudo ln -s /etc/nginx/sites-available/bbifather /etc/nginx/sites-enabled/

# Удаляем дефолтную конфигурацию
sudo rm /etc/nginx/sites-enabled/default

# Проверяем конфигурацию
sudo nginx -t

# Перезапускаем Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 🔒 Настройка SSL

### 1. Получение SSL сертификата через Let's Encrypt

```bash
sudo certbot --nginx -d bbifather.ru -d www.bbifather.ru
```

### 2. Автоматическое обновление сертификата

```bash
# Добавляем задачу в cron
sudo crontab -e

# Добавляем строку:
0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. Обновленная конфигурация Nginx с SSL

Certbot автоматически обновит конфигурацию, но вы можете проверить:

```bash
sudo nano /etc/nginx/sites-available/bbifather
```

## 📱 Telegram уведомления

### 1. Создание Telegram бота

1. Найдите [@BotFather](https://t.me/botfather) в Telegram
2. Отправьте `/newbot`
3. Выберите имя и username для бота
4. Сохраните токен бота

### 2. Получение Chat ID

```bash
# Отправьте сообщение боту, затем выполните:
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
```

Найдите `chat.id` в ответе.

### 3. Обновление переменных окружения

```bash
nano /home/bbifather/bbifatherSPA/backend/.env
```

Добавьте:

```env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

### 4. Перезапуск backend

```bash
pm2 restart bbifather-backend
```

### 5. Тестирование уведомлений

Сделайте POST запрос на `/api/test-notification`:

```bash
curl -X POST https://bbifather.ru/api/test-notification
```

## 📊 Мониторинг и обслуживание

### 1. Мониторинг PM2

```bash
# Просмотр статуса приложений
pm2 status

# Просмотр логов
pm2 logs bbifather-backend

# Перезапуск приложения
pm2 restart bbifather-backend

# Мониторинг в реальном времени
pm2 monit
```

### 2. Мониторинг Nginx

```bash
# Проверка статуса
sudo systemctl status nginx

# Просмотр логов доступа
sudo tail -f /var/log/nginx/bbifather_access.log

# Просмотр логов ошибок
sudo tail -f /var/log/nginx/bbifather_error.log
```

### 3. Резервное копирование

Создайте скрипт для регулярного резервного копирования:

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/home/bbifather/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Бэкап файлов приложения
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /home/bbifather/bbifatherSPA

# Бэкап Nginx конфигурации
cp /etc/nginx/sites-available/bbifather $BACKUP_DIR/nginx_$DATE.conf

# Удаление старых бэкапов (старше 30 дней)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.conf" -mtime +30 -delete

echo "Backup completed: $DATE"
```

Добавьте в cron:

```bash
crontab -e
# Добавьте:
0 2 * * * /home/bbifather/backup.sh
```

### 4. Обновление приложения

```bash
#!/bin/bash
# update.sh

cd /home/bbifather/bbifatherSPA

# Останавливаем приложение
pm2 stop bbifather-backend

# Получаем обновления
git pull origin main

# Обновляем backend
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Обновляем frontend
cd ../frontend
npm install
npm run build
sudo cp -r build/* /var/www/bbifather/

# Запускаем приложение
pm2 start bbifather-backend

echo "Update completed!"
```

## 🔧 Troubleshooting

### Проблема: Backend не запускается

```bash
# Проверьте логи
pm2 logs bbifather-backend

# Проверьте переменные окружения
cat /home/bbifather/bbifatherSPA/backend/.env

# Проверьте подключение к Supabase
curl -H "apikey: YOUR_SUPABASE_KEY" https://your-project.supabase.co/rest/v1/subjects
```

### Проблема: Nginx 502 Bad Gateway

```bash
# Проверьте статус backend
pm2 status

# Проверьте логи Nginx
sudo tail -f /var/log/nginx/bbifather_error.log

# Проверьте что backend слушает порт 8000
netstat -tlnp | grep :8000
```

### Проблема: SSL сертификат не работает

```bash
# Проверьте статус сертификата
sudo certbot certificates

# Обновите сертификат
sudo certbot renew --dry-run
```

## ✅ Проверка деплоя

После завершения всех шагов проверьте:

1. ✅ Frontend доступен по адресу `https://bbifather.ru`
2. ✅ API отвечает: `https://bbifather.ru/api/subjects`
3. ✅ SSL сертификат работает (зеленый замок в браузере)
4. ✅ Telegram уведомления приходят при создании заказа
5. ✅ PM2 показывает, что backend запущен: `pm2 status`

## 🎉 Поздравляем!

Ваше приложение BBI Father успешно развернуто на продакшен сервере!

### Полезные команды для обслуживания:

```bash
# Перезапуск всего стека
sudo systemctl restart nginx
pm2 restart all

# Просмотр всех логов
pm2 logs --lines 100

# Обновление SSL сертификата
sudo certbot renew

# Проверка использования ресурсов
htop
df -h
```

python backend/main.py & python bot.py & wait
pkill -f "python bot.py" && pkill -f "python backend/main.py"

# Обновляем frontend
cd ../frontend
npm run build
sudo cp -r build/* /var/www/bbifather/
sudo systemctl restart nginx