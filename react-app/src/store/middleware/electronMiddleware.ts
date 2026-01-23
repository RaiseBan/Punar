import { Middleware } from '@reduxjs/toolkit';
import { addTaskLog, updateTask, addTaskRow } from '../tasksSlice';
import { parseTableRowFromLog } from '../../utils/tableDataParser';
import { RootState } from '../store';

interface ReduxAction {
  type: string;
  payload?: unknown;
}

interface ProcessStartedConfig {
  module_name?: string;
  task_name?: string;
  originalId?: string | number;
  [key: string]: unknown;
}

interface ProcessStartedData {
  taskId: number;
  config?: ProcessStartedConfig;
}

declare global {
  interface Window {
    _electronMiddlewareSubscribed?: boolean;
  }
}

export const electronMiddleware: Middleware = (store) => {
  return (next) => (action) => {
    if (!window.electronAPI) return next(action);

    const typedAction = action as ReduxAction;

    if (!window._electronMiddlewareSubscribed) {
      console.log('✅ Subscribing to Electron IPC events from middleware');

      window.electronAPI.onProcessStarted((event, data) => {
        const typedData = data as ProcessStartedData;
        console.log(
          `⭐ Middleware: Получено событие process-started для taskId=${typedData.taskId}`,
          {
            taskId: typedData.taskId,
            moduleType: typedData.config?.module_name,
            taskName: typedData.config?.task_name,
            originalId: typedData.config?.originalId,
          }
        );

        if (!typedData.taskId) {
          console.error(
            `❌ Middleware: Получен некорректный taskId в событии process-started:`,
            typedData
          );
          return;
        }

        const state = store.getState() as RootState;
        const existingTask = state.tasks.tasks.find((t) => t.id === typedData.taskId);

        if (existingTask) {
          console.log(
            `🔄 Middleware: Задача ${typedData.taskId} уже существует в Redux, обновляем`
          );
        } else {
          console.log(`➕ Middleware: Создаем новую задачу ${typedData.taskId} в Redux`);
        }

        store.dispatch(updateTask({ id: typedData.taskId, status: 'Running' }));
        console.log(`✅ Middleware: Задача ${typedData.taskId} успешно обновлена в Redux`);
      });

      window.electronAPI.onProcessOutput((event, data) => {
        const log = data.log.toString();

        if (
          (log.includes('[') && log.includes(']')) ||
          log.includes('ERROR') ||
          log.includes('error') ||
          log.includes('[TABLE_DATA]')
        ) {
          console.log(
            `Logging message for task ${data.taskId}: ${log.substring(0, 100)}${log.length > 100 ? '...' : ''}`
          );
          store.dispatch(addTaskLog({ taskId: data.taskId, log }));
        } else {
          console.log(`Skipping non-important message for task ${data.taskId}`);
          return;
        }

        const rowCells = parseTableRowFromLog(data.log);
        if (rowCells) {
          store.dispatch(addTaskRow({ taskId: data.taskId, rowCells }));
        }
      });

      window.electronAPI.onProcessExit((event, data) => {
        console.log('Middleware: process exited', data);
        store.dispatch(updateTask({ id: data.taskId, status: 'Stopped' }));
      });

      window._electronMiddlewareSubscribed = true;
    }

    const result = next(action);

    if (typedAction.type === 'tasks/removeTask' && typedAction.payload !== undefined) {
      const taskId = typedAction.payload as number;
      console.log(`Task ${taskId} was removed, cleaning up token list`);
    }

    return result;
  };
};
