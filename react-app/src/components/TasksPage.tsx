import React, { useState, useCallback } from "react";
import { Box, Button, Typography } from "@mui/material";
import Task from "./Task";
import CreateTaskWizard from "./CreateTaskWizard";
import { useDispatch, useSelector } from "react-redux";
import { addOrUpdateTask } from "../store/tasksSlice";
import { RootState } from "../store/store";

export default function TasksPage() {
    const tasks = useSelector((state: RootState) => state.tasks.tasks);
    const dispatch = useDispatch();
    const [wizardOpen, setWizardOpen] = useState(false);

    const handleCreateTask = useCallback((config: any) => {
        const taskId = Date.now();

        // Создаем задачу в Redux
        dispatch(addOrUpdateTask({ taskId, config }));

        // Теперь запускаем процесс
        console.log(`config in TasksPage: ${JSON.stringify(config, null, 2)}`);
        window.electronAPI?.startProcess(taskId, config);

        setWizardOpen(false);
    }, [dispatch]);




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
