@echo off
echo 🔨 Сборка фронтенда...

cd frontend

REM Проверяем наличие node_modules
if not exist "node_modules" (
    echo 📦 Устанавливаем зависимости...
    npm install
)

REM Собираем проект
echo ⚙️ Сборка проекта...
set GENERATE_SOURCEMAP=false
npm run build

echo ✅ Фронтенд собран в папку frontend/build
pause