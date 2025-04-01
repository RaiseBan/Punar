import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography
} from '@mui/material';

interface LogsDialogProps {
  open: boolean;
  onClose: () => void;
  name: string;
  logs: string[];
}

export const LogsDialog: React.FC<LogsDialogProps> = ({
  open,
  onClose,
  name,
  logs
}) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Logs for {name}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ maxHeight: 400, overflowY: "auto" }}>
          {logs.map((log, index) => (
            <Typography key={index} variant="body2" sx={{ color: "#fff" }}>
              {log}
            </Typography>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
