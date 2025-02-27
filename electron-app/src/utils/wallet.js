const path = require("path");
const { app } = require("electron");  // Получаем доступ к Electron API
const fs = require('fs').promises;
const fsSync = require('fs');
function getGlobalConfigDirectory() {
    if (process.env.NODE_ENV === "production") {
        // В продакшн-режиме берем директорию из ресурсов приложения
        return path.join(app.getPath("userData"), "globalConfigs");
    } else {
        // В девелоперском режиме сохраняем в текущей рабочей директории
        return path.join(__dirname, "../globalConfigs");
    }
}

function getConfigDirectory() {
    if (process.env.NODE_ENV === "production") {
        return path.join(app.getPath("userData"), "scriptConfigs");
    } else {
        return path.join(__dirname, "../scriptConfigs");
    }
}

async function ensureConfigDirectory() {
    const dir = getConfigDirectory();
    if (!fsSync.existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
    }
    return dir;
}


module.exports = { getGlobalConfigDirectory, ensureConfigDirectory }