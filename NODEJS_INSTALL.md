# Решение проблем с установкой Node.js

Если основной скрипт установки не работает из-за конфликтов пакетов, используйте один из альтернативных способов.

## Способ 1: NodeSource репозиторий (рекомендуется)

```bash
# Очистите существующие пакеты Node.js
sudo apt remove --purge nodejs npm
sudo apt autoremove

# Установите Node.js из NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Проверьте установку
node --version
npm --version
```

## Способ 2: Snap пакеты

```bash
# Установите snapd если его нет
sudo apt install snapd

# Установите Node.js через snap
sudo snap install node --classic

# Проверьте установку
node --version
npm --version
```

## Способ 3: Альтернативный скрипт

Используйте альтернативный скрипт установки:

```bash
chmod +x install-alt.sh
sudo ./install-alt.sh
```

## Способ 4: Ручная установка

1. **Скачайте Node.js вручную:**
   ```bash
   cd /tmp
   wget https://nodejs.org/dist/v18.17.0/node-v18.17.0-linux-x64.tar.xz
   tar -xf node-v18.17.0-linux-x64.tar.xz
   sudo mv node-v18.17.0-linux-x64 /opt/nodejs
   ```

2. **Добавьте в PATH:**
   ```bash
   echo 'export PATH=/opt/nodejs/bin:$PATH' | sudo tee -a /etc/profile
   source /etc/profile
   ```

3. **Проверьте:**
   ```bash
   node --version
   npm --version
   ```

## Способ 5: Использование NVM

```bash
# Установите NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Установите Node.js
nvm install 18
nvm use 18
nvm alias default 18
```

## После установки Node.js

Продолжите установку проекта:

```bash
# Остальные зависимости
sudo apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx

# Создайте директории
sudo mkdir -p /var/www/bbifather
sudo mkdir -p /var/www/bbifather/data

# Скопируйте файлы проекта
sudo cp -r backend /var/www/bbifather/
sudo cp -r bot /var/www/bbifather/
sudo cp -r frontend /var/www/bbifather/

# Установите Python зависимости
cd /var/www/bbifather/backend
sudo pip3 install -r requirements.txt

cd /var/www/bbifather/bot
sudo pip3 install -r requirements.txt

# Соберите фронтенд
cd /var/www/bbifather/frontend
sudo npm install
sudo GENERATE_SOURCEMAP=false npm run build

# Настройте права
sudo chown -R www-data:www-data /var/www/bbifather
sudo chmod -R 755 /var/www/bbifather

# Установите сервисы
sudo cp bbifather-backend.service /etc/systemd/system/
sudo cp bbifather-bot.service /etc/systemd/system/

# Настройте Nginx
sudo cp nginx-site.conf /etc/nginx/sites-available/bbifather.ru
sudo ln -sf /etc/nginx/sites-available/bbifather.ru /etc/nginx/sites-enabled/
sudo nginx -t
```