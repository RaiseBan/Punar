import { Middleware } from "@reduxjs/toolkit";
import { addTaskLog, updateTask, addTaskRow } from "../tasksSlice";
import { parseTableRowFromLog } from "../../utils/tableDataParser";

export const electronMiddleware: Middleware = (store) => {
    return (next) => (action) => {
        if (!window.electronAPI) return next(action);

        // Если middleware уже подписался, повторно не подписываемся
        if (!(window as any)._electronMiddlewareSubscribed) {
            console.log("✅ Subscribing to Electron IPC events from middleware");

            window.electronAPI.onProcessStarted((event, data) => {
                console.log(`Middleware: Process started for task ${data.taskId}`);
                store.dispatch(updateTask({ id: data.taskId, status: "Running" }));
            });

            window.electronAPI.onProcessOutput((event, data) => {
                console.log("Middleware: process output", data);
                store.dispatch(addTaskLog({ taskId: data.taskId, log: data.log }));

                const rowCells = parseTableRowFromLog(data.log);
                if (rowCells) {
                    store.dispatch(addTaskRow({ taskId: data.taskId, rowCells }));
                }
            });

            window.electronAPI.onProcessExit((event, data) => {
                console.log("Middleware: process exited", data);
                store.dispatch(updateTask({ id: data.taskId, status: "Stopped" }));
            });

            // Указываем, что подписка уже была выполнена
            (window as any)._electronMiddlewareSubscribed = true;
        }

        return next(action);
    };
};
