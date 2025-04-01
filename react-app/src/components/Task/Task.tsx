import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
} from "@mui/material";

import { useDispatch } from "react-redux";
import { updateTask } from "../../store/tasksSlice";
import { useTaskData } from "./hooks/useTaskData";
import { useTaskActions } from "./hooks/useTaskActions";
import { useTaskTelegram } from "./hooks/useTaskTelegram";
import { fetchImageUrl } from "../../utils/tensorFunctions";
import { TaskHeader } from "./TaskHeader";
import { TaskDataTable } from "./TaskDataTable";
import {
  SettingsDialog,
  FullViewDialog,
  LogsDialog,
  RunStrategyDialog
} from "./Dialogs";
import { TaskProps } from "./types";
import { COLS_NAMES } from "../../constants";

export default function Task(props: TaskProps) {
  const {
    id,
    name,
    moduleName,
    status,
    columns,
    data,
    config
  } = props;

  const dispatch = useDispatch();

  // Состояние для изображения коллекции Tensor
  const [imageUrl, setImageUrl] = useState<string>("");

  // Получаем данные и методы из пользовательских хуков
  const taskData = useTaskData(id, data, columns && columns.length > 0 ? columns : COLS_NAMES.get(moduleName) || []);

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
    taskData.processedRowsRef,
    taskActions.handleRunMEVTask,
    taskActions.handleDeleteMEVRow
  );

  // Загрузка изображения для Tensor
  useEffect(() => {
    let isMounted = true;
    if (moduleName === "Tensor sniper (SDK)" && config?.collection_id) {
      fetchImageUrl(config.collection_id).then((url) => {
        if (isMounted) {
          setImageUrl(url!);
        }
      });
    } else {
      setImageUrl("");
    }
    return () => {
      isMounted = false;
    };
  }, [moduleName, config?.collection_id]);

  // Формируем label для коллекции
  let collectionLabel = "";
  if (moduleName === "Tensor sniper (SDK)" && config?.collection_id) {
    const parts = config.collection_id.split("/");
    const lastPart = parts[parts.length - 1] || "";
    collectionLabel = lastPart.toUpperCase();
  }

  // Обработчики для таблицы
  const handleRunTableRow = (rowIndex: number) => {
    taskActions.setSelectedRowIndex(rowIndex);
    taskActions.setShowRunDialog(true);
  };

  // Обработчик для запуска задачи из диалога
  const handleRunFromDialog = () => {
    if (taskActions.selectedRowIndex !== null && taskActions.selectedOption) {
      taskActions.handleRunMEVTask(taskActions.selectedRowIndex, taskActions.selectedOption);
      taskActions.setShowRunDialog(false);
      taskActions.setSelectedOption("");
    }
  };

  // Определяем, можно ли редактировать конфигурацию
  const canEditConfig = status === "Stopped";

  // Обработчики для настроек
  const handleNameChange = (value: string) => {
    taskActions.setEditName(value);
  };

  const handleModuleNameChange = (value: string) => {
    taskActions.setEditModuleName(value);
  };

  const handleConfigChange = (key: string, value: any) => {
    const updatedConfig = { ...taskActions.editConfig, [key]: value };
    taskActions.setEditConfig(updatedConfig);
  };

  return (
    <>
      <Card
        sx={{
          backgroundColor: "#0e0e0e",
          color: "#fff",
          width: "100%",
          borderRadius: "8px",
          border: "1px solid #2A2A2A",
          padding: "10px",
        }}
      >
        <CardContent sx={{ padding: "10px" }}>
          <TaskHeader
            name={name}
            moduleName={moduleName}
            status={status}
            tableCollapsed={taskData.tableCollapsed}
            toggleTable={taskData.toggleTable}
            imageUrl={imageUrl}
            collectionLabel={collectionLabel}
            config={config}
            isMEVTelegramMode={taskTelegram.isMEVTelegramMode}
            handleOpenFullView={taskActions.handleOpenFullView}
            handleOpenSettings={taskActions.handleOpenSettings}
            handleOpenLogs={taskActions.handleOpenLogs}
            handleStop={taskActions.handleStop}
            handleResume={taskActions.handleResume}
            handleDelete={taskActions.handleDelete}
          />

          <TaskDataTable
            columns={columns && columns.length > 0 ? columns : COLS_NAMES.get(moduleName) || []}
            sortedData={taskData.sortedData}
            orderBy={taskData.orderBy}
            order={taskData.order}
            handleRequestSort={taskData.handleRequestSort}
            isMEVManualMode={taskTelegram.isMEVManualMode}
            isMEVTelegramMode={taskTelegram.isMEVTelegramMode}
            onRunRow={handleRunTableRow}
            onDeleteRow={taskActions.handleDeleteMEVRow}
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
        columns={columns}
        data={data}
        isMEVManualMode={taskTelegram.isMEVManualMode}
        onRunRow={handleRunTableRow}
        onDeleteRow={taskActions.handleDeleteMEVRow}
      />

      <LogsDialog
        open={taskActions.logsOpen}
        onClose={taskActions.handleCloseLogs}
        name={name}
        logs={taskTelegram.logs}
      />

      <RunStrategyDialog
        open={taskActions.showRunDialog}
        onClose={() => {
          taskActions.setShowRunDialog(false);
          taskActions.setSelectedOption("");
        }}
        selectedOption={taskActions.selectedOption}
        setSelectedOption={taskActions.setSelectedOption}
        onRun={handleRunFromDialog}
        disabled={!taskActions.selectedOption}
      />
    </>
  );
}
