// tasksSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { TaskProps } from "../components/Task";

interface TasksState {
    tasks: TaskProps[];
}

const initialState: TasksState = {
    tasks: [],
};

export const tasksSlice = createSlice({
    name: "tasks",
    initialState,
    reducers: {
        addTask: (state, action: PayloadAction<TaskProps>) => {
            state.tasks.push(action.payload);
        },
        removeTask: (state, action: PayloadAction<number>) => {
            state.tasks = state.tasks.filter((task) => task.id !== action.payload);
        },
        updateTask: (state, action) => {
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
            const task = state.tasks.find((t) => t.id === action.payload.taskId);
            if (task) {
                task.logs.push(action.payload.log);
            }
        },
        addOrUpdateTask: (state, action: PayloadAction<{ taskId: number; config: any }>) => {
            const { taskId, config } = action.payload;
            const existing = state.tasks.find((t) => t.id === taskId);

            if (existing) {
                // Обновляем
                existing.status = "Running";
                existing.config = config; // <-- храним конфиг
                if (config.module_name) {
                    existing.moduleName = config.module_name;
                }
                // Если в config есть task_name — берём его за основу
                if (config.task_name) {
                    existing.name = config.task_name;
                }
            } else {
                // Создаём новую таску
                const name = config.task_name || `Task ${config.module_name || ""}`;
                state.tasks.push({
                    id: taskId,
                    name,
                    moduleName: config.module_name || "",
                    status: "Running",
                    columns: [],
                    data: [],
                    logs: [],
                    config, // <-- сохраняем весь конфиг
                });
            }
        },
        addTaskRow: (
            state,
            action: PayloadAction<{ taskId: number; rowCells: string[] }>
        ) => {
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
