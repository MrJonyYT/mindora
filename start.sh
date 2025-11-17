#!/bin/bash

echo "===================================="
echo "  Mindora - Трекер настроения"
echo "===================================="
echo ""

echo "Проверка зависимостей..."
if [ ! -d "node_modules" ]; then
    echo "Установка зависимостей..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Ошибка при установке зависимостей!"
        exit 1
    fi
fi

echo ""
echo "Запуск сервера..."
echo "Откройте в браузере: http://localhost:3000"
echo "Нажмите Ctrl+C для остановки сервера"
echo ""

node server.js


