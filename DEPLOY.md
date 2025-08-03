# Руководство по развертыванию BBIFather SPA на продакшен-сервере

Это руководство поможет вам развернуть проект на VPS с доменом `bbifather.ru`, используя альтернативные порты для избежания конфликтов с другими приложениями.

## 🚀 Быстрый старт

1. **Скопируйте проект на сервер**
2. **Создайте файл `.env`** (см. раздел "Настройка переменных окружения")
3. **Запустите:** `./start-prod.sh` (Linux) или `start-prod.bat` (Windows)

## 📋 Подробная инструкция

### 1. Подготовка сервера

1. **Подключитесь к VPS по SSH:**
   ```bash
   ssh root@your-server-ip
   ```

2. **Установите Docker и Docker Compose** (если не установлены):
   ```bash
   # Обновляем систему
   apt update && apt upgrade -y
   
   # Устанавливаем Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   
   # Устанавливаем Docker Compose
   curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   chmod +x /usr/local/bin/docker-compose
   ```

3. **Клонируйте репозиторий:**
   ```bash
   git clone https://github.com/your-username/bbifatherSPA.git
   cd bbifatherSPA
   ```

### 2. Настройка домена

1. **В панели управления доменом** направьте записи A для `bbifather.ru` и `www.bbifather.ru` на IP вашего сервера.

2. **Проверьте DNS:**
   ```bash
   nslookup bbifather.ru
   nslookup www.bbifather.ru
   ```

### 3. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```bash
nano .env
```

Содержимое файла:
```env
# Токен вашего Telegram бота (получите у @BotFather)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ

# ID чата для уведомлений (получите у @userinfobot)  
TELEGRAM_CHAT_ID=-1001234567890
```

### 4. Получение SSL сертификатов

1. **Установите Certbot:**
   ```bash
   apt install certbot python3-certbot-nginx -y
   ```

2. **Временно запустите только Nginx для получения сертификатов:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d nginx
   ```

3. **Получите сертификаты:**
   ```bash
   certbot certonly --webroot \
     -w ./data/certbot/www \
     -d bbifather.ru \
     -d www.bbifather.ru \
     --email your-email@example.com \
     --agree-tos \
     --no-eff-email
   ```

4. **Остановите временный контейнер:**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   ```

### 5. Запуск приложения

1. **Запустите все сервисы:**
   ```bash
   ./start-prod.sh
   ```
   
   Или вручную:
   ```bash
   docker-compose -f docker-compose.prod.yml up --build -d
   ```

2. **Проверьте статус:**
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   ```

### 6. Настройка автообновления SSL сертификатов

Добавьте в crontab автоматическое обновление:

```bash
crontab -e
```

Добавьте строку:
```bash
0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook "docker-compose -f /path/to/your/project/docker-compose.prod.yml restart nginx"
```

## 🌐 Доступ к приложению

После успешного запуска приложение будет доступно по следующим адресам:

- **HTTP:** http://bbifather.ru:8080
- **HTTPS:** https://bbifather.ru:8443

## 🔧 Управление приложением

### Полезные команды:

```bash
# Просмотр логов всех сервисов
docker-compose -f docker-compose.prod.yml logs -f

# Просмотр логов конкретного сервиса
docker-compose -f docker-compose.prod.yml logs -f backend

# Перезапуск всех сервисов
docker-compose -f docker-compose.prod.yml restart

# Перезапуск конкретного сервиса
docker-compose -f docker-compose.prod.yml restart backend

# Остановка приложения
docker-compose -f docker-compose.prod.yml down

# Обновление приложения
git pull
docker-compose -f docker-compose.prod.yml up --build -d
```

### Мониторинг:

```bash
# Использование ресурсов
docker stats

# Статус контейнеров
docker-compose -f docker-compose.prod.yml ps

# Логи Nginx
docker-compose -f docker-compose.prod.yml logs nginx
```

## 🔒 Безопасность

1. **Firewall:** Настройте UFW или iptables для разрешения только необходимых портов
2. **SSH:** Используйте ключи вместо паролей
3. **Обновления:** Регулярно обновляйте систему и Docker образы
4. **Мониторинг:** Настройте мониторинг логов и ресурсов

## 🆘 Решение проблем

### Проблема: Контейнер не запускается
```bash
# Проверьте логи
docker-compose -f docker-compose.prod.yml logs service-name

# Пересоберите образы
docker-compose -f docker-compose.prod.yml build --no-cache
```

### Проблема: SSL сертификаты не работают
```bash
# Проверьте сертификаты
certbot certificates

# Обновите сертификаты
certbot renew --dry-run
```

### Проблема: Порты заняты
```bash
# Проверьте какие порты используются
netstat -tulpn | grep :8080
netstat -tulpn | grep :8443

# При необходимости измените порты в docker-compose.prod.yml
```

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи: `docker-compose -f docker-compose.prod.yml logs -f`
2. Убедитесь, что все переменные окружения настроены правильно
3. Проверьте DNS настройки домена
4. Убедитесь, что порты 8080 и 8443 открыты в firewall