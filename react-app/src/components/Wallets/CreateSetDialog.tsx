import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
} from '@mui/material';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (setName: string) => Promise<void>;
}

export const CreateSetDialog: React.FC<Props> = ({ open, onClose, onCreate }) => {
  const [setName, setSetName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setError(null);
      setIsSubmitting(true);
      await onCreate(setName);
      setSetName('');
      onClose();
    } catch (err) {
      console.error('Create set failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to create set');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSetName('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Wallet Set</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          autoFocus
          margin="dense"
          label="Set Name"
          type="text"
          fullWidth
          value={setName}
          onChange={(e) => setSetName(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Отмена
        </Button>
        <Button 
          onClick={handleSubmit} 
          color="primary"
          disabled={isSubmitting || !setName.trim()}
        >
          Создать
        </Button>
      </DialogActions>
    </Dialog>
  );
};