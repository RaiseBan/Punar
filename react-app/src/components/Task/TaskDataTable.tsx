import React from 'react';
import {
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableSortLabel,
  Button,
  Typography
} from '@mui/material';
import { TaskDataRow } from './types';

interface TaskDataTableProps {
  columns: string[];
  sortedData: TaskDataRow[];
  orderBy: string;
  order: 'asc' | 'desc';
  handleRequestSort: (property: string) => void;
  isMEVManualMode: boolean;
  isMEVTelegramMode: boolean;
  onRunRow: (rowIndex: number) => void;
  onDeleteRow: (rowIndex: number) => void;
}

export const TaskDataTable: React.FC<TaskDataTableProps> = ({
  columns,
  sortedData,
  orderBy,
  order,
  handleRequestSort,
  isMEVManualMode,
  isMEVTelegramMode,
  onRunRow,
  onDeleteRow
}) => {
  return (
    <Box sx={{
      width: "100%",
      marginTop: "10px",
      overflowX: "auto",
      '&::-webkit-scrollbar': {
        height: '8px',
      },
      '&::-webkit-scrollbar-track': {
        background: '#1E1E1E',
        borderRadius: '4px',
      },
      '&::-webkit-scrollbar-thumb': {
        background: '#666',
        borderRadius: '4px',
        '&:hover': {
          background: '#888',
        },
      },
    }}>
      <Table
        sx={{
          minWidth: 500,
          tableLayout: 'fixed',
          '& .MuiTableCell-root': {
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '200px',
          },
          '& .MuiTableCell-head': {
            backgroundColor: '#1E1E1E',
            color: '#ff9e44',
            fontWeight: 'bold',
            borderBottom: '1px solid #2A2A2A',
          },
          '& .MuiTableCell-body': {
            color: '#fff',
            borderBottom: '1px solid #2A2A2A',
          },
        }}
      >
        <TableHead>
          <TableRow>
            {columns.map((col, i) => (
              <TableCell
                key={i}
                sx={{
                  ...(col.toLowerCase().includes('address') && { minWidth: '300px' }),
                  ...(col.toLowerCase().includes('name') && { minWidth: '150px' }),
                  ...(col.toLowerCase().includes('volume') && { minWidth: '120px' }),
                  ...(col.toLowerCase().includes('price') && { minWidth: '100px' }),
                  ...(col.toLowerCase().includes('action') && { width: '120px' }),
                }}
              >
                <TableSortLabel
                  active={orderBy === col}
                  direction={orderBy === col ? order : 'asc'}
                  onClick={() => handleRequestSort(col)}
                  sx={{
                    color: '#ff9e44',
                    '&.MuiTableSortLabel-active': {
                      color: '#ff9e44',
                    },
                    '& .MuiTableSortLabel-icon': {
                      color: '#ff9e44',
                    },
                  }}
                >
                  {col}
                </TableSortLabel>
              </TableCell>
            ))}
            {isMEVManualMode && (
              <TableCell
                sx={{
                  width: '120px',
                  minWidth: '120px',
                }}
              >
                Actions
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedData.map((row, rowIndex) => (
            <TableRow
              key={rowIndex}
              sx={{
                '&:hover': {
                  backgroundColor: '#1A1A1A',
                },
              }}
            >
              {row.cells.map((cell, cellIndex) => (
                <TableCell
                  key={cellIndex}
                  sx={{
                    ...(columns[cellIndex].toLowerCase().includes('address') && { minWidth: '300px' }),
                    ...(columns[cellIndex].toLowerCase().includes('name') && { minWidth: '150px' }),
                    ...(columns[cellIndex].toLowerCase().includes('volume') && { minWidth: '120px' }),
                    ...(columns[cellIndex].toLowerCase().includes('price') && { minWidth: '100px' }),
                  }}
                >
                  {cell}
                </TableCell>
              ))}
              {isMEVManualMode && (
                <TableCell
                  sx={{
                    width: '120px',
                    minWidth: '120px',
                  }}
                >
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => onRunRow(rowIndex)}
                      sx={{
                        bgcolor: "#00c853",
                        "&:hover": { bgcolor: "#00e676" },
                        color: "white",
                        px: 1.5,
                        py: 0.5,
                        minWidth: '45px',
                      }}
                    >
                      Run
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => onDeleteRow(rowIndex)}
                      sx={{
                        bgcolor: "#f44336",
                        "&:hover": { bgcolor: "#ff5252" },
                        color: "white",
                        px: 1.5,
                        py: 0.5,
                        minWidth: '45px',
                      }}
                    >
                      Del
                    </Button>
                  </Box>
                </TableCell>
              )}

              {isMEVTelegramMode && (
                <TableCell
                  sx={{
                    width: '120px',
                    minWidth: '120px',
                  }}
                >
                  <Typography variant="caption" sx={{ color: "#2196f3" }}>
                    В Telegram
                  </Typography>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};
