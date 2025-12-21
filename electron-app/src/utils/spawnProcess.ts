import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { TaskConfig } from '../../../shared/types';
import { getConfigRepository } from '../repositories';

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
 * Информация о модуле
 */
interface ModuleInfo {
    dir: string;
    file: string;
}

/**
 * Карта модулей
 */
const MODULE_MAP: Record<string, ModuleInfo> = {
    'Tensor sniper (SDK)': { dir: 'tensor-nft-sdk', file: 'index.ts' },
    'Tensor reprice': { dir: 'tensor-reprice', file: 'index.ts' },
    'MEV token release': { dir: 'mev', file: 'index.ts' },
    'Meteora': { dir: 'meteora', file: 'index.ts' },
    'LaunchMyNft': { dir: 'launchmynft', file: 'index.ts' },
};

/**
 * Получить информацию о модуле
 */
function getModuleInfo(moduleName: string): { moduleDir: string | null; fileToExecute: string } {
    const info = MODULE_MAP[moduleName];

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
 * Основная функция запуска процесса
 *
 * Теперь получает настройки внутри через ConfigRepository
 *
 * @param taskConfig - Конфигурация задачи
 * @returns ChildProcess или null в случае ошибки
 */
export async function spawnProcess(
    taskConfig: TaskConfig
): Promise<ChildProcess | null> {
    console.log(`🚀 SPAWN: Запуск процесса для модуля: ${taskConfig.module_name}`);

    // Валидация входных параметров
    if (!taskConfig) {
        console.error('❌ SPAWN: taskConfig не определен');
        return null;
    }

    if (!taskConfig.module_name || !taskConfig.task_name) {
        console.error('❌ SPAWN: taskConfig должен содержать module_name и task_name');
        return null;
    }

    try {
        // Используем ConfigRepository для получения настроек
        const configRepo = getConfigRepository();
        const userSettings = await configRepo.getSettings();

        // getScriptDirectory выбросит ошибку если не настроен
        const scriptDirectory = await configRepo.getScriptDirectory();

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
        const configFileName = `${moduleName}_${taskName}_${taskId}.json`;
        const configFilePath = path.join(configDir, configFileName);

        // Обновляем конфиг для Tensor модулей если нужно
        const updatedConfig = await updateConfigCollectionId(taskConfig);

        if (!updatedConfig) {
            console.error('❌ SPAWN: Не удалось обновить конфигурацию');
            return null;
        }

        // Сохраняем конфиг в файл
        fs.writeFileSync(configFilePath, JSON.stringify(updatedConfig, null, 2), 'utf-8');
        console.log(`💾 SPAWN: Конфиг сохранен: ${configFilePath}`);

        // Получаем информацию о модуле
        const { moduleDir, fileToExecute } = getModuleInfo(taskConfig.module_name);

        if (!moduleDir) {
            console.error(`❌ SPAWN: Неизвестный модуль: ${taskConfig.module_name}`);
            return null;
        }

        // Запускаем процесс
        const child = spawnModuleProcess(scriptDirectory, moduleDir, fileToExecute, configFilePath);

        if (!child.pid) {
            console.error('❌ SPAWN: Не удалось получить PID процесса');
            return null;
        }

        console.log(`✅ SPAWN: Процесс запущен с PID: ${child.pid}`);
        return child;

    } catch (error) {
        console.error('❌ SPAWN: Ошибка при запуске процесса:', error);
        return null;
    }
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
): ProcessOperationResult {
    if (!process) {
        return {
            success: false,
            error: 'Процесс не найден',
        };
    }

    try {
        console.log(`🛑 STOP: Остановка процесса для задачи ${taskId}`);

        if (process.killed) {
            console.log(`⚠️ STOP: Процесс ${taskId} уже остановлен`);
            return {
                success: true,
                message: `Процесс ${taskId} уже остановлен`,
            };
        }

        const killed = process.kill('SIGTERM');

        if (killed) {
            console.log(`✅ STOP: Процесс ${taskId} успешно остановлен`);
            return {
                success: true,
                message: `Процесс ${taskId} остановлен`,
            };
        } else {
            console.warn(`⚠️ STOP: Не удалось отправить SIGTERM процессу ${taskId}`);
            return {
                success: false,
                error: 'Не удалось остановить процесс',
            };
        }
    } catch (error) {
        const err = error as Error;
        console.error(`❌ STOP: Ошибка при остановке процесса ${taskId}:`, err.message);

        return {
            success: false,
            error: err.message,
        };
    }
}