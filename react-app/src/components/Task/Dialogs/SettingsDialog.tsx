import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Divider
} from '@mui/material';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  editName: string;
  editModuleName: string;
  editConfig: any;
  canEditConfig: boolean;
  onNameChange: (value: string) => void;
  onModuleNameChange: (value: string) => void;
  onConfigChange: (key: string, value: any) => void;
  onSave: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onClose,
  editName,
  editModuleName,
  editConfig,
  canEditConfig,
  onNameChange,
  onModuleNameChange,
  onConfigChange,
  onSave
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Task Settings</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
        <TextField
          label="Task Name"
          variant="outlined"
          value={editName}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={!canEditConfig}
        />

        <TextField
          label="Module Name"
          variant="outlined"
          value={editModuleName}
          onChange={(e) => onModuleNameChange(e.target.value)}
          disabled={!canEditConfig}
        />

        {/* Если модуль "Tensor sniper (SDK)", показываем threshold_price */}
        {editConfig?.module_name === "Tensor sniper (SDK)" && (
          <TextField
            label="Threshold Price"
            type="number"
            value={editConfig.threshold_price ?? 0}
            disabled={!canEditConfig}
            onChange={(e) => onConfigChange('threshold_price', parseFloat(e.target.value))}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={onSave}
          disabled={!canEditConfig}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
