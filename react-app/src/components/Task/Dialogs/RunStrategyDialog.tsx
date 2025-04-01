import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';

interface RunStrategyDialogProps {
  open: boolean;
  onClose: () => void;
  selectedOption: string;
  setSelectedOption: (value: string) => void;
  onRun: () => void;
  disabled: boolean;
}

export const RunStrategyDialog: React.FC<RunStrategyDialogProps> = ({
  open,
  onClose,
  selectedOption,
  setSelectedOption,
  onRun,
  disabled
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>Select Strategy</DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <FormControl fullWidth>
          <InputLabel>Strategy</InputLabel>
          <Select
            value={selectedOption}
            onChange={(e) => setSelectedOption(e.target.value)}
            label="Strategy"
            sx={{ mb: 2 }}
          >
            <MenuItem value="raydium">raydium</MenuItem>
            <MenuItem value="pumpswap">pumpswap</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onRun}
          disabled={disabled}
        >
          Run
        </Button>
      </DialogActions>
    </Dialog>
  );
};
