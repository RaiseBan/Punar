import * as path from "path";
import { app } from "electron";  // Получаем доступ к Electron API
import * as fs from 'fs/promises';
import * as fsSync from 'fs';

/**
 * Возвращает путь к директории глобальных конфигураций
 */
export function getGlobalConfigDirectory(): string {
    if (process.env.NODE_ENV === "production") {
        // В продакшн-режиме берем директорию из ресурсов приложения
        return path.join(app.getPath("userData"), "globalConfigs");
    } else {
        // В девелоперском режиме сохраняем в текущей рабочей директории
        // return path.join(app.getPath("userData"), "globalConfigs");
        return path.join(app.getPath("userData"), "globalConfigs");
        // return path.join(__dirname, "../globalConfigs");
    }
}

/**
 * Возвращает путь к директории конфигураций скриптов
 */
export function getConfigDirectory(): string {
    if (process.env.NODE_ENV === "production") {
        return path.join(app.getPath("userData"), "scriptConfigs");
    } else {
        return path.join(app.getPath("userData"), "scriptConfigs");
        // return path.join(__dirname, "../scriptConfigs");
    }
}

/**
 * Проверяет существование директории конфигураций и создает ее при необходимости
 */
export async function ensureConfigDirectory(): Promise<string> {
    const dir = getConfigDirectory();
    if (!fsSync.existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
    }
    return dir;
}