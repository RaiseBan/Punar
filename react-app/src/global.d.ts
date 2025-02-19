// global.d.ts
declare module "*.module.css" {
    const classes: { [key: string]: string };
    export default classes;
}

export {};

declare global {
    interface Window {
        electronAPI?: {
            // Методы



            startProcess: (taskId: number, taskConfig: any) => void;
            stopProcess: (taskId: number) => void;
            resumeProcess: (taskId: number, config: any) => void;

            saveScriptDirectory: (directory: string) => void;
            getScriptDirectory: () => Promise<string | null>;

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


        };
    }
}
