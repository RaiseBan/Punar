const path = require("path");
const { app } = require("electron");  // Получаем доступ к Electron API

function getGlobalConfigDirectory() {
    if (process.env.NODE_ENV === "production") {
        // В продакшн-режиме берем директорию из ресурсов приложения
        return path.join(app.getPath("userData"), "globalConfigs");
    } else {
        // В девелоперском режиме сохраняем в текущей рабочей директории
        return path.join(__dirname, "../globalConfigs");
    }
}

module.exports = { getGlobalConfigDirectory }