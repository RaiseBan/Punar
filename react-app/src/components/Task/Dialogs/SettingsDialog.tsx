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

        {/* Настройки для MEV Subtask */}
        {editConfig?.module_name === "mev_subtask" && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              Pool Monitoring Settings
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={editConfig.enablePoolMonitoring === true}
                  onChange={(e) => onConfigChange('enablePoolMonitoring', e.target.checked)}
                  disabled={!canEditConfig}
                />
              }
              label="Enable Meteora Pool Monitoring"
            />

            {editConfig.enablePoolMonitoring && (
              <TextField
                fullWidth
                label="Check Interval (ms)"
                type="number"
                value={editConfig.poolCheckInterval || 300000}
                onChange={(e) => onConfigChange('poolCheckInterval', parseInt(e.target.value))}
                disabled={!canEditConfig}
                helperText="Interval in milliseconds (default: 300000 = 5 minutes)"
                sx={{ mt: 2 }}
                inputProps={{ min: 10000 }}
              />
            )}
          </Box>
        )}

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
