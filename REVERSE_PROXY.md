# Конфигурация для интеграции с существующим веб-сервером

Если на вашем сервере уже работает другое веб-приложение на стандартных портах 80/443, используйте эту конфигурацию для интеграции BBIFather SPA.

## Вариант 1: Nginx как основной веб-сервер

Если ваш основной веб-сервер - Nginx, добавьте этот блок в его конфигурацию:

```nginx
# /etc/nginx/sites-available/bbifather.ru
server {
    listen 80;
    server_name bbifather.ru www.bbifather.ru;
    
    # Перенаправление на HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bbifather.ru www.bbifather.ru;
    
    # SSL сертификаты (получите через Certbot)
    ssl_certificate /etc/letsencrypt/live/bbifather.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bbifather.ru/privkey.pem;
    
    # Проксирование на Docker контейнер
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

После добавления конфигурации:
```bash
# Проверьте конфигурацию
nginx -t

# Перезапустите Nginx
systemctl reload nginx

# Получите SSL сертификат
certbot --nginx -d bbifather.ru -d www.bbifather.ru
```

## Вариант 2: Apache как основной веб-сервер

Если ваш основной веб-сервер - Apache, создайте виртуальный хост:

```apache
# /etc/apache2/sites-available/bbifather.ru.conf
<VirtualHost *:80>
    ServerName bbifather.ru
    ServerAlias www.bbifather.ru
    
    # Перенаправление на HTTPS
    Redirect permanent / https://bbifather.ru/
</VirtualHost>

<VirtualHost *:443>
    ServerName bbifather.ru
    ServerAlias www.bbifather.ru
    
    # SSL настройки (после получения сертификата)
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/bbifather.ru/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/bbifather.ru/privkey.pem
    
    # Проксирование на Docker контейнер
    ProxyPreserveHost On
    ProxyPass / http://localhost:8080/
    ProxyPassReverse / http://localhost:8080/
    
    # Заголовки
    ProxyPassReverse / http://localhost:8080/
    ProxyPassReverseAdjustHeaders On
</VirtualHost>
```

Активируйте конфигурацию:
```bash
# Включите необходимые модули
a2enmod ssl proxy proxy_http

# Активируйте сайт
a2ensite bbifather.ru.conf

# Перезапустите Apache
systemctl reload apache2

# Получите SSL сертификат
certbot --apache -d bbifather.ru -d www.bbifather.ru
```

## Вариант 3: Traefik (рекомендуется для Docker окружений)

Если вы используете Traefik как reverse proxy, добавьте эти лейблы в docker-compose.prod.yml:

```yaml
services:
  nginx:
    image: nginx:1.25-alpine
    # Уберите проброс портов наружу
    # ports:
    #   - "8080:80"
    #   - "8443:443"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.bbifather.rule=Host(`bbifather.ru`,`www.bbifather.ru`)"
      - "traefik.http.routers.bbifather.entrypoints=websecure"
      - "traefik.http.routers.bbifather.tls.certresolver=letsencrypt"
      - "traefik.http.services.bbifather.loadbalancer.server.port=80"
    networks:
      - traefik
    # ... остальная конфигурация

networks:
  traefik:
    external: true
```

## Настройка для запуска без конфликта портов

Если вы хотите запустить приложение только на внутренних портах (без публикации наружу), измените docker-compose.prod.yml:

```yaml
services:
  nginx:
    image: nginx:1.25-alpine
    # Закомментируйте или уберите секцию ports
    # ports:
    #   - "8080:80"
    #   - "8443:443"
    expose:
      - "80"    # Порт доступен только внутри Docker сети
    # ... остальная конфигурация
```

Тогда приложение будет доступно только через ваш основной веб-сервер по адресу `http://localhost:80` внутри Docker сети.