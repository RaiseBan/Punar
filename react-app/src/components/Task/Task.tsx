import React, { useCallback, useMemo } from 'react';
import { Card, CardContent } from '@mui/material';
import { useTaskData } from './hooks/useTaskData';
import { useTaskActions } from './hooks/useTaskActions';
import { useTaskTelegram } from './hooks/useTaskTelegram';
import { useTaskImage } from './hooks/useTaskImage';
import { TaskHeader } from './TaskHeader';
import { TaskDataTable } from './TaskDataTable';
import { SettingsDialog, FullViewDialog, LogsDialog } from './Dialogs';
import { TaskProps } from './types';
import { COLS_NAMES } from '../../constants';

export default function Task(props: TaskProps) {
  const { id, name, moduleName, status, columns, data, config } = props;

  // Мемоизация columns - вычисляется только когда меняется moduleName или columns
  const effectiveColumns = useMemo(() => {
    return columns && columns.length > 0 
      ? columns 
      : COLS_NAMES.get(moduleName) || [];
  }, [columns, moduleName]);

  // Хуки для управления состоянием и логикой
  const taskData = useTaskData(id, data, effectiveColumns);

  const taskActions = useTaskActions(
    id,
    status,
    config,
    name,
    taskData.dataRef,
    taskData.processedRowsRef
  );

  const taskTelegram = useTaskTelegram(
    id,
    data,
    status,
    moduleName,
    config,
    taskData.dataRef,
    taskData.processedRowsRef
  );

  const { imageUrl, collectionLabel } = useTaskImage(moduleName, config);

  // Определяем, можно ли редактировать конфигурацию
  const canEditConfig = status === 'Stopped';

  // Обработчики для изменения настроек (мемоизированы для предотвращения лишних ререндеров)
  const handleNameChange = useCallback((value: string) => {
    taskActions.setEditName(value);
  }, [taskActions]);

  const handleModuleNameChange = useCallback((value: string) => {
    taskActions.setEditModuleName(value);
  }, [taskActions]);

  const handleConfigChange = useCallback((key: string, value: any) => {
    const updatedConfig = { ...taskActions.editConfig, [key]: value };
    taskActions.setEditConfig(updatedConfig);
  }, [taskActions]);

  return (
    <>
      <Card
        sx={{
          backgroundColor: '#0e0e0e',
          color: '#fff',
          width: '100%',
          borderRadius: '8px',
          border: '1px solid #2A2A2A',
          padding: '10px',
        }}
      >
        <CardContent sx={{ padding: '10px' }}>
          <TaskHeader
            name={name}
            moduleName={moduleName}
            status={status}
            tableCollapsed={taskData.tableCollapsed}
            toggleTable={taskData.toggleTable}
            imageUrl={imageUrl}
            collectionLabel={collectionLabel}
            config={config}
            handleOpenFullView={taskActions.handleOpenFullView}
            handleOpenSettings={taskActions.handleOpenSettings}
            handleOpenLogs={taskActions.handleOpenLogs}
            handleStop={taskActions.handleStop}
            handleResume={taskActions.handleResume}
            handleDelete={taskActions.handleDelete}
          />

          <TaskDataTable
            columns={effectiveColumns}
            sortedData={taskData.sortedData}
            orderBy={taskData.orderBy}
            order={taskData.order}
            handleRequestSort={taskData.handleRequestSort}
            onDeleteRow={taskActions.handleDeleteRow}
          />
        </CardContent>
      </Card>

      {/* Диалоги */}
      <SettingsDialog
        open={taskActions.settingsOpen}
        onClose={taskActions.handleCloseSettings}
        editName={taskActions.editName}
        editModuleName={taskActions.editModuleName}
        editConfig={taskActions.editConfig}
        canEditConfig={canEditConfig}
        onNameChange={handleNameChange}
        onModuleNameChange={handleModuleNameChange}
        onConfigChange={handleConfigChange}
        onSave={taskActions.handleSaveSettings}
      />

      <FullViewDialog
        open={taskActions.fullViewOpen}
        onClose={taskActions.handleCloseFullView}
        name={name}
        columns={effectiveColumns}
        data={data}
        onDeleteRow={taskActions.handleDeleteRow}
      />

      <LogsDialog
        open={taskActions.logsOpen}
        onClose={taskActions.handleCloseLogs}
        name={name}
        logs={taskTelegram.logs}
      />
    </>
  );
}