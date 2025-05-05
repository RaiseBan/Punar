import { promises as fs } from "fs";
import * as base_fs from "fs";
import path from "path";
import { ensureConfigDirectory, getGlobalConfigDirectory } from "../utils/wallet.js";
import { getSettings } from "../utils/fsHelper.js";
import { IpcMain } from "electron";

async function directoryExists(path: string): Promise<boolean> {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

interface ConfigPath {
    name: string;
    path: string;
}

function initializeConfigHandlers(ipcMain: IpcMain): void {
    ipcMain.handle("save-config", async (_, configType: string, fileName: string, content: any) => {
        try {
            const baseDir = await ensureConfigDirectory();
            const configDir = path.join(baseDir, configType);

            // Создаем директорию конфига, если не существует
            await fs.mkdir(configDir, { recursive: true });

            const filePath = path.join(configDir, `${fileName}.json`);
            await fs.writeFile(filePath, JSON.stringify(content, null, 2));
            return true;
        } catch (error) {
            console.error("Error saving config:", error);
            return false;
        }
    });

    ipcMain.handle("get-configs", async (_, configType: string) => {
        try {
            const baseDir = await ensureConfigDirectory();
            const configDir = path.join(baseDir, configType);

            // Возвращаем пустой массив если директория не существует
            if (!(await directoryExists(configDir))) {
                return [];
            }

            const files = await fs.readdir(configDir);
            return files
                .filter(file => file.endsWith(".json"))
                .map(file => file.replace(/\.json$/, ""));
        } catch (error) {
            console.error("Error reading configs:", error);
            return [];
        }
    });

    ipcMain.handle('get-config', async (_, configType: string, fileName: string) => {
        try {
            const baseDir = await ensureConfigDirectory();
            const filePath = path.join(baseDir, configType, `${fileName}.json`);

            // Подавляем ошибку если файл не существует
            if (!(await directoryExists(path.dirname(filePath)))) return null;

            const data = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('Error reading config:', error);
            }
            return null;
        }
    });

    ipcMain.handle('delete-config', async (_, configType: string, fileName: string) => {
        try {
            const baseDir = await ensureConfigDirectory();
            const filePath = path.join(baseDir, configType, `${fileName}.json`);

            // Не пытаемся удалять несуществующие файлы
            if (!(await directoryExists(filePath))) return true;

            await fs.unlink(filePath);
            return true;
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('Error deleting config:', error);
            }
            return false;
        }
    });

    ipcMain.handle('get-config-paths', async (_, configType: string) => {
        try {
            const baseDir = await ensureConfigDirectory();
            const configDir = path.join(baseDir, configType);

            // Возвращаем пустой массив если директория не существует
            if (!(await directoryExists(configDir))) {
                return [];
            }

            const files = await fs.readdir(configDir);
            return files
                .filter(file => file.endsWith('.json'))
                .map(file => ({
                    name: file.replace(/\.json$/, ''),
                    path: path.join(configDir, file),
                })) as ConfigPath[];
        } catch (error) {
            console.error('Error getting config paths:', error);
            return [];
        }
    });

    ipcMain.handle("get-settings", async () => {
        return getSettings();
    });

    ipcMain.handle("save-settings", (_, settings: any) => {
        const settingsDir = getGlobalConfigDirectory();
        const settingsFilePath = path.join(settingsDir, 'userSettings.json');

        try {
            base_fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    });
}

export { initializeConfigHandlers };