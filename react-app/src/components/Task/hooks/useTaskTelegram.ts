import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateTask } from '../../../store/tasksSlice';
import { RootState } from '../../../store/store';
import { TaskDataRow } from '../types';
import { TaskConfig } from '../../../../../shared/types';

export function useTaskTelegram(
  id: number,
  data: TaskDataRow[],
  status: string,
  moduleName: string,
  config: TaskConfig | undefined
) {
  const dispatch = useDispatch();

  const logs = useSelector(
    (state: RootState) => state.tasks.tasks.find((task) => task.id === id)?.logs || []
  );

  useEffect(() => {
    console.log(`Setting up Telegram handlers for task ${id}`);

    const stopTaskHandler = (...args: unknown[]) => {
      const data = args[1] as { taskId: number };
      const telegramTaskId = data.taskId;
      console.log(`[StopTask] Received Telegram stop request for task ${telegramTaskId}`);

      if (telegramTaskId === id) {
        console.log(`[StopTask] Stopping task ${id}`);
        window.electronAPI?.stopProcess(id);
        dispatch(updateTask({ id, status: 'Stopped' }));
      }
    };

    const removeTaskHandler = (...args: unknown[]) => {
      const data = args[1] as { taskId: number };
      const telegramTaskId = data.taskId;
      console.log(`[RemoveTask] Received Telegram remove request for task ${telegramTaskId}`);

      if (telegramTaskId === id) {
        console.log(`[RemoveTask] Removing task ${id}`);
        if (status !== 'Stopped') {
          window.electronAPI?.stopProcess(id);
        }
      }
    };

    const resumeTaskHandler = (...args: unknown[]) => {
      const data = args[1] as { taskId: number };
      const telegramTaskId = data.taskId;
      console.log(`[ResumeTask] Received Telegram resume request for task ${telegramTaskId}`);

      if (telegramTaskId === id) {
        const configExists = config !== undefined && config !== null;
        console.log(
          `[ResumeTask] Resuming task ${id}, config ${configExists ? 'exists' : 'missing'}`
        );

        if (configExists) {
          window.electronAPI?.resumeProcess(id, config);
          dispatch(updateTask({ id, status: 'Running' }));
        }
      }
    };

    if (window.electronAPI) {
      window.electronAPI.onTelegramStopTask(stopTaskHandler);
      window.electronAPI.onTelegramRemoveTask(removeTaskHandler);
      window.electronAPI.onTelegramResumeTask(resumeTaskHandler);
    }

    return () => {
      console.log(`Removing Telegram handlers for task ${id}`);
      if (window.electronAPI) {
        window.electronAPI.removeListener('telegram-bot:stop-task', stopTaskHandler);
        window.electronAPI.removeListener('telegram-bot:remove-task', removeTaskHandler);
        window.electronAPI.removeListener('telegram-bot:resume-task', resumeTaskHandler);
      }
    };
  }, [id, config, status, dispatch]);

  return {
    logs,
  };
}
