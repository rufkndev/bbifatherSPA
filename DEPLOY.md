# Руководство по развертыванию BBIFather SPA (без Docker)

Простое развертывание на VPS с использованием systemd сервисов и Nginx.

## 🚀 Быстрая установка

1. **Скопируйте проект на сервер**
2. **Запустите:** `sudo ./install.sh`
3. **Настройте переменные окружения** (см. ниже)
4. **Получите SSL сертификат**
5. **Запустите сервисы**

## 📋 Подробная инструкция

### 1. Подготовка сервера

1. **Подключитесь к VPS:**
   ```bash
   ssh root@your-server-ip
   ```

2. **Клонируйте репозиторий:**
   ```bash
   git clone https://github.com/your-username/bbifatherSPA.git
   cd bbifatherSPA
   ```

### 2. Настройка домена

В панели управления доменом направьте записи A для `bbifather.ru` и `www.bbifather.ru` на IP вашего сервера.

### 3. Автоматическая установка

Запустите скрипт установки:

```bash
chmod +x install.sh
sudo ./install.sh
```

**Если возникают проблемы с Node.js**, используйте альтернативный скрипт:

```bash
chmod +x install-alt.sh
sudo ./install-alt.sh
```

Или следуйте инструкциям в файле `NODEJS_INSTALL.md`.

Скрипт автоматически:
- Установит все необходимые зависимости
- Создаст директории проекта
- Соберет фронтенд
- Настроит systemd сервисы
- Настроит Nginx

### 4. Настройка переменных окружения

После установки отредактируйте файлы сервисов:

```bash
sudo nano /etc/systemd/system/bbifather-backend.service
sudo nano /etc/systemd/system/bbifather-bot.service
```

Замените `YOUR_BOT_TOKEN` и `YOUR_CHAT_ID` на ваши реальные значения:
- `TELEGRAM_BOT_TOKEN` - получите у @BotFather
- `TELEGRAM_CHAT_ID` - получите у @userinfobot

### 5. Получение SSL сертификата

```bash
sudo certbot --nginx -d bbifather.ru -d www.bbifather.ru
```

### 6. Запуск сервисов

```bash
sudo systemctl daemon-reload
sudo systemctl enable bbifather-backend bbifather-bot
sudo systemctl start bbifather-backend bbifather-bot
sudo systemctl reload nginx
```

### 7. Проверка работы

```bash
# Проверка статуса сервисов
sudo systemctl status bbifather-backend
sudo systemctl status bbifather-bot
sudo systemctl status nginx

# Проверка логов
sudo journalctl -u bbifather-backend -f
sudo journalctl -u bbifather-bot -f
```

## 🌐 Доступ к приложению

После успешной установки приложение будет доступно по адресу:
- **HTTPS:** https://bbifather.ru

## 🔧 Управление приложением

### Полезные команды:

```bash
# Перезапуск сервисов
sudo systemctl restart bbifather-backend
sudo systemctl restart bbifather-bot

# Просмотр логов
sudo journalctl -u bbifather-backend --since "1 hour ago"
sudo journalctl -u bbifather-bot --since "1 hour ago"

# Остановка сервисов
sudo systemctl stop bbifather-backend bbifather-bot

# Перезагрузка Nginx
sudo systemctl reload nginx
```

### Обновление приложения:

```bash
cd /path/to/your/project
git pull

# Пересборка фронтенда
cd frontend
npm run build

# Перезапуск сервисов
sudo systemctl restart bbifather-backend bbifather-bot
```

## 📁 Структура файлов на сервере

```
/var/www/bbifather/
├── backend/           # Python API
├── bot/              # Telegram бот
├── frontend/         # React приложение
│   └── build/        # Собранные файлы
└── data/             # База данных и загрузки
    └── database.db
```

## 🔒 Безопасность

1. **Firewall:** Откройте только порты 22, 80, 443
   ```bash
   sudo ufw allow 22
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```

2. **Обновления:** Регулярно обновляйте систему
   ```bash
   sudo apt update && sudo apt upgrade
   ```

3. **Логи:** Мониторьте логи приложения
   ```bash
   sudo journalctl -u bbifather-backend -f
   ```

## 🆘 Решение проблем

### Проблема: Сервис не запускается

```bash
# Проверьте статус
sudo systemctl status bbifather-backend

# Проверьте логи
sudo journalctl -u bbifather-backend --no-pager

# Проверьте права доступа
ls -la /var/www/bbifather/
```

### Проблема: Фронтенд не загружается

```bash
# Проверьте Nginx
sudo nginx -t
sudo systemctl status nginx

# Проверьте права на файлы
ls -la /var/www/bbifather/frontend/build/
```

### Проблема: API не отвечает

```bash
# Проверьте, что бэкенд запущен
curl http://127.0.0.1:8000/api/subjects

# Проверьте логи бэкенда
sudo journalctl -u bbifather-backend -f
```

### Проблема: SSL сертификат не работает

```bash
# Проверьте сертификаты
sudo certbot certificates

# Обновите сертификаты
sudo certbot renew --dry-run
```

## 📞 Дополнительная настройка

### Автоматическое обновление SSL сертификатов

Добавьте в crontab:
```bash
sudo crontab -e
```

Добавьте строку:
```
0 12 * * * /usr/bin/certbot renew --quiet --post-hook "systemctl reload nginx"
```

### Мониторинг ресурсов

```bash
# Использование памяти и CPU
htop

# Использование диска
df -h

# Логи системы
sudo journalctl -f
```