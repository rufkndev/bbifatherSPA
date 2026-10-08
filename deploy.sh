#!/usr/bin/env bash
# Деплой одной командой: git pull -> зависимости -> сборка фронта -> (пере)запуск backend и бота.
# Первый запуск на чистом сервере и все последующие обновления — одна и та же команда:
#
#   ./deploy.sh              # обычный деплой
#   ./deploy.sh --full       # принудительно переустановить зависимости (pip + npm)
#   ./deploy.sh --no-pull    # без git pull (просто пересобрать и перезапустить)
#
# Переменные окружения: BRANCH (main), WEB_ROOT (/var/www/bbifather), HEALTH_URL.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="${BRANCH:-main}"
WEB_ROOT="${WEB_ROOT:-/var/www/bbifather}"
PORT="${PORT:-8000}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:$PORT/}"
VENV="$ROOT/backend/venv"

FULL=0
PULL=1
for arg in "$@"; do
  case "$arg" in
    --full) FULL=1 ;;
    --no-pull) PULL=0 ;;
    -h|--help) sed -n '2,9p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Неизвестный аргумент: $arg" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mXX %s\033[0m\n' "$*" >&2; exit 1; }
trap 'die "Деплой упал на строке $LINENO (команда: $BASH_COMMAND)"' ERR

SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"

cd "$ROOT"

step "Проверка окружения"
for cmd in git node npm python3 pm2; do
  command -v "$cmd" >/dev/null || die "Не найден '$cmd' (см. DEPLOYMENT_GUIDE.md, «Подготовка сервера»)"
done
[ -f "$ROOT/.env" ] || die "Нет $ROOT/.env — скопируйте .env.example и заполните"
mkdir -p "$HOME/logs"

# --- git pull: до остановки сервисов, чтобы при ошибке старая версия продолжала работать ---
OLD_HEAD="$(git rev-parse HEAD)"
if [ "$PULL" -eq 1 ]; then
  step "git pull ($BRANCH)"
  # --autostash: локальные правки на сервере (например frontend/src/api.ts) сохраняются и возвращаются
  git pull --ff-only --autostash origin "$BRANCH"
fi
NEW_HEAD="$(git rev-parse HEAD)"
if [ "$OLD_HEAD" = "$NEW_HEAD" ]; then
  echo "Новых коммитов нет ($(git rev-parse --short HEAD))"
else
  echo "Обновлено: $(git rev-parse --short "$OLD_HEAD") -> $(git rev-parse --short "$NEW_HEAD")"
fi

changed() { [ "$OLD_HEAD" != "$NEW_HEAD" ] && git diff --name-only "$OLD_HEAD" "$NEW_HEAD" | grep -qE "$1"; }

# --- backend: venv + зависимости ---
step "Backend: зависимости"
FRESH_VENV=0
if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
  FRESH_VENV=1
fi
# Всегда: если всё уже стоит, pip отрабатывает за пару секунд, зато venv гарантированно полный
if [ "$FULL" -eq 1 ] || [ "$FRESH_VENV" -eq 1 ]; then
  "$VENV/bin/pip" install --upgrade pip >/dev/null
fi
"$VENV/bin/pip" install -r "$ROOT/backend/requirements.txt"

# --- frontend: сборка пока старая версия ещё работает ---
step "Frontend: сборка"
cd "$ROOT/frontend"
if [ "$FULL" -eq 1 ] || [ ! -d node_modules ] || changed '^frontend/package(-lock)?\.json$'; then
  if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
else
  echo "package.json не менялся — пропускаю npm install"
fi
npm run build
cd "$ROOT"

# --- остановка -> публикация -> запуск ---
step "Удаление старых процессов"
pm2 delete bbifather-backend bbifather-bot >/dev/null 2>&1 || true
# Запуск от root, а процессы раньше жили в PM2 владельца репозитория (bbifather) — он их сам воскрешает
OWNER="$(stat -c %U "$ROOT" 2>/dev/null || true)"
if [ "$(id -u)" -eq 0 ] && [ -n "$OWNER" ] && [ "$OWNER" != "root" ]; then
  su - "$OWNER" -c 'command -v pm2 >/dev/null && pm2 delete bbifather-backend bbifather-bot >/dev/null 2>&1 && pm2 save --force >/dev/null 2>&1' || true
fi

step "Очистка процессов вне PM2 и проверка порта $PORT"
# Старые ручные запуски (python bot.py &, gunicorn/uvicorn) держат порт и дают Conflict у бота
STRAY_RE='gunicorn.*main:app|backend/main\.py|python[0-9.]* +([^ ]*/)?bot\.py'
if pgrep -f "$STRAY_RE" >/dev/null; then
  warn "Найдены процессы вне PM2, останавливаю:"
  pgrep -af "$STRAY_RE" || true
  $SUDO pkill -f "$STRAY_RE" || true
  sleep 2
  $SUDO pkill -9 -f "$STRAY_RE" 2>/dev/null || true
fi
port_busy() { [ -n "$(ss -ltn "sport = :$PORT" 2>/dev/null | grep LISTEN || true)" ]; }
for _ in $(seq 1 10); do port_busy || break; sleep 1; done
if port_busy; then
  $SUDO ss -ltnp "sport = :$PORT" || true
  die "Порт $PORT занят чужим процессом. Если его сразу перезапускают — проверьте чужие pm2/systemd: 'su - bbifather -c \"pm2 list\"', 'systemctl list-units | grep -i bbi'"
fi
echo "Порт $PORT свободен"

step "Публикация фронта в $WEB_ROOT"
$SUDO mkdir -p "$WEB_ROOT"
$SUDO rm -rf "${WEB_ROOT:?}"/*
$SUDO cp -r "$ROOT/frontend/build/." "$WEB_ROOT/"
$SUDO chown -R www-data:www-data "$WEB_ROOT" 2>/dev/null || true
if command -v nginx >/dev/null; then
  $SUDO nginx -t && $SUDO systemctl reload nginx || warn "Nginx не перезагружен — проверьте конфиг"
else
  warn "nginx не установлен — фронт скопирован, но не раздаётся"
fi

step "Запуск backend и бота"
pm2 start "$ROOT/ecosystem.config.js"
pm2 save >/dev/null

step "Проверка работоспособности"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "$HEALTH_URL"; then ok=1; break; fi
  sleep 1
done
if [ "$ok" -ne 1 ]; then
  pm2 logs bbifather-backend --lines 40 --nostream || true
  die "Backend не отвечает на $HEALTH_URL за 30 секунд"
fi
echo "Backend отвечает: $HEALTH_URL"

sleep 3
BOT_INFO="$(pm2 describe bbifather-bot 2>/dev/null || true)"
grep -q "online" <<<"$BOT_INFO" \
  || { pm2 logs bbifather-bot --lines 40 --nostream || true; die "Бот не в статусе online"; }
echo "Бот online"

step "Готово"
pm2 status
if [ "$(pm2 pid bbifather-bot | wc -w)" -gt 1 ]; then
  warn "Запущено больше одного bbifather-bot!"
fi
echo "Логи: pm2 logs"
echo "Автозапуск после перезагрузки сервера (один раз): pm2 startup  и выполнить выведенную команду"
