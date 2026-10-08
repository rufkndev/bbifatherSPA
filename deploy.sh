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
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8000/}"
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
if [ "$FULL" -eq 1 ] || [ "$FRESH_VENV" -eq 1 ] || [ ! -x "$VENV/bin/gunicorn" ] || changed '^backend/requirements\.txt$'; then
  "$VENV/bin/pip" install --upgrade pip >/dev/null
  "$VENV/bin/pip" install -r "$ROOT/backend/requirements.txt"
else
  echo "requirements.txt не менялся — пропускаю"
fi

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
step "Остановка сервисов"
pm2 stop bbifather-backend bbifather-bot >/dev/null 2>&1 || true

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
# delete + start: подхватывает изменения ecosystem.config.js и .env, гарантирует ровно один экземпляр
pm2 delete bbifather-backend bbifather-bot >/dev/null 2>&1 || true
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
if [ "$(pm2 jlist 2>/dev/null | grep -o '"name":"bbifather-bot"' | wc -l)" -gt 1 ]; then
  warn "Запущено больше одного bbifather-bot!"
fi
echo "Логи: pm2 logs"
echo "Автозапуск после перезагрузки сервера (один раз): pm2 startup  и выполнить выведенную команду"
