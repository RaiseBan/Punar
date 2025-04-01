import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateTask } from '../../../store/tasksSlice';
import { RootState } from '../../../store/store';
import { TaskDataRow, TelegramTaskData } from '../types';

export function useTaskTelegram(
  id: number,
  data: TaskDataRow[],
  status: string,
  moduleName: string,
  config: any,
  dataRef: React.MutableRefObject<TaskDataRow[]>,
  processedRowsRef: React.MutableRefObject<string[]>,
  handleRunMEVTask: (rowIndex: number, strategy: string) => Promise<void>,
  handleDeleteMEVRow: (rowIndexOrId: number | string) => void
) {
  const dispatch = useDispatch();
  const processingRowRef = useRef(false);

  const logs = useSelector((state: RootState) =>
    state.tasks.tasks.find((task) => task.id === id)?.logs || []
  );

  const processedRows = useSelector((state: RootState) =>
    state.tasks.tasks.find(t => t.id === id)?.processedTelegramRows || []
  );

  // Проверка mode MEV модуля
  const isMEVModule = moduleName === "MEV Module";
  const isMEVTelegramMode = isMEVModule && config?.mode === "by_telegram_bot";
  const isMEVAutomaticMode = isMEVModule && config?.mode === "automatic";

  // Отправка данных в Telegram
  useEffect(() => {
    if (isMEVTelegramMode && data.length > 0 && status === "Running") {
      const sendMessages = async () => {
        if (processingRowRef.current) return;
        processingRowRef.current = true;

        try {
          // Проверка наличия rowId
          let needsUpdate = false;
          const dataWithIds = data.map((row, index) => {
            if (!row.rowId) {
              needsUpdate = true;
              return {
                ...row,
                rowId: `row-${id}-${Date.now()}-${index}`
              };
            }
            return row;
          });

          if (needsUpdate) {
            dispatch(
              updateTask({
                id: id,
                data: dataWithIds
              })
            );
            return;
          }

          // Отправка сообщений
          for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            const row = data[rowIndex];
            const rowId = row.rowId || `row-${id}-${Date.now()}-${rowIndex}`;

            if (!processedRows.includes(rowIndex.toString()) &&
              !processedRows.includes(rowId)) {

              const token = row.cells[0] || "";
              const volumeChange = row.cells[1] || "";
              const volumeValue = parseFloat(row.cells[2] || "0");

              console.log(`Sending row ${rowIndex} to Telegram, token: ${token}, rowId: ${rowId}`);

              const newProcessedRows = [...processedRows, rowId];
              dispatch(
                updateTask({
                  id,
                  processedTelegramRows: newProcessedRows,
                })
              );

              await window.electronAPI?.sendTelegramTask({
                taskId: id,
                rowIndex: rowIndex,
                rowId: rowId,
                token,
                volumeChange,
                volumeValue,
                allCells: row.cells
              } as TelegramTaskData);

              dispatch(
                updateTask({
                  id,
                  logs: [...logs, `Row ${rowIndex} (ID: ${rowId}) sent to Telegram: ${token}`]
                })
              );
            }
          }
        } catch (err) {
          console.error("Error sending task to Telegram:", err);
          dispatch(
            updateTask({
              id,
              logs: [...logs, `ERROR: Failed to send to Telegram: ${err}`]
            })
          );
        } finally {
          processingRowRef.current = false;
        }
      };

      sendMessages();
    }
  }, [data, isMEVTelegramMode, status, processedRows.length]);

  // Проверка конфигурации бота
  useEffect(() => {
    if (isMEVTelegramMode && status === "Running") {
      window.electronAPI?.getTelegramBotConfig().then(config => {
        if (!config || !config.botToken) {
          console.warn("Telegram bot is not configured. Please set up the bot token.");
          dispatch(
            updateTask({
              id,
              logs: [...logs, "WARNING: Telegram bot is not configured. Please set up the bot token."]
            })
          );
        }
      }).catch(err => {
        console.error("Error checking Telegram bot config:", err);
      });
    }
  }, [isMEVTelegramMode, status]);

  // Обработчики событий от Telegram бота
  useEffect(() => {
    if (!window.electronAPI) return;

    console.log(`Setting up Telegram handlers for task ${id}`);

    const runTaskHandler = (event: any, data: { taskId: number, rowIndex: number, strategy: string, rowId?: string }) => {
      const { taskId: telegramTaskId, rowIndex, strategy, rowId } = data;
      console.log(`Received run task event: taskId=${telegramTaskId}, rowIndex=${rowIndex}, strategy=${strategy}, rowId=${rowId || 'undefined'}`);

      if (parseInt(String(telegramTaskId)) === id) {
        const currentData = dataRef.current;

        if (!currentData || currentData.length === 0) {
          console.error(`No data to run task: data is empty`);
          return;
        }

        if (rowId) {
          const foundIndex = currentData.findIndex(row => row.rowId === rowId);
          if (foundIndex !== -1) {
            console.log(`Running task ${id} for row with ID ${rowId} (index ${foundIndex})`);
            handleRunMEVTask(foundIndex, strategy);
            return;
          }
        }

        if (rowIndex >= 0 && rowIndex < currentData.length) {
          console.log(`Running task ${id} for row with index ${rowIndex}`);
          handleRunMEVTask(rowIndex, strategy);
        } else {
          console.error(`Row index out of bounds: ${rowIndex}, data length: ${currentData.length}`);
        }
      }
    };

    const deleteTaskHandler = (event: any, data: { taskId: number, rowIndex: number, rowId?: string }) => {
      const { taskId: telegramTaskId, rowIndex, rowId } = data;
      console.log(`Received delete task event: taskId=${telegramTaskId}, rowIndex=${rowIndex}, rowId=${rowId || 'undefined'}`);

      if (parseInt(String(telegramTaskId)) === id) {
        const currentData = dataRef.current;

        if (!currentData || currentData.length === 0) {
          console.error(`No data to delete from: data is empty`);
          return;
        }

        if (rowId) {
          const foundRow = currentData.find(row => row.rowId === rowId);
          if (foundRow) {
            console.log(`Deleting row with ID ${rowId} from task ${id}`);
            handleDeleteMEVRow(rowId);
            return;
          }
        }

        if (rowIndex >= 0 && rowIndex < currentData.length) {
          console.log(`Deleting row with index ${rowIndex} from task ${id}`);
          handleDeleteMEVRow(rowIndex);
          return;
        }

        console.error(`Could not find row to delete: rowIndex=${rowIndex}, rowId=${rowId}, data length=${currentData.length}`);
      }
    };

    // Добавляем обработчик остановки задачи
    const stopTaskHandler = (event: any, data: { taskId: number }) => {
      const { taskId: telegramTaskId } = data;
      console.log(`Received stop task event: taskId=${telegramTaskId}`);

      if (parseInt(String(telegramTaskId)) === id) {
        console.log(`Stopping task ${id} via Telegram command`);
        if (status === "Running") {
          window.electronAPI?.stopProcess(id);
          dispatch(updateTask({ id, status: "Stopped" }));
        }
      }
    };

    if (window.electronAPI) {
      window.electronAPI.onTelegramRunTask(runTaskHandler);
      window.electronAPI.onTelegramDeleteTask(deleteTaskHandler);
      window.electronAPI.onTelegramStopTask(stopTaskHandler);
    }

    return () => {
      console.log(`Removing Telegram handlers for task ${id}`);
      if (window.electronAPI) {
        window.electronAPI.removeListener('telegram-bot:run-task', runTaskHandler);
        window.electronAPI.removeListener('telegram-bot:delete-task', deleteTaskHandler);
        window.electronAPI.removeListener('telegram-bot:stop-task', stopTaskHandler);
      }
    };
  }, [id]);

  // Автоматический запуск задач в автоматическом режиме
  useEffect(() => {
    if (isMEVAutomaticMode && data.length > 0) {
      const lastRowIndex = data.length - 1;
      const strategy = "pumpswap";
      handleRunMEVTask(lastRowIndex, strategy);
    }
  }, [data.length, isMEVAutomaticMode]);

  return {
    logs,
    isMEVModule,
    isMEVTelegramMode,
    isMEVAutomaticMode,
    isMEVManualMode: isMEVModule && (!config?.mode || config?.mode === "manual")
  };
}
