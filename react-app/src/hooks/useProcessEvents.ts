import { useEffect, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { updateTask, addTaskLog } from '../store/tasksSlice';
import { ProcessStartedEvent, ProcessOutputEvent, ProcessExitEvent } from '../../../shared/types';

/**
 * Хук для управления IPC событиями процессов
 * Автоматически подписывается и отписывается от событий
 * Решает проблему дублирования listeners
 */
export const useProcessEvents = () => {
  const dispatch = useDispatch();
  const isSubscribed = useRef(false);

  // Обработчики событий - используем useCallback чтобы они не пересоздавались
  const handleProcessStarted = useCallback(
    (_event: unknown, data: ProcessStartedEvent) => {
      console.log('[useProcessEvents] Process started:', data);
      dispatch(
        updateTask({
          id: data.taskId,
          status: 'Running',
        })
      );
    },
    [dispatch]
  );

  const handleProcessOutput = useCallback(
    (_event: unknown, data: ProcessOutputEvent) => {
      console.log(`[useProcessEvents] Process output for task ${data.taskId}`);
      dispatch(addTaskLog({ taskId: data.taskId, log: data.log }));
    },
    [dispatch]
  );

  const handleProcessExit = useCallback(
    (_event: unknown, data: ProcessExitEvent) => {
      console.log(`[useProcessEvents] Process exit for task ${data.taskId}, code:`, data.code);
      dispatch(
        updateTask({
          id: data.taskId,
          status: 'Stopped',
        })
      );
    },
    [dispatch]
  );

  useEffect(() => {
    // Защита от повторной подписки
    if (!window.electronAPI || isSubscribed.current) {
      return;
    }

    console.log('[useProcessEvents] Subscribing to process events');
    isSubscribed.current = true;

    // Подписываемся на события
    window.electronAPI.onProcessStarted(handleProcessStarted);
    window.electronAPI.onProcessOutput(handleProcessOutput);
    window.electronAPI.onProcessExit(handleProcessExit);

    // Cleanup функция - вызывается при размонтировании или изменении зависимостей
    return () => {
      console.log('[useProcessEvents] Unsubscribing from process events');
      isSubscribed.current = false;

      if (window.electronAPI) {
        window.electronAPI.removeListener('process-started', handleProcessStarted);
        window.electronAPI.removeListener('process-output', handleProcessOutput);
        window.electronAPI.removeListener('process-exit', handleProcessExit);
      }
    };
  }, [handleProcessStarted, handleProcessOutput, handleProcessExit]);

  return null;
};