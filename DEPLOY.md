# Простое развертывание на VPS

## 1. Установка зависимостей

```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем все нужное
sudo apt install -y python3 python3-pip nginx nodejs npm git

# Проверяем
python3 --version
node --version
npm --version
```

## 2. Загружаем проект

```bash
# Клонируем в домашнюю папку
cd ~
git clone https://github.com/your-username/bbifatherSPA.git
cd bbifatherSPA
```

## 3. Настраиваем бэкенд

```bash
# Устанавливаем Python зависимости
cd backend
pip3 install -r requirements.txt
cd ..
```

## 4. Настраиваем бота

```bash
# Устанавливаем зависимости бота
cd bot
pip3 install -r requirements.txt
cd ..
```

## 5. Собираем фронтенд

```bash
# Собираем React приложение
cd frontend
npm install
npm run build
cd ..
```

## 6. Копируем на сервер

```bash
# Создаем папку для проекта
sudo mkdir -p /var/www/bbifather

# Копируем файлы
sudo cp -r backend /var/www/bbifather/
sudo cp -r bot /var/www/bbifather/
sudo cp -r frontend /var/www/bbifather/

# Настраиваем права
sudo chown -R www-data:www-data /var/www/bbifather
```

## 7. Настраиваем сервисы

```bash
# Копируем файлы сервисов
sudo cp backend.service /etc/systemd/system/
sudo cp bot.service /etc/systemd/system/

# ВАЖНО: Отредактируйте файлы и укажите ваши токены
sudo nano /etc/systemd/system/backend.service
sudo nano /etc/systemd/system/bot.service
# Замените YOUR_BOT_TOKEN и YOUR_CHAT_ID на реальные значения

# Запускаем сервисы
sudo systemctl daemon-reload
sudo systemctl enable backend bot
sudo systemctl start backend bot

# Проверяем
sudo systemctl status backend
sudo systemctl status bot
```

## 8. Настраиваем Nginx

```bash
# Копируем конфигурацию
sudo cp nginx.conf /etc/nginx/sites-available/bbifather.ru
sudo ln -s /etc/nginx/sites-available/bbifather.ru /etc/nginx/sites-enabled/

# Удаляем дефолтный сайт
sudo rm /etc/nginx/sites-enabled/default

# Проверяем и перезапускаем
sudo nginx -t
sudo systemctl restart nginx
```

## 9. Настраиваем домен

В панели управления доменом добавьте A-запись:
- `bbifather.ru` → IP вашего сервера
- `www.bbifather.ru` → IP вашего сервера

## 10. Получаем SSL (опционально)

```bash
# Устанавливаем Certbot
sudo apt install certbot python3-certbot-nginx

# Получаем сертификат
sudo certbot --nginx -d bbifather.ru -d www.bbifather.ru
```

## Готово!

Сайт доступен по адресу: http://bbifather.ru 

## Полезные команды

```bash
# Перезапуск сервисов
sudo systemctl restart backend bot nginx

# Просмотр логов
sudo journalctl -u backend -f
sudo journalctl -u bot -f

# Обновление проекта
cd ~/bbifatherSPA
git pull
cd frontend && npm run build
sudo cp -r frontend/build/* /var/www/bbifather/frontend/build/
sudo systemctl restart backend bot
```