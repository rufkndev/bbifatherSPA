# Gunicorn конфигурация для продакшена
# Сервер
bind = "0.0.0.0:8000"
# Очередь Telegram хранится в памяти процесса. Несколько Gunicorn worker'ов
# создают несколько независимых очередей и легко превышают лимиты одного bot token.
workers = 1
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
timeout = 120
keepalive = 2

# Логирование
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%h %l %u %t "%r" %s %b "%{Referer}i" "%{User-Agent}i" %D'

# Производительность
preload_app = True
max_requests = 1000
max_requests_jitter = 100

# Безопасность
limit_request_line = 4096
limit_request_fields = 100
limit_request_field_size = 8190