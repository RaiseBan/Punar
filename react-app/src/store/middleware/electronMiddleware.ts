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
                console.log(`Middleware: Process started for task ${data.taskId}`);
                store.dispatch(updateTask({ id: data.taskId, status: "Running" }));
            });

            window.electronAPI.onProcessOutput((event, data) => {
                // console.log("Middleware: process output", data);
                store.dispatch(addTaskLog({ taskId: data.taskId, log: data.log }));

                const rowCells = parseTableRowFromLog(data.log);
                if (rowCells) {
                    // Получаем текущее состояние задачи
                    const state = store.getState() as RootState;
                    const task = state.tasks.tasks.find(t => t.id === data.taskId);

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
                        }

                        // Проверяем, был ли этот токен уже обработан
                        if (processedTokens[data.taskId].has(token)) {
                            console.log(`Token ${token} already processed for task ${data.taskId}, skipping`);
                            return;
                        }

                        // Добавляем токен в список обработанных
                        processedTokens[data.taskId].add(token);
                        console.log(`Added token ${token} to processed list for task ${data.taskId}, 
                            current count: ${processedTokens[data.taskId].size}`);
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
                    delete processedTokens[taskId];
                }
            }

            // Обновляем предыдущее состояние
            previousTasks = currentTasks;
        }

        return result;
    };
};
