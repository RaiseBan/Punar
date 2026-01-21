import { IpcMain, BrowserWindow, app } from 'electron';
import { IPC_CHANNELS } from '../../../shared/types';
import { getProcesses } from './processHandler';
import logger from "../services/loggerService";

export function initializeWindowHandlers(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
    ipcMain.handle(IPC_CHANNELS.MINIMIZE_WINDOW, (): void => {
        mainWindow.minimize();
    });

    ipcMain.handle(IPC_CHANNELS.CLOSE_WINDOW, async (): Promise<void> => {
        logger.info(logger.LOG_MODULES.SYSTEM, '🚪 [WINDOW] Close window requested - stopping all processes...');

        const processes = getProcesses();

        const activeProcessIds = Object.keys(processes).filter(
            id => processes[parseInt(id)]?.isActive
        );

        if (activeProcessIds.length > 0) {
            logger.info(logger.LOG_MODULES.SYSTEM, `🛑 [WINDOW] Stopping ${activeProcessIds.length} active processes...`);

            const stopPromises = activeProcessIds.map(async (taskIdStr) => {
                const taskId = parseInt(taskIdStr);
                const processInfo = processes[taskId];

                if (processInfo?.process && !processInfo.process.killed) {
                    try {
                        logger.info(logger.LOG_MODULES.SYSTEM, `  - Stopping process ${taskId}...`);
                        processInfo.process.kill('SIGTERM');

                        await new Promise((resolve) => {
                            const timeout = setTimeout(() => {
                                if (processInfo.process && !processInfo.process.killed) {
                                    console.warn(`  - Force killing process ${taskId}`);
                                    processInfo.process.kill('SIGKILL');
                                }
                                resolve(null);
                            }, 2000);

                            processInfo.process!.once('exit', () => {
                                clearTimeout(timeout);
                                resolve(null);
                            });
                        });

                        processInfo.isActive = false;
                        logger.info(logger.LOG_MODULES.SYSTEM, `  ✅ Process ${taskId} stopped`);
                    } catch (error) {
                        console.error(`  ❌ Error stopping process ${taskId}:`, error);
                    }
                }
            });

            await Promise.all(stopPromises);
            logger.info(logger.LOG_MODULES.SYSTEM, '✅ [WINDOW] All processes stopped');
        } else {
            logger.info(logger.LOG_MODULES.SYSTEM, 'ℹ️ [WINDOW] No active processes to stop');
        }

        mainWindow.close();
        app.quit();
    });
}