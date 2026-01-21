import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import Task from './Task/Task';
import CreateTaskWizard from './CreateTaskWizard/CreateTaskWizard';
import { useTasksPage } from '../hooks/useTasksPage';

export default function TasksPage() {
  const {
    tasks,
    wizardOpen,
    openWizard,
    closeWizard,
    handleCreateTask,
  } = useTasksPage();

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        DeFi Tasks
      </Typography>

      <Button variant="contained" onClick={openWizard}>
        Create Task +
      </Button>

      <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {tasks.length > 0 ? (
          tasks.map((task) => <Task key={task.id} {...task} />)
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            No tasks yet. Create your first task!
          </Typography>
        )}
      </Box>

      <CreateTaskWizard
        open={wizardOpen}
        onClose={closeWizard}
        onCreateTask={handleCreateTask}
      />
    </Box>
  );
}