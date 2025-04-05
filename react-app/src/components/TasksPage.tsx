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

    // Функция для получения MEV процессов напрямую и логирования информации
    const checkMevProcesses = useCallback(async () => {
        if (window.electronAPI?.mevLoadBalancer) {
            try {
                console.log('🔍 Проверка MEV процессов напрямую через API...');
                const processes = await window.electronAPI.mevLoadBalancer.getProcesses();
                console.log(`📊 Получено ${processes.length} MEV процессов напрямую:`, processes);

                if (processes.length > 0) {
                    console.log('📝 Детальная информация о MEV процессах:');
                    processes.forEach((proc, idx) => {
                        console.log(`MEV процесс #${idx + 1}:`, {
                            id: proc.id,
                            status: proc.status,
                            token: proc.config?.tokenAddress,
                            meteora: proc.config?.meteoraPool,
                            startTime: new Date(proc.startTime).toLocaleTimeString()
                        });
                    });

                    // Проверяем, есть ли эти процессы в Redux
                    console.log('🔄 Сверка с процессами в Redux:');
                    const mevTasksInRedux = tasks.filter(task =>
                        task.moduleName === 'mev_subtask' ||
                        task.config?.module_name === 'mev_subtask');

                    console.log(`📋 В Redux найдено ${mevTasksInRedux.length} MEV задач`);
                    if (mevTasksInRedux.length > 0) {
                        mevTasksInRedux.forEach(task => {
                            console.log(`Redux MEV задача:`, {
                                id: task.id,
                                name: task.name,
                                module: task.moduleName,
                                status: task.status
                            });
                        });
                    }

                    // Добавляем каждый активный процесс в Redux, если его еще нет
                    const activeProcesses = processes.filter(p => p.status === 'running');
                    activeProcesses.forEach(process => {
                        const numericId = Date.now() + Math.floor(Math.random() * 1000);
                        const existingTask = tasks.find(t =>
                            t.id === numericId ||
                            (t.config?.originalId && t.config.originalId === process.id));

                        if (!existingTask) {
                            console.log(`➕ Добавляем MEV процесс ${process.id} в Redux с ID=${numericId}`);

                            dispatch(addOrUpdateTask({
                                taskId: numericId,
                                config: {
                                    ...process.config,
                                    originalId: process.id,
                                    module_name: process.config?.module_name || "mev_subtask",
                                    task_name: process.config?.task_name || `MEV Process ${process.id}`
                                }
                            }));
                        }
                    });
                }
            } catch (error) {
                console.error('❌ Ошибка при получении MEV процессов:', error);
            }
        }
    }, [dispatch, tasks]);

    // Запускаем периодическую проверку MEV процессов
    useEffect(() => {
        console.log('🚀 TasksPage: компонент смонтирован, запускаем периодическую проверку MEV процессов');

        // Проверяем процессы сразу при монтировании
        checkMevProcesses();

        // Устанавливаем интервал для периодической проверки (каждые 5 секунд)
        const intervalId = setInterval(() => {
            console.log('⏰ Периодическая проверка MEV процессов...');
            checkMevProcesses();
        }, 5000);

        // Логируем текущие задачи при монтировании и изменении
        console.log(`📋 Текущие задачи в Redux (${tasks.length}):`,
            tasks.map(t => ({ id: t.id, name: t.name, module: t.moduleName, status: t.status })));

        // Очищаем интервал при размонтировании компонента
        return () => {
            console.log('TasksPage: компонент размонтирован, очистка интервала');
            clearInterval(intervalId);
        };
    }, [checkMevProcesses, tasks.length]);

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
                DeFi Tasks
            </Typography>

            <Typography variant="body2" sx={{ mb: 1 }}>
                Всего задач: {tasks.length}, MEV задач: {tasks.filter(t => t.moduleName === 'mev_subtask' || t.config?.module_name === 'mev_subtask').length}
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
