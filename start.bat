@echo off
echo ====================================
echo   Mindora - Трекер настроения
echo ====================================
echo.

echo Проверка зависимостей...
if not exist "node_modules\" (
    echo Установка зависимостей...
    call npm install
    if errorlevel 1 (
        echo Ошибка при установке зависимостей!
        pause
        exit /b 1
    )
)

echo.
echo Запуск сервера...
echo Откройте в браузере: http://localhost:3000
echo Нажмите Ctrl+C для остановки сервера
echo.

node server.js

pause


