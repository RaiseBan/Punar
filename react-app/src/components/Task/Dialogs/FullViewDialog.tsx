import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody
} from '@mui/material';
import { TaskDataRow } from '../types';

interface FullViewDialogProps {
  open: boolean;
  onClose: () => void;
  name: string;
  columns: string[];
  data: TaskDataRow[];
  isMEVManualMode: boolean;
  onRunRow: (rowIndex: number) => void;
  onDeleteRow: (rowIndex: number) => void;
}

export const FullViewDialog: React.FC<FullViewDialogProps> = ({
  open,
  onClose,
  name,
  columns,
  data,
  isMEVManualMode,
  onRunRow,
  onDeleteRow
}) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Full View: {name}</DialogTitle>
      <DialogContent>
        <Box sx={{ overflowX: "auto" }}>
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#1E1E1E" }}>
                {columns.map((col, i) => (
                  <TableCell
                    key={i}
                    sx={{ color: "#ff9e44", borderBottom: "1px solid #2A2A2A" }}
                  >
                    {col}
                  </TableCell>
                ))}
                {isMEVManualMode && (
                  <TableCell
                    sx={{ color: "#ff9e44", borderBottom: "1px solid #2A2A2A" }}
                  >
                    Actions
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.cells.map((cell, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      sx={{ color: "#fff", borderBottom: "1px solid #2A2A2A" }}
                    >
                      {cell}
                    </TableCell>
                  ))}
                  {isMEVManualMode && (
                    <TableCell sx={{ borderBottom: "1px solid #2A2A2A" }}>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => {
                            if (row.originalIndex !== undefined) {
                              onRunRow(row.originalIndex);
                            }
                          }}
                          sx={{
                            bgcolor: "#00c853",
                            "&:hover": { bgcolor: "#00e676" },
                            color: "white",
                            px: 1.5,
                            py: 0.5
                          }}
                        >
                          Run
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => {
                            if (row.originalIndex !== undefined) {
                              onDeleteRow(row.originalIndex);
                            }
                          }}
                          sx={{
                            bgcolor: "#f44336",
                            "&:hover": { bgcolor: "#ff5252" },
                            color: "white",
                            px: 1.5,
                            py: 0.5
                          }}
                        >
                          Delete
                        </Button>
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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