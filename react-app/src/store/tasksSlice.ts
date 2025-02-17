import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {TaskDataRow, TaskProps} from "../components/Task";


interface TaskState {
    id: number;
    name: string;
    moduleName: string;
    status: string;
    columns: string[];
    data: TaskDataRow[];
    logs: string[]; // Добавляем логи в состояние Redux
    config?: any;
}

interface TasksState {
    tasks: TaskState[];
}

const initialState: TasksState = {
    tasks: [],
};

export const tasksSlice = createSlice({
    name: "tasks",
    initialState,
    reducers: {
        addTask: (state, action: PayloadAction<TaskProps>) => {
            console.log(`ADD TASK CALLED`);
            const { id, name, moduleName, status, columns, data, config } = action.payload;
            state.tasks.push({
                id,
                name,
                moduleName,
                status,
                columns,
                data,
                logs: [],  // Инициализируем логи как пустой массив
                config,
            });
        },
        removeTask: (state, action: PayloadAction<number>) => {
            console.log(`REMOVE TASK CALLED`);
            state.tasks = state.tasks.filter((task) => task.id !== action.payload);
        },
        updateTask: (state, action) => {
            console.log(`UPDATE TASK CALLED`);
            const { id, name, moduleName, status, columns, config } = action.payload;
            const task = state.tasks.find((t) => t.id === id);
            if (task) {
                if (name !== undefined) task.name = name;
                if (moduleName !== undefined) task.moduleName = moduleName;
                if (status !== undefined) task.status = status;
                if (columns !== undefined) task.columns = columns;
                if (config !== undefined) task.config = config; // ← теперь можно обновлять config
            }
        },
        addTaskLog: (state, action: PayloadAction<{ taskId: number; log: string }>) => {
            console.log(`🟠 Redux addTaskLog called for Task ${action.payload.taskId}:`, action.payload.log);
            const task = state.tasks.find((t) => t.id === action.payload.taskId);
            if (task) {
                task.logs.push(action.payload.log); // Добавляем лог в массив
            }
        },

        addOrUpdateTask: (state, action: PayloadAction<{ taskId: number; config: any }>) => {
            const { taskId, config } = action.payload;
            console.log("🟢 Redux: addOrUpdateTask called", action.payload);

            const existing = state.tasks.find((t) => t.id === taskId);

            if (existing) {
                console.log("🟡 Updating existing task", taskId);
                existing.status = "Running";
                existing.config = config;
                if (config.module_name) {
                    existing.moduleName = config.module_name;
                }
                if (config.task_name) {
                    existing.name = config.task_name;
                }
            } else {
                console.log("🟠 Creating new task", taskId);
                const name = config.task_name || `Task ${config.module_name || ""}`;
                state.tasks.push({
                    id: taskId,
                    name,
                    moduleName: config.module_name || "",
                    status: "Running",
                    columns: [],
                    data: [],
                    logs: [], // Инициализируем массив логов
                    config,
                });
            }
        },
        addTaskRow: (
            state,
            action: PayloadAction<{ taskId: number; rowCells: string[] }>
        ) => {
            console.log(`ADD_TASK_ROW CALLED`);
            const { taskId, rowCells } = action.payload;
            const task = state.tasks.find((t) => t.id === taskId);
            if (task) {
                task.data.push({ cells: rowCells });
            }
        },
    },
});

export const {
    addTask,
    removeTask,
    updateTask,
    addTaskLog,
    addOrUpdateTask,
    addTaskRow,
} = tasksSlice.actions;

export default tasksSlice.reducer;
