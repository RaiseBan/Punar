import { Middleware } from "@reduxjs/toolkit";
import { addTaskLog, updateTask, addTaskRow } from "../tasksSlice";
import { parseTableRowFromLog } from "../../utils/tableDataParser";
import { RootState } from "../store";

// Интерфейс для типизации действий Redux
interface ReduxAction {
    type: string;
    payload?: any;
}

export const electronMiddleware: Middleware = (store) => {
    return (next) => (action) => {
        if (!window.electronAPI) return next(action);

        // Обработка удаления токена из списка фильтрации
        const typedAction = action as ReduxAction;

        // Если middleware уже подписался, повторно не подписываемся
        if (!(window as any)._electronMiddlewareSubscribed) {
            console.log("✅ Subscribing to Electron IPC events from middleware");

            window.electronAPI.onProcessStarted((event, data) => {
                console.log(`⭐ Middleware: Получено событие process-started для taskId=${data.taskId}`, {
                    taskId: data.taskId,
                    moduleType: data.config?.module_name,
                    taskName: data.config?.task_name,
                    originalId: data.config?.originalId
                });

                // Проверяем валидность данных
                if (!data.taskId) {
                    console.error(`❌ Middleware: Получен некорректный taskId в событии process-started:`, data);
                    return;
                }

                // Проверяем, есть ли уже такая задача в Redux
                const state = store.getState() as RootState;
                const existingTask = state.tasks.tasks.find(t => t.id === data.taskId);

                if (existingTask) {
                    console.log(`🔄 Middleware: Задача ${data.taskId} уже существует в Redux, обновляем`);
                } else {
                    console.log(`➕ Middleware: Создаем новую задачу ${data.taskId} в Redux`);
                }

                store.dispatch(updateTask({ id: data.taskId, status: "Running" }));
                console.log(`✅ Middleware: Задача ${data.taskId} успешно обновлена в Redux`);
            });

            window.electronAPI.onProcessOutput((event, data) => {
                // Получаем текущее состояние задачи для проверки модуля
                const state = store.getState() as RootState;
                const task = state.tasks.tasks.find(t => t.id === data.taskId);

                // Проверяем содержимое лога
                const log = data.log.toString();

                // Логируем сообщения, если они:
                // 1. Содержат квадратные скобки [...]
                // 2. Содержат сообщения об ошибках ERROR или error
                // 3. Содержат данные таблицы [TABLE_DATA]
                if (log.includes("[") && log.includes("]") ||
                    log.includes("ERROR") ||
                    log.includes("error") ||
                    log.includes("[TABLE_DATA]")) {

                    console.log(`Logging message for task ${data.taskId}: ${log.substring(0, 100)}${log.length > 100 ? '...' : ''}`);
                    store.dispatch(addTaskLog({ taskId: data.taskId, log }));
                } else {
                    // Для незначимых сообщений просто выходим
                    console.log(`Skipping non-important message for task ${data.taskId}`);
                    return;
                }

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

        const result = next(action);

        // После выполнения действия проверяем, не была ли удалена какая-то задача
        if (typedAction.type === 'tasks/removeTask' && typedAction.payload !== undefined) {
            const taskId = typedAction.payload as number;
            console.log(`Task ${taskId} was removed, cleaning up token list`);
        }

        return result;
    };
};
