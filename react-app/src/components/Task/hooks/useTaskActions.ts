import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { removeTask, updateTask, addOrUpdateTask, removeMevToken } from '../../../store/tasksSlice';
import { TaskDataRow } from '../types';

export function useTaskActions(
  id: number,
  status: string,
  config: any,
  name: string,
  dataRef: React.MutableRefObject<TaskDataRow[]>,
  processedRowsRef: React.MutableRefObject<string[]>
) {
  const dispatch = useDispatch();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState("");

  // Локальная копия config и данных для редактирования
  const [editConfig, setEditConfig] = useState<any>(config || {});
  const [editName, setEditName] = useState(name);
  const [editModuleName, setEditModuleName] = useState(config?.module_name || '');

  // Проверка на MEV Module
  const isMEVModule = config?.module_name === "MEV Module" || editModuleName === "MEV Module";

  // Функции управления диалогами
  const handleOpenSettings = () => {
    setEditName(name);
    setEditModuleName(config?.module_name || '');
    setEditConfig(config || {});
    setSettingsOpen(true);
  };

  const handleCloseSettings = () => setSettingsOpen(false);
  const handleOpenFullView = () => setFullViewOpen(true);
  const handleCloseFullView = () => setFullViewOpen(false);
  const handleOpenLogs = () => setLogsOpen(true);
  const handleCloseLogs = () => setLogsOpen(false);

  // Функции управления задачей
  const handleSaveSettings = () => {
    dispatch(
      updateTask({
        id,
        name: editName,
        moduleName: editModuleName,
        config: editConfig,
      })
    );
    setSettingsOpen(false);
  };

  const handleStop = () => {
    window.electronAPI?.stopProcess(id);
    dispatch(updateTask({ id, status: "Stopped" }));
  };

  const handleResume = () => {
    window.electronAPI?.resumeProcess(id, editConfig || {});
    dispatch(updateTask({ id, status: "Running" }));
  };

  const handleDelete = () => {
    if (status !== "Stopped") {
      window.electronAPI?.stopProcess(id);
    }
    dispatch(removeTask(id));
  };

  // Функции MEV модуля
  const handleRunMEVTask = async (rowIndex: number, strategy: string) => {
    const currentData = dataRef.current;

    if (!currentData || rowIndex < 0 || rowIndex >= currentData.length) {
      console.error(`Invalid row index: ${rowIndex}, data length: ${currentData?.length || 0}`);
      return;
    }

    const token = currentData[rowIndex]?.cells[0] || "";
    const volume_change = currentData[rowIndex]?.cells[1] || "";
    const volume_value = parseFloat(currentData[rowIndex]?.cells[2] || "0");

    console.log(`Running MEV task for row ${rowIndex}, token: ${token}, strategy: ${strategy}`);

    if (config.globalStrategy === "jito_only") {
      const settings = await window.electronAPI?.getSettings();
      const taskCount = 5;

      const jitoRanges = [
        { lower: 10_000, upper: 100_000 },
        { lower: 100_000, upper: 200_000 },
        { lower: 200_000, upper: 350_000 },
        { lower: 350_000, upper: 550_000 },
        { lower: 550_000, upper: 750_000 }
      ];

      for (let i = 0; i < taskCount; i++) {
        const taskId = Date.now() + i;
        const taskName = `${token}_${volume_change}_${strategy}_jito_subTask_${name}_${i}`;

        const taskConfig = {
          ...config,
          taskId: taskId,
          module_name: "mev_subtask",
          task_name: taskName,
          strategy,
          rowData: currentData[rowIndex]?.cells,
          sourceTaskId: taskId,
          additionalRpc: settings?.additionalRpc,
          useJito: true,
          enablePoolMonitoring: true,
          poolCheckInterval: 10000,
          jito_lower_bound: jitoRanges[i].lower,
          jito_upper_bound: jitoRanges[i].upper
        };

        dispatch(addOrUpdateTask({
          taskId,
          config: taskConfig
        }));

        window.electronAPI?.startProcess(taskId, taskConfig);
      }
    } else {
      console.log("APPROVED");
    }
  };

  const handleDeleteMEVRow = (rowIndexOrId: number | string) => {
    console.log(`Attempting to delete row ${rowIndexOrId} from task ${id}`);

    const currentData = dataRef.current;
    const currentProcessedRows = processedRowsRef.current;

    if (!currentData || currentData.length === 0) {
      console.error(`No data to delete from: data is empty`);
      return;
    }

    let rowIndex: number;

    if (typeof rowIndexOrId === 'string') {
      const foundIndex = currentData.findIndex(row => row.rowId === rowIndexOrId);
      if (foundIndex === -1) {
        console.error(`Row with ID ${rowIndexOrId} not found`);
        return;
      }
      rowIndex = foundIndex;
    } else {
      if (rowIndexOrId < 0 || rowIndexOrId >= currentData.length) {
        console.error(`Row index out of bounds: ${rowIndexOrId}, data length: ${currentData.length}`);
        return;
      }
      rowIndex = rowIndexOrId;
    }

    const rowToDelete = currentData[rowIndex];
    const token = rowToDelete.cells[0]?.trim() || '';

    // Если это задача MEV Module, отправляем специальное действие для удаления токена из фильтра
    if (isMEVModule && token) {
      console.log(`MEV Module: Removing token ${token} from filtered list for task ${id}`);
      dispatch(removeMevToken({
        taskId: id,
        token
      }));
    }

    const newData = [...currentData.slice(0, rowIndex), ...currentData.slice(rowIndex + 1)];
    console.log(`Original data length: ${currentData.length}, New data length: ${newData.length}`);

    const rowIdToDelete = rowToDelete.rowId || '';

    const newProcessedRows = currentProcessedRows.filter(item => {
      return item !== rowIndex.toString() && item !== rowIdToDelete;
    });

    dispatch(
      updateTask({
        id: id,
        data: newData,
        processedTelegramRows: newProcessedRows
      })
    );

    console.log(`Deleted row ${rowIndex} from task ${id}`);
  };

  return {
    settingsOpen,
    fullViewOpen,
    logsOpen,
    showRunDialog,
    selectedRowIndex,
    selectedOption,
    editConfig,
    editName,
    editModuleName,
    setEditName,
    setEditModuleName,
    setEditConfig,
    handleOpenSettings,
    handleCloseSettings,
    handleOpenFullView,
    handleCloseFullView,
    handleOpenLogs,
    handleCloseLogs,
    handleSaveSettings,
    handleStop,
    handleResume,
    handleDelete,
    handleRunMEVTask,
    handleDeleteMEVRow,
    setShowRunDialog,
    setSelectedRowIndex,
    setSelectedOption
  };
}