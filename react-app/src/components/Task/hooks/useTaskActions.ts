import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { removeTask, updateTask } from '../../../store/tasksSlice';
import { TaskDataRow } from '../types';
import { TaskConfig } from '../../../../../shared/types';

export function useTaskActions(
  id: number,
  status: string,
  config: TaskConfig | undefined,
  name: string,
  dataRef: React.MutableRefObject<TaskDataRow[]>,
  processedRowsRef: React.MutableRefObject<string[]>
) {
  const dispatch = useDispatch();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);

  const [editConfig, setEditConfig] = useState<Partial<TaskConfig>>(config || {});
  const [editName, setEditName] = useState(name);
  const [editModuleName, setEditModuleName] = useState(config?.module_name || '');

  const handleOpenSettings = () => {
    setEditName(name);
    setEditModuleName(config?.module_name || '');
    setEditConfig(config || {});
    setSettingsOpen(true);
  };

  const handleCloseSettings = () => setSettingsOpen(false);
  const handleOpenFullView = () => setFullViewOpen(true);
  const handleCloseFullView = () => setFullViewOpen(false);

  const handleOpenLogs = () => {
    console.log(`Opening logs file for task ${id}`);
    window.electronAPI.openLogFile(id).catch((err: Error) => {
      console.error(`Error opening log file: ${err}`);
    });
  };

  const handleCloseLogs = () => setLogsOpen(false);

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
    window.electronAPI.stopProcess(id);
    dispatch(updateTask({ id, status: 'Stopped' }));
  };

  const handleResume = () => {
    window.electronAPI.resumeProcess(id, editConfig || {});
    dispatch(updateTask({ id, status: 'Running' }));
  };

  const handleDelete = () => {
    if (status !== 'Stopped') {
      window.electronAPI.stopProcess(id);
    }
    dispatch(removeTask(id));
  };

  const handleDeleteRow = (rowIndexOrId: number | string) => {
    console.log(`Attempting to delete row ${rowIndexOrId} from task ${id}`);

    const currentData = dataRef.current;
    const currentProcessedRows = processedRowsRef.current;

    if (!currentData || currentData.length === 0) {
      console.error(`No data to delete from: data is empty`);
      return;
    }

    let rowIndex: number;

    if (typeof rowIndexOrId === 'string') {
      const foundIndex = currentData.findIndex((row) => row.rowId === rowIndexOrId);
      if (foundIndex === -1) {
        console.error(`Row with ID ${rowIndexOrId} not found`);
        return;
      }
      rowIndex = foundIndex;
    } else {
      if (rowIndexOrId < 0 || rowIndexOrId >= currentData.length) {
        console.error(
          `Row index out of bounds: ${rowIndexOrId}, data length: ${currentData.length}`
        );
        return;
      }
      rowIndex = rowIndexOrId;
    }

    const rowToDelete = currentData[rowIndex];
    const newData = [...currentData.slice(0, rowIndex), ...currentData.slice(rowIndex + 1)];

    console.log(`Original data length: ${currentData.length}, New data length: ${newData.length}`);

    const rowIdToDelete = rowToDelete.rowId || '';
    const newProcessedRows = currentProcessedRows.filter((item) => {
      return item !== rowIndex.toString() && item !== rowIdToDelete;
    });

    dispatch(
      updateTask({
        id: id,
        data: newData,
        processedTelegramRows: newProcessedRows,
      })
    );

    console.log(`Deleted row ${rowIndex} from task ${id}`);
  };

  return {
    settingsOpen,
    fullViewOpen,
    logsOpen,
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
    handleDeleteRow,
  };
}
