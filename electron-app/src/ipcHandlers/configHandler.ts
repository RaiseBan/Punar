import { promises as fs } from 'fs';
import path from 'path';
import { ensureConfigDirectory } from '../utils/wallet';
import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { ConfigType, IPC_CHANNELS } from '../../../shared/types';

async function directoryExists(dirPath: string): Promise<boolean> {
    try {
        await fs.access(dirPath);
        return true;
    } catch {
        return false;
    }
}

export function initializeConfigHandlers(ipcMain: IpcMain): void {
    ipcMain.handle(
        IPC_CHANNELS.SAVE_CONFIG,
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

    ipcMain.handle(
        IPC_CHANNELS.GET_CONFIGS,
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

    ipcMain.handle(
        IPC_CHANNELS.GET_CONFIG,
        async (
            _event: IpcMainInvokeEvent,
            configType: ConfigType,
            fileName: string
        ): Promise<unknown | null> => {
            try {
                const baseDir = await ensureConfigDirectory();
                const filePath = path.join(baseDir, configType, `${fileName}.json`);

                const fileContent = await fs.readFile(filePath, 'utf-8');
                return JSON.parse(fileContent);
            } catch (error) {
                console.error('Error reading config:', error);
                return null;
            }
        }
    );

    ipcMain.handle(
        IPC_CHANNELS.DELETE_CONFIG,
        async (
            _event: IpcMainInvokeEvent,
            configType: ConfigType,
            fileName: string
        ): Promise<boolean> => {
            try {
                const baseDir = await ensureConfigDirectory();
                const filePath = path.join(baseDir, configType, `${fileName}.json`);

                await fs.unlink(filePath);
                return true;
            } catch (error) {
                console.error('Error deleting config:', error);
                return false;
            }
        }
    );

    ipcMain.handle(
        IPC_CHANNELS.GET_CONFIG_PATHS,
        async (_event: IpcMainInvokeEvent, configType: ConfigType): Promise<{ name: string; path: string }[]> => {
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