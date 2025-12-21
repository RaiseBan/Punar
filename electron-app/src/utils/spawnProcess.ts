import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { TaskConfig } from '../../../shared/types';
import { getConfigRepository } from '../repositories';

export interface ProcessOperationResult {
    success: boolean;
    message?: string;
    error?: string;
}

function sanitizeFileName(fileName: string): string {
    return fileName.replace(/[<>:"/\\|?*\s]/g, '_');
}

function getConfigDirectory(): string {
    const userDataPath = process.env.APPDATA || process.env.HOME || '.';
    return path.join(userDataPath, 'electron-app-configs');
}

async function updateConfigCollectionId(config: TaskConfig): Promise<TaskConfig | null> {

    if (
        config.module_name !== 'Tensor sniper (SDK)' &&
        config.module_name !== 'Tensor reprice'
    ) {
        return config;
    }

    return config;
}

interface ModuleInfo {
    dir: string;
    file: string;
}

const MODULE_MAP: Record<string, ModuleInfo> = {
    'Tensor sniper (SDK)': { dir: 'tensor-nft-sdk', file: 'index.ts' },
    'Tensor reprice': { dir: 'tensor-reprice', file: 'index.ts' },
    'MEV token release': { dir: 'mev', file: 'index.ts' },
    'Meteora': { dir: 'meteora', file: 'index.ts' },
    'LaunchMyNft': { dir: 'launchmynft', file: 'index.ts' },
};

function getModuleInfo(moduleName: string): { moduleDir: string | null; fileToExecute: string } {
    const info = MODULE_MAP[moduleName];

    return {
        moduleDir: info?.dir || null,
        fileToExecute: info?.file || 'index.ts',
    };
}

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

export async function spawnProcess(
    taskConfig: TaskConfig
): Promise<ChildProcess | null> {
    console.log(`🚀 SPAWN: Запуск процесса для модуля: ${taskConfig.module_name}`);

    if (!taskConfig) {
        console.error('❌ SPAWN: taskConfig не определен');
        return null;
    }

    if (!taskConfig.module_name || !taskConfig.task_name) {
        console.error('❌ SPAWN: taskConfig должен содержать module_name и task_name');
        return null;
    }

    try {

        const configRepo = getConfigRepository();
        const userSettings = await configRepo.getSettings();

        const scriptDirectory = await configRepo.getScriptDirectory();

        const taskId = taskConfig.taskId || Date.now();
        taskConfig.taskId = taskId;

        const configDir = getConfigDirectory();
        if (!fs.existsSync(configDir)) {
            console.log(`📂 SPAWN: Создаем директорию конфигов: ${configDir}`);
            fs.mkdirSync(configDir, { recursive: true });
        }

        const moduleName = sanitizeFileName(taskConfig.module_name);
        const taskName = sanitizeFileName(taskConfig.task_name);
        const configFileName = `${moduleName}_${taskName}_${taskId}.json`;
        const configFilePath = path.join(configDir, configFileName);

        const updatedConfig = await updateConfigCollectionId(taskConfig);

        if (!updatedConfig) {
            console.error('❌ SPAWN: Не удалось обновить конфигурацию');
            return null;
        }

        fs.writeFileSync(configFilePath, JSON.stringify(updatedConfig, null, 2), 'utf-8');
        console.log(`💾 SPAWN: Конфиг сохранен: ${configFilePath}`);

        const { moduleDir, fileToExecute } = getModuleInfo(taskConfig.module_name);

        if (!moduleDir) {
            console.error(`❌ SPAWN: Неизвестный модуль: ${taskConfig.module_name}`);
            return null;
        }

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

export function forceKillWindowsProcess(pid: number): ProcessOperationResult {
    if (!pid) {
        return {
            success: false,
            error: 'PID не указан',
        };
    }

    try {
        console.log(`🔪 FORCE KILL: Попытка завершить процесс с PID ${pid}`);

        if (process.platform === 'win32') {
            const { execSync } = require('child_process');
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        } else {

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