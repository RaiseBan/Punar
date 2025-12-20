import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { TaskConfig, AppSettings } from '../../../shared/types';

/**
 * Результат операции с процессом
 */
export interface ProcessOperationResult {
    success: boolean;
    message?: string;
    error?: string;
}

/**
 * Очищает имя файла от недопустимых символов
 */
function sanitizeFileName(fileName: string): string {
    return fileName.replace(/[<>:"/\\|?*\s]/g, '_');
}

/**
 * Получает директорию для конфигурационных файлов
 */
function getConfigDirectory(): string {
    const userDataPath = process.env.APPDATA || process.env.HOME || '.';
    return path.join(userDataPath, 'electron-app-configs');
}

/**
 * Обновляет конфигурацию с collection ID для Tensor модулей
 */
async function updateConfigCollectionId(config: TaskConfig): Promise<TaskConfig | null> {
    // Если это не Tensor модуль, возвращаем конфиг как есть
    if (
        config.module_name !== 'Tensor sniper (SDK)' &&
        config.module_name !== 'Tensor reprice'
    ) {
        return config;
    }

    // Здесь может быть логика обновления collection ID
    // Пока просто возвращаем конфиг
    return config;
}

/**
 * Основная функция запуска процесса
 *
 * @param taskConfig - Конфигурация задачи
 * @param userSettings - Настройки пользователя
 * @returns ChildProcess или null в случае ошибки
 */
export async function spawnProcess(
    taskConfig: TaskConfig,
    userSettings: AppSettings
): Promise<ChildProcess | null> {
    console.log(`🚀 SPAWN: Запуск процесса для модуля: ${taskConfig.module_name}`);

    // Валидация входных параметров
    if (!taskConfig) {
        console.error('❌ SPAWN: taskConfig не определен');
        return null;
    }

    if (!userSettings) {
        console.error('❌ SPAWN: userSettings не определен');
        return null;
    }

    if (!userSettings.scriptDirectory) {
        console.error('❌ SPAWN: scriptDirectory не определен в настройках');
        return null;
    }

    if (!taskConfig.module_name || !taskConfig.task_name) {
        console.error('❌ SPAWN: taskConfig должен содержать module_name и task_name');
        return null;
    }

    try {
        const taskId = taskConfig.taskId || Date.now();
        taskConfig.taskId = taskId;

        // Получаем директорию конфигов
        const configDir = getConfigDirectory();
        if (!fs.existsSync(configDir)) {
            console.log(`📂 SPAWN: Создаем директорию конфигов: ${configDir}`);
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Формируем имя файла конфигурации
        const moduleName = sanitizeFileName(taskConfig.module_name);
        const taskName = sanitizeFileName(taskConfig.task_name);
        const configFileName = `${moduleName}_${taskName}.json`;
        const configPath = path.join(configDir, configFileName);

        console.log(`📄 SPAWN: Путь к конфигу: ${configPath}`);

        // Обновляем конфигурацию (для Tensor модулей)
        const updatedTaskConfig = await updateConfigCollectionId(taskConfig);
        if (!updatedTaskConfig) {
            return null;
        }

        // Сохраняем конфигурацию в файл
        fs.writeFileSync(configPath, JSON.stringify(updatedTaskConfig, null, 2), 'utf-8');
        console.log(`✅ SPAWN: Конфигурация сохранена`);

        // Определяем директорию модуля и файл для запуска
        const { moduleDir, fileToExecute } = getModuleInfo(updatedTaskConfig.module_name);

        if (!moduleDir) {
            console.error(`❌ SPAWN: Неизвестный модуль: ${updatedTaskConfig.module_name}`);
            return null;
        }

        // Запускаем процесс
        const child = spawnModuleProcess(
            userSettings.scriptDirectory,
            moduleDir,
            fileToExecute,
            configPath
        );

        if (!child || !child.pid) {
            console.error('❌ SPAWN: Не удалось запустить процесс');
            return null;
        }

        console.log(`✅ SPAWN: Процесс запущен успешно, PID: ${child.pid}`);
        return child;
    } catch (error) {
        console.error('❌ SPAWN: Критическая ошибка:', error);
        return null;
    }
}

/**
 * Получает информацию о модуле (директория и файл запуска)
 */
function getModuleInfo(moduleName: string): {
    moduleDir: string | null;
    fileToExecute: string;
} {
    const moduleMap: Record<string, { dir: string; file: string }> = {
        'Tensor sniper (SDK)': { dir: 'tensor-nft-sdk', file: 'index.ts' },
        'Tensor reprice': { dir: 'tensor_reprice', file: 'index.ts' },
        'LaunchMyNft': { dir: 'mint', file: 'starter.ts' },
        'Meteora DLMM': { dir: 'meteora', file: 'index.ts' },
    };

    const info = moduleMap[moduleName];

    return {
        moduleDir: info?.dir || null,
        fileToExecute: info?.file || 'index.ts',
    };
}

/**
 * Запускает процесс модуля через npx tsx
 */
function spawnModuleProcess(
    scriptDirectory: string,
    moduleDir: string,
    fileToExecute: string,
    configPath: string
): ChildProcess {
    const scriptPath = path.join(scriptDirectory, moduleDir, 'src', fileToExecute);

    console.log(`⚡ SPAWN: Запуск: npx tsx ${scriptPath}`);
    console.log(`📁 SPAWN: Рабочая директория: ${scriptDirectory}`);

    const child = spawn('npx', ['tsx', scriptPath], {
        stdio: 'pipe',
        shell: true,
        detached: false,
        cwd: scriptDirectory,
        env: {
            ...process.env,
            NODE_ENV: process.env.NODE_ENV,
            CONFIG_PATH: configPath,
        },
    });

    return child;
}

/**
 * Принудительно завершает процесс Windows
 */
export function forceKillWindowsProcess(pid: number): ProcessOperationResult {
    if (!pid) {
        return {
            success: false,
            error: 'PID не указан',
        };
    }

    try {
        console.log(`🔪 FORCE KILL: Попытка завершить процесс с PID ${pid}`);

        // Используем taskkill для Windows
        if (process.platform === 'win32') {
            const { execSync } = require('child_process');
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        } else {
            // Для Linux/Mac используем process.kill
            process.kill(pid, 'SIGKILL');
        }

        console.log(`✅ FORCE KILL: Процесс ${pid} успешно завершен`);
        return {
            success: true,
            message: `Процесс ${pid} завершен`,
        };
    } catch (error) {
        const err = error as Error;
        console.error(`❌ FORCE KILL: Ошибка при завершении процесса ${pid}:`, err.message);

        return {
            success: false,
            error: err.message,
        };
    }
}

/**
 * Останавливает процесс
 */
export function stopProcess(
    process: ChildProcess | null,
    taskId: string | number
): Promise<ProcessOperationResult> {
    return new Promise((resolve) => {
        try {
            if (!process) {
                console.log(`⚠️ STOP: Процесс ${taskId} не найден`);
                resolve({
                    success: false,
                    error: 'Процесс не найден',
                });
                return;
            }

            const pid = process.pid;

            if (!pid) {
                console.log(`⚠️ STOP: У процесса ${taskId} нет PID`);
                resolve({
                    success: false,
                    error: 'PID не найден',
                });
                return;
            }

            console.log(`🛑 STOP: Остановка процесса ${taskId} (PID: ${pid})`);

            // Пытаемся graceful shutdown
            const killed = process.kill('SIGTERM');

            if (!killed) {
                console.log(`⚠️ STOP: Не удалось отправить SIGTERM, пробуем принудительное завершение`);
                const result = forceKillWindowsProcess(pid);
                resolve(result);
                return;
            }

            // Даем процессу 5 секунд на graceful shutdown
            setTimeout(() => {
                if (process.exitCode === null) {
                    console.log(`⚠️ STOP: Процесс ${taskId} не завершился, принудительное завершение`);
                    const result = forceKillWindowsProcess(pid);
                    resolve(result);
                } else {
                    console.log(`✅ STOP: Процесс ${taskId} успешно остановлен`);
                    resolve({
                        success: true,
                        message: `Процесс ${taskId} остановлен`,
                    });
                }
            }, 5000);
        } catch (error) {
            const err = error as Error;
            console.error(`❌ STOP: Ошибка при остановке процесса ${taskId}:`, err);
            resolve({
                success: false,
                error: err.message,
            });
        }
    });
}