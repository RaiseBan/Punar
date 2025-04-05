import React, { useState, useCallback, useEffect } from "react";
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

    // Функция для получения MEV процессов и добавления их в Redux
    const fetchMevProcesses = useCallback(async () => {
        if (window.electronAPI?.mevLoadBalancer) {
            try {
                // Получаем процессы MEV LoadBalancer
                const mevProcesses = await window.electronAPI.mevLoadBalancer.getProcesses();
                console.log(`Fetched ${mevProcesses.length} MEV processes`);

                // Добавляем каждый MEV процесс в Redux, если его там еще нет
                mevProcesses.forEach(process => {
                    // Создаем числовой идентификатор
                    const numericId = typeof process.id === 'string' ? parseInt(process.id, 10) : process.id;

                    // Проверяем, существует ли уже такая задача в Redux
                    const existingTask = tasks.find(task =>
                        task.id === numericId ||
                        (typeof process.id === 'string' && task.id === parseInt(process.id, 10))
                    );

                    if (!existingTask && !isNaN(numericId)) {
                        console.log(`Adding MEV process ${process.id} to Redux store`);

                        // Подготавливаем конфигурацию для процесса
                        const taskConfig = {
                            ...process.config,
                            module_name: process.config?.module_name || "mev_subtask",
                            task_name: process.config?.task_name || `MEV Process ${process.id}`
                        };

                        // Добавляем процесс в Redux
                        dispatch(addOrUpdateTask({
                            taskId: numericId || Date.now(),
                            config: taskConfig
                        }));
                    }
                });
            } catch (error) {
                console.error("Error fetching MEV processes:", error);
            }
        }
    }, [dispatch, tasks]);

    // Периодически обновляем список MEV процессов
    useEffect(() => {
        // Загружаем MEV процессы при загрузке компонента
        fetchMevProcesses();

        // Устанавливаем интервал для периодического обновления (каждые 10 секунд)
        const intervalId = setInterval(fetchMevProcesses, 10000);

        // Очищаем интервал при размонтировании компонента
        return () => clearInterval(intervalId);
    }, [fetchMevProcesses]);

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
