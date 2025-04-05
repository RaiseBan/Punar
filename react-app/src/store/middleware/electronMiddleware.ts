import { Middleware } from "@reduxjs/toolkit";
import { addTaskLog, updateTask, addTaskRow, REMOVE_MEV_TOKEN } from "../tasksSlice";
import { parseTableRowFromLog } from "../../utils/tableDataParser";
import { RootState } from "../store";

// Для отслеживания предыдущего состояния задач
let previousTasks: { id: number }[] = [];

// Хранилище для отслеживания обработанных токенов для каждой задачи MEV Module
const processedTokens: { [taskId: number]: Set<string> } = {};

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
        if (typedAction.type === REMOVE_MEV_TOKEN && typedAction.payload) {
            const { taskId, token } = typedAction.payload;

            if (processedTokens[taskId] && token) {
                console.log(`Removing token ${token} from filtered list for task ${taskId}`);
                processedTokens[taskId].delete(token);
                console.log(`Token removed, remaining tokens: ${processedTokens[taskId].size}`);
            }
        }

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
                    // Проверяем, что это задача MEV Module
                    if (task && task.moduleName === "MEV Module") {
                        // Первый элемент в ячейках - это токен
                        const token = rowCells[0]?.trim();

                        // Если токен не определен, просто добавляем строку
                        if (!token) {
                            store.dispatch(addTaskRow({ taskId: data.taskId, rowCells }));
                            return;
                        }

                        // Инициализируем Set для этой задачи, если его еще нет
                        if (!processedTokens[data.taskId]) {
                            processedTokens[data.taskId] = new Set();
                            console.log(`ТОКЕНЫ: Создан новый список для задачи ${data.taskId}`);
                        }

                        // Проверяем, был ли этот токен уже обработан
                        if (processedTokens[data.taskId].has(token)) {
                            console.log(`ТОКЕНЫ: ${token} уже существует в списке для задачи ${data.taskId}, пропускаем`);
                            return;
                        }

                        // Добавляем токен в список обработанных
                        processedTokens[data.taskId].add(token);
                        console.log(`ТОКЕНЫ: Добавлен ${token} в список для задачи ${data.taskId}, 
                            текущее количество: ${processedTokens[data.taskId].size}`);
                    }

                    // Добавляем строку в таблицу если это не дубликат для MEV Module
                    // или для любого другого модуля
                    store.dispatch(addTaskRow({ taskId: data.taskId, rowCells }));
                }
            });

            window.electronAPI.onProcessExit((event, data) => {
                console.log("Middleware: process exited", data);
                store.dispatch(updateTask({ id: data.taskId, status: "Stopped" }));
            });

            // Добавляем обработчик для уведомлений о смене пула Meteora
            window.electronAPI.onPoolChanged((data) => {
                console.log(`Middleware: Pool changed notification for task ${data.taskId}`);
                // Добавляем специальный лог для отображения смены пула
                store.dispatch(addTaskLog({
                    taskId: data.taskId,
                    log: `[MONITOR] Meteora pool change detected, process restarted with better pool`
                }));
            });

            // Указываем, что подписка уже была выполнена
            (window as any)._electronMiddlewareSubscribed = true;
        }

        const result = next(action);

        // После выполнения действия проверяем, не была ли удалена какая-то задача
        if (typedAction.type === 'tasks/removeTask' && typedAction.payload !== undefined) {
            const taskId = typedAction.payload as number;
            console.log(`Task ${taskId} was removed, cleaning up token list`);

            // Удаляем список токенов для удаленной задачи
            if (processedTokens[taskId]) {
                console.log(`ТОКЕНЫ: Удален весь список токенов для задачи ${taskId}`);
                delete processedTokens[taskId];
            }
        }
        // Для других действий проверяем изменения в списке задач
        else if (typedAction.type !== REMOVE_MEV_TOKEN) {
            const state = store.getState() as RootState;
            const currentTasks = state.tasks.tasks.map(t => ({ id: t.id }));

            // Находим задачи, которые были в предыдущем состоянии, но отсутствуют в текущем
            const removedTaskIds = previousTasks
                .filter(prevTask => !currentTasks.some(currTask => currTask.id === prevTask.id))
                .map(task => task.id);

            // Очищаем токены для удаленных задач
            for (const taskId of removedTaskIds) {
                console.log(`Task ${taskId} was removed (detected by state change), cleaning up token list`);
                if (processedTokens[taskId]) {
                    console.log(`ТОКЕНЫ: Удален весь список токенов для задачи ${taskId} (обнаружено по изменению состояния)`);
                    delete processedTokens[taskId];
                }
            }

            // Обновляем предыдущее состояние
            previousTasks = currentTasks;
        }

        return result;
    };
};
