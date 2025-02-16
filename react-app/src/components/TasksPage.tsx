import React, { useState, useEffect, useCallback } from "react";
import { Box, Button, Typography } from "@mui/material";
import Task from "./Task";
import CreateTaskWizard from "./CreateTaskWizard";
import { COLS_NAMES } from "../constants";
import { useDispatch, useSelector } from "react-redux";
import {
    addOrUpdateTask,
    addTaskLog,
    addTaskRow,
    updateTask,
} from "../store/tasksSlice";
import { RootState } from "../store/store";
import { parseTableRowFromLog } from "../utils/tableDataParser";

export default function TasksPage() {
    const tasks = useSelector((state: RootState) => state.tasks.tasks);
    const dispatch = useDispatch();
    const [wizardOpen, setWizardOpen] = useState(false);

    const handleCreateTask = useCallback((config: any) => {
        window.electronAPI?.startProcess(config);
        setWizardOpen(false);
    }, []);

    // Обработчик события process-started
    const handleProcessStarted = useCallback(
        (event: any, data: { taskId: number; config: any }) => {
            const { taskId, config } = data;
            dispatch(addOrUpdateTask({ taskId, config }));

            // Если для выбранного модуля определены столбцы, обновляем их
            const moduleName = config.module_name;
            if (moduleName && COLS_NAMES.has(moduleName)) {
                dispatch(updateTask({ id: taskId, columns: COLS_NAMES.get(moduleName) }));
            }
        },
        [dispatch]
    );

    // Обработчик события process-output
    const handleProcessOutput = useCallback(
        (event: any, data: { taskId: number; log: string }) => {
            const { taskId, log } = data;
            dispatch(addTaskLog({ taskId, log }));

            const rowCells = parseTableRowFromLog(log);
            if (rowCells) {
                dispatch(addTaskRow({ taskId, rowCells }));
            }
        },
        [dispatch]
    );

    // Обработчик события process-exit
    const handleProcessExit = useCallback(
        (event: any, data: { taskId: number; code: number }) => {
            const { taskId, code } = data;
            dispatch(updateTask({ id: taskId, status: "Stopped" }));
        },
        [dispatch]
    );

    useEffect(() => {
        if (!window.electronAPI) return;

        window.electronAPI.onProcessStarted(handleProcessStarted);
        window.electronAPI.onProcessOutput(handleProcessOutput);
        window.electronAPI.onProcessExit(handleProcessExit);

        return () => {
            window.electronAPI!.removeListener("process-started", handleProcessStarted);
            window.electronAPI!.removeListener("process-output", handleProcessOutput);
            window.electronAPI!.removeListener("process-exit", handleProcessExit);
        };
    }, [handleProcessStarted, handleProcessOutput, handleProcessExit]);

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
                DeFi Tasks
            </Typography>
            <Button variant="contained" onClick={() => setWizardOpen(true)}>
                Create Task +
            </Button>
            <Box sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 2 }}>
                {tasks.map((t) => (
                    <Task key={t.id} {...t} />
                ))}
            </Box>
            <CreateTaskWizard
                open={wizardOpen}
                onClose={() => setWizardOpen(false)}
                onCreateTask={handleCreateTask}
            />
        </Box>
    );
}
