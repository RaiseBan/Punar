// global.d.ts
import {Wallet} from "./types";

declare module "*.module.css" {
    const classes: { [key: string]: string };
    export default classes;
}
export interface AppSettings {
    walletsSet?: {
        [setName: string]: Wallet[];
    };
    // ... остальные поля, которые могут быть в общих настройках
    scriptDirectory?: string;
    mainRpc?: string;
    additionalRpc?: string;
    heliusRpcs?: string[];
    tensor_api_token?: string;
    bloxroute_api_token?: string;
    thor_streamer_address?: string,
    thor_streamer_token?: string;
}

export {};

declare global {
    interface Window {
        electronAPI?: {
            // Методы

            getSettings: () => Promise<AppSettings>;
            saveSettings: (settings: AppSettings) => Promise<void>;

            startProcess: (taskId: number, taskConfig: any) => void;
            stopProcess: (taskId: number) => void;
            resumeProcess: (taskId: number, config: any) => void;

            // saveScriptDirectory: (directory: string) => void;
            // getScriptDirectory: () => Promise<string | null>;

            // Методы для работы с кошельками
            getWallets: () => Promise<any[]>; // Метод для получения кошельков
            addWallet: (wallet: { publicKey: string; privateKey: string }) => Promise<void>; // Метод для добавления нового кошелька
            deleteWallet: (publicKey: string) => Promise<void>; // Метод для удаления кошелька
            // События:
            // 1) process-started
            onProcessStarted: (
                callback: (
                    event: any,
                    data: { taskId: number; config: any }
                ) => void
            ) => void;

            // 2) process-output
            onProcessOutput: (
                callback: (
                    event: any,
                    data: { taskId: number; log: string }
                ) => void
            ) => void;

            // 3) process-exit
            onProcessExit: (
                callback: (
                    event: any,
                    data: { taskId: number; code: number }
                ) => void
            ) => void;

            // 4) process-error (если нужно)
            onProcessError: (
                callback: (
                    event: any,
                    data: string
                ) => void
            ) => void;

            // Снятие подписчика
            removeListener: (
                channel: string,
                callback: (...args: any[]) => void
            ) => void;

            // Методы для сворачивания окна
            minimizeWindow: () => void;

            // Методы для закрытия окна
            closeWindow: () => void;

            enableDrag: () => void;

            saveConfig: (configType: 'reprice_config' | 'snipe_config', fileName: string, content: any) => Promise<boolean>;
            getConfigs: (configType: 'reprice_config' | 'snipe_config') => Promise<string[]>;
            getConfig: (configType: 'reprice_config' | 'snipe_config', fileName: string) => Promise<any>;
            deleteConfig: (configType: 'reprice_config' | 'snipe_config', fileName: string) => Promise<boolean>;
            getConfigPaths: (configType: 'reprice_config' | 'snipe_config') => Promise<{ name: string; path: string }[]>;


            // tensor api
            tensorAPI: {
                getCollectionInfo: (slug: string) => Promise<string | null>;
                getCollIdByUrl: (url: string) => Promise<string | null>;
                getNftsForCollection: (collId: string, limit?: number, onlyListings?: boolean) => Promise<any>;
                getTxHistory: (params: {
                    collId: string;
                    limit?: number;
                    txTypes?: string[];
                    minPrice?: number;
                    maxPrice?: number;
                    traits?: Record<string, any>;
                    wallet?: string;
                    cursor?: string;
                }) => Promise<any>;
            };

            getTelegramBotStatus: () => Promise<TelegramBotStatus>;
            startTelegramBotStream: () => Promise<{ success: boolean }>;
            stopTelegramBotStream: () => Promise<{ success: boolean }>;

            setTelegramBotToken: (token: string) => Promise<{ success: boolean }>;
            getTelegramBotConfig: () => Promise<{ botToken: string, chatIds: string[] }>;
            sendTelegramTask: (taskData: {
                taskId: number,
                rowIndex: number,
                token: string,
                volumeChange: string,
                volumeValue: number
            }) => Promise<any>;

            // События для обработки команд от Telegram бота
            onTelegramRunTask: (
                callback: (
                    event: any,
                    data: { taskId: number, rowIndex: number, strategy: string }
                ) => void
            ) => void;

            onTelegramDeleteTask: (
                callback: (
                    event: any,
                    data: { taskId: number, rowIndex: number }
                ) => void
            ) => void;
        };
    }
}
