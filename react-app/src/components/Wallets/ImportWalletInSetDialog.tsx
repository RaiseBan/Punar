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
  setName: string;
  onImport: (publicKey: string, privateKey: string) => Promise<void>;
}

export const ImportWalletInSetDialog: React.FC<Props> = ({ 
  open, 
  onClose, 
  setName,
  onImport 
}) => {
  const [publicKey, setPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await onImport(publicKey, privateKey);
      setPublicKey('');
      setPrivateKey('');
      onClose();
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setPublicKey('');
    setPrivateKey('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import Wallet to "{setName}"</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Public Key"
          type="text"
          fullWidth
          value={publicKey}
          onChange={(e) => setPublicKey(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          margin="dense"
          label="Private Key"
          type="text"
          fullWidth
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Отмена
        </Button>
        <Button 
          onClick={handleSubmit} 
          color="primary"
          disabled={isSubmitting || !publicKey.trim() || !privateKey.trim()}
        >
          Импортировать
        </Button>
      </DialogActions>
    </Dialog>
  );
};