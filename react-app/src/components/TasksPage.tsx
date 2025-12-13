import React, { useState, useCallback } from 'react';
import { Box, Button, Typography } from '@mui/material';
import Task from './Task/Task';
import { useDispatch, useSelector } from 'react-redux';
import { addOrUpdateTask } from '../store/tasksSlice';
import { RootState } from '../store/store';
import CreateTaskWizard from './CreateTaskWizard/CreateTaskWizard';
import { useProcessEvents } from '../hooks';

export default function TasksPage() {
  const tasks = useSelector((state: RootState) => state.tasks.tasks);
  const dispatch = useDispatch();
  const [wizardOpen, setWizardOpen] = useState(false);

  // Используем хук для управления IPC событиями
  // Он автоматически подпишется и отпишется от всех событий
  useProcessEvents();

  const handleCreateTask = useCallback(
    (config: unknown) => {
      const taskId = Date.now();
      dispatch(addOrUpdateTask({ taskId, config }));
      window.electronAPI?.startProcess(taskId, config);
      setWizardOpen(false);
    },
    [dispatch]
  );

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        DeFi Tasks
      </Typography>
      <Button variant="contained" onClick={() => setWizardOpen(true)}>
        Create Task +
      </Button>
      <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
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