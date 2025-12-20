import { promises as fs } from 'fs';
import path from 'path';
import { ensureConfigDirectory } from '../utils/wallet';
import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { ConfigType, ConfigFile } from '../../../shared/types';

/**
 * Проверяет существование директории
 */
async function directoryExists(dirPath: string): Promise<boolean> {
    try {
        await fs.access(dirPath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Инициализирует IPC handlers для работы с конфигурациями
 */
export function initializeConfigHandlers(ipcMain: IpcMain): void {
    /**
     * Сохранение конфигурации
     */
    ipcMain.handle(
        'save-config',
        async (
            _event: IpcMainInvokeEvent,
            configType: ConfigType,
            fileName: string,
            content: unknown
        ): Promise<boolean> => {
            try {
                const baseDir = await ensureConfigDirectory();
                const configDir = path.join(baseDir, configType);

                await fs.mkdir(configDir, { recursive: true });

                const filePath = path.join(configDir, `${fileName}.json`);
                await fs.writeFile(filePath, JSON.stringify(content, null, 2));

                return true;
            } catch (error) {
                console.error('Error saving config:', error);
                return false;
            }
        }
    );

    /**
     * Получение списка конфигураций
     */
    ipcMain.handle(
        'get-configs',
        async (_event: IpcMainInvokeEvent, configType: ConfigType): Promise<string[]> => {
            try {
                const baseDir = await ensureConfigDirectory();
                const configDir = path.join(baseDir, configType);

                if (!(await directoryExists(configDir))) {
                    return [];
                }

                const files = await fs.readdir(configDir);
                return files
                    .filter((file) => file.endsWith('.json'))
                    .map((file) => file.replace(/\.json$/, ''));
            } catch (error) {
                console.error('Error reading configs:', error);
                return [];
            }
        }
    );

    /**
     * Получение конфигурации по имени
     */
    ipcMain.handle(
        'get-config',
        async (
            _event: IpcMainInvokeEvent,
            configType: ConfigType,
            fileName: string
        ): Promise<unknown | null> => {
            try {
                const baseDir = await ensureConfigDirectory();
                const filePath = path.join(baseDir, configType, `${fileName}.json`);

                if (!(await directoryExists(path.dirname(filePath)))) {
                    return null;
                }

                const data = await fs.readFile(filePath, 'utf-8');
                return JSON.parse(data);
            } catch (error) {
                const err = error as NodeJS.ErrnoException;
                if (err.code !== 'ENOENT') {
                    console.error('Error reading config:', error);
                }
                return null;
            }
        }
    );

    /**
     * Удаление конфигурации
     */
    ipcMain.handle(
        'delete-config',
        async (
            _event: IpcMainInvokeEvent,
            configType: ConfigType,
            fileName: string
        ): Promise<boolean> => {
            try {
                const baseDir = await ensureConfigDirectory();
                const filePath = path.join(baseDir, configType, `${fileName}.json`);

                if (!(await directoryExists(path.dirname(filePath)))) {
                    return false;
                }

                try {
                    await fs.access(filePath);
                } catch {
                    return false;
                }

                await fs.unlink(filePath);
                return true;
            } catch (error) {
                console.error('Error deleting config:', error);
                return false;
            }
        }
    );

    /**
     * Получение путей всех конфигураций
     */
    ipcMain.handle(
        'get-all-config-paths',
        async (_event: IpcMainInvokeEvent, configType: ConfigType): Promise<ConfigFile[]> => {
            try {
                const baseDir = await ensureConfigDirectory();
                const configDir = path.join(baseDir, configType);

                if (!(await directoryExists(configDir))) {
                    return [];
                }

                const files = await fs.readdir(configDir);
                return files
                    .filter((file) => file.endsWith('.json'))
                    .map((file) => ({
                        name: file.replace(/\.json$/, ''),
                        path: path.join(configDir, file),
                    }));
            } catch (error) {
                console.error('Error reading config paths:', error);
                return [];
            }
        }
    );
}