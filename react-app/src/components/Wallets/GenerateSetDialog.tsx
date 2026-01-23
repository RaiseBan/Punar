import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Alert,
} from '@mui/material';

interface Props {
  open: boolean;
  onClose: () => void;
  onGenerate: (setName: string, count: number) => Promise<void>;
}

export const GenerateSetDialog: React.FC<Props> = ({ open, onClose, onGenerate }) => {
  const [setName, setSetName] = useState('');
  const [count, setCount] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setError(null);
      setIsSubmitting(true);
      await onGenerate(setName, count);
      setSetName('');
      setCount(1);
      onClose();
    } catch (err) {
      console.error('Generate set failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate set');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSetName('');
    setCount(1);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Generate Wallet Set</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          <TextField
            autoFocus
            label="Set Name"
            type="text"
            fullWidth
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
          />
          <TextField
            label="Number of Wallets"
            type="number"
            fullWidth
            value={count}
            onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
            inputProps={{ min: 1 }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Отмена
        </Button>
        <Button 
          onClick={handleSubmit} 
          color="primary"
          disabled={isSubmitting || !setName.trim() || count < 1}
        >
          Сгенерировать
        </Button>
      </DialogActions>
    </Dialog>
  );
};