import { getGlobalConfigDirectory } from "./wallet";
import * as path from "path";
import * as fs from "fs";
import * as fs_prom from "fs/promises";
import { app } from "electron";

export function getSettings(): Record<string, any> {
    try {
        console.log("fsHelper.getSettings: Получение настроек пользователя");

        const settingsDir = getGlobalConfigDirectory();
        const settingsFilePath = path.join(settingsDir, 'userSettings.json');

        console.log(`fsHelper.getSettings: Путь к конфигурационному файлу: ${settingsFilePath}`);

        if (!fs.existsSync(settingsFilePath)) {
            console.error(`fsHelper.getSettings: Ошибка - конфигурационный файл не найден по пути ${settingsFilePath}`);

            const altConfigPath = path.join(app.getPath('userData'), 'settings.json');
            console.log(`fsHelper.getSettings: Пробуем альтернативный путь: ${altConfigPath}`);

            if (!fs.existsSync(altConfigPath)) {
                console.error(`fsHelper.getSettings: Альтернативный конфигурационный файл тоже не найден`);
                return {};
            }

            const altSettings = JSON.parse(fs.readFileSync(altConfigPath, 'utf8'));
            console.log(`fsHelper.getSettings: Настройки успешно получены из альтернативного файла:`, JSON.stringify(altSettings, null, 2));
            return altSettings;
        }

        const settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
        console.log(`fsHelper.getSettings: Настройки успешно получены:`, JSON.stringify(settings, null, 2));

        return settings;
    } catch (error) {
        const err = error as Error;
        console.error(`fsHelper.getSettings: Ошибка при получении настроек:`, err);
        return {};
    }
}

export function getLookupTablesFilePath(): string {
    const settingsDir = getGlobalConfigDirectory();
    return path.join(settingsDir, 'lookup_tables.json');
}

export async function saveLookupTables(data: any): Promise<boolean> {
    try {
        await fs_prom.writeFile(getLookupTablesFilePath(), JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving lookup tables:', error);
        return false;
    }
}

export async function getLookupTables(): Promise<any[] | null> {
    try {
        const fileContent = await fs_prom.readFile(getLookupTablesFilePath(), 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {

            return [];
        }
        console.error('Error reading lookup tables:', error);
        return null;
    }
}

export function convertWindowsPathToWSL(windowsPath: string): string {

    let unixPath = windowsPath.replace(/\\/g, '/');

    if (unixPath.startsWith('C:')) {
        unixPath = unixPath.replace(/^C:/, '/mnt/c');
    } else if (unixPath.startsWith('D:')) {
        unixPath = unixPath.replace(/^D:/, '/mnt/d');
    }

    return unixPath;
}

export async function saveSettings(settings: Record<string, unknown>): Promise<void> {
    try {
        console.log("fsHelper.saveSettings: Сохранение настроек пользователя");

        const settingsDir = getGlobalConfigDirectory();
        const settingsFilePath = path.join(settingsDir, 'userSettings.json');

        console.log(`fsHelper.saveSettings: Путь к файлу настроек: ${settingsFilePath}`);

        if (!fs.existsSync(settingsDir)) {
            await fs_prom.mkdir(settingsDir, { recursive: true });
        }

        await fs_prom.writeFile(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');

        console.log(`fsHelper.saveSettings: Настройки успешно сохранены`);
    } catch (error) {
        const err = error as Error;
        console.error(`fsHelper.saveSettings: Ошибка при сохранении настроек:`, err);
        throw error;
    }
}