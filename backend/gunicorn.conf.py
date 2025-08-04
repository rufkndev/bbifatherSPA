# Gunicorn конфигурация для продакшена
import multiprocessing

# Сервер
bind = "0.0.0.0:8000"
workers = multiprocessing.cpu_count() * 2 + 1
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