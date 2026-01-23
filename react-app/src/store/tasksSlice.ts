import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TaskDataRow, TaskProps } from '../components/Task/types';
import { TaskConfig } from '../../../shared/types';

interface TaskState {
  id: number;
  name: string;
  moduleName: string;
  status: string;
  columns: string[];
  data: TaskDataRow[];
  logs: string[];
  config?: TaskConfig;
  processedTelegramRows?: string[];
}

interface TasksState {
  tasks: TaskState[];
}

const initialState: TasksState = {
  tasks: [],
};

export const tasksSlice = createSlice({
  name: 'tasks',
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
        logs: [],
        config,
        processedTelegramRows: [],
      });
    },

    removeTask: (state, action: PayloadAction<number>) => {
      console.log(`REMOVE TASK CALLED`);
      state.tasks = state.tasks.filter((task) => task.id !== action.payload);
    },

    updateTask: (state, action) => {
      console.log(`UPDATE TASK CALLED`, action.payload);
      const { id, name, moduleName, status, columns, config, data, processedTelegramRows } =
        action.payload;
      const task = state.tasks.find((t) => t.id === id);

      if (task) {
        if (name !== undefined) task.name = name;
        if (moduleName !== undefined) task.moduleName = moduleName;
        if (status !== undefined) task.status = status;
        if (columns !== undefined) task.columns = columns;
        if (config !== undefined) task.config = config;
        if (data !== undefined) task.data = data;
        if (processedTelegramRows !== undefined) {
          task.processedTelegramRows = processedTelegramRows;
        }
      }
    },

    addTaskLog: (state, action: PayloadAction<{ taskId: number; log: string }>) => {
      const { taskId, log } = action.payload;
      const task = state.tasks.find((t) => t.id === taskId);
      if (task) {
        task.logs.push(log);
      }
    },

    addOrUpdateTask: (state, action: PayloadAction<{ taskId: number; config: TaskConfig }>) => {
      const { taskId, config } = action.payload;
      const existingTask = state.tasks.find((t) => t.id === taskId);

      if (existingTask) {
        console.log('🔵 Updating existing task', taskId);
        existingTask.config = config;
        existingTask.status = 'Running';
      } else {
        console.log('🟠 Creating new task', taskId);
        const name = config.task_name || `Task ${config.module_name || ''}`;
        state.tasks.push({
          id: taskId,
          name,
          moduleName: config.module_name || '',
          status: 'Running',
          columns: [],
          data: [],
          logs: [],
          config,
          processedTelegramRows: [],
        });
      }
    },

    addTaskRow: (state, action: PayloadAction<{ taskId: number; rowCells: string[] }>) => {
      console.log(`ADD_TASK_ROW CALLED`);
      const { taskId, rowCells } = action.payload;
      const task = state.tasks.find((t) => t.id === taskId);
      if (task) {
        task.data.push({ cells: rowCells });
      }
    },
  },
});

export const { addTask, removeTask, updateTask, addTaskLog, addOrUpdateTask, addTaskRow } =
  tasksSlice.actions;

export default tasksSlice.reducer;
