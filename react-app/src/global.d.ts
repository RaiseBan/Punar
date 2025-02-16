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
            startProcess: (taskConfig: any) => void;
            stopProcess: (taskId: number) => void;
            resumeProcess: (taskId: number, config: any) => void;

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
        };
    }
}
