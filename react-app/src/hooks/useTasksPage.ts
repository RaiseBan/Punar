import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addOrUpdateTask } from '../store/tasksSlice';
import { RootState } from '../store/store';
import { TaskConfig } from '../../../shared/types';

export function useTasksPage() {
  const tasks = useSelector((state: RootState) => state.tasks.tasks);
  const dispatch = useDispatch();
  const [wizardOpen, setWizardOpen] = useState(false);

  const openWizard = useCallback(() => {
    setWizardOpen(true);
  }, []);

  const closeWizard = useCallback(() => {
    setWizardOpen(false);
  }, []);

  const handleCreateTask = useCallback(
    (config: TaskConfig) => {
      const taskId = Date.now();
      dispatch(addOrUpdateTask({ taskId, config }));
      window.electronAPI.startProcess(taskId, config);
      closeWizard();
    },
    [dispatch, closeWizard]
  );

  return {
    tasks,
    wizardOpen,
    openWizard,
    closeWizard,
    handleCreateTask,
  };
}
