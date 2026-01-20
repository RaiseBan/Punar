import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (setName: string) => Promise<void>;
}

export const CreateSetDialog: React.FC<Props> = ({ open, onClose, onCreate }) => {
  const [setName, setSetName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await onCreate(setName);
      setSetName('');
      onClose();
    } catch (err) {
      console.error('Create set failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to create set');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSetName('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Wallet Set</DialogTitle>
      <DialogContent>
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