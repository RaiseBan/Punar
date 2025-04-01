import React, { useState, useCallback } from "react";
import { Box, Button, Typography } from "@mui/material";
import AddTaskIcon from "@mui/icons-material/AddTask";
import Task from "./Task/Task";
import { useDispatch, useSelector } from "react-redux";
import { addOrUpdateTask } from "../store/tasksSlice";
import { RootState } from "../store/store";
import CreateTaskWizard from "./CreateTaskWizard/CreateTaskWizard";

export default function TasksPage() {
    const tasks = useSelector((state: RootState) => state.tasks.tasks);
    const dispatch = useDispatch();
    const [wizardOpen, setWizardOpen] = useState(false);

    const handleCreateTask = useCallback((config: any) => {
        const taskId = Date.now();
        dispatch(addOrUpdateTask({ taskId, config }));
        window.electronAPI?.startProcess(taskId, config);
        setWizardOpen(false);
    }, [dispatch]);

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
                DeFi Tasks
            </Typography>

            <Button
                variant="contained"
                startIcon={<AddTaskIcon />}
                onClick={() => setWizardOpen(true)}
                sx={{
                    backgroundColor: "#9c27b0",
                    color: "#fff",
                    padding: "8px 20px",
                    borderRadius: "50px", // делаем кнопку круглой (пилюля)
                    fontWeight: "600",
                    textTransform: "none",
                    boxShadow: "0 3px 10px rgba(156, 39, 176, 0.3)",
                    transition: "all 0.2s ease-in-out",
                    "&:hover": {
                        backgroundColor: "#ab47bc",
                        boxShadow: "0 6px 14px rgba(156, 39, 176, 0.4)",
                        transform: "scale(1.02)",
                    },
                }}
            >
                Create Task
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
