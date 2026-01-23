import React from 'react';
import { Box, Typography, Chip, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import VisibilityIcon from '@mui/icons-material/Visibility';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { TaskConfig } from '../../../../shared/types';

interface TaskHeaderProps {
  name: string;
  moduleName: string;
  status: string;
  tableCollapsed: boolean;
  toggleTable: () => void;
  imageUrl?: string;
  collectionLabel?: string;
  config?: TaskConfig;
  handleOpenFullView: () => void;
  handleOpenSettings: () => void;
  handleOpenLogs: () => void;
  handleStop: () => void;
  handleResume: () => void;
  handleDelete: () => void;
}

const statusColorMap: Record<string, string> = {
  Running: '#00c853',
  Stopped: '#f44336',
};

export const TaskHeader: React.FC<TaskHeaderProps> = ({
  name,
  moduleName,
  status,
  tableCollapsed,
  toggleTable,
  imageUrl,
  collectionLabel,
  config,
  handleOpenFullView,
  handleOpenSettings,
  handleOpenLogs,
  handleStop,
  handleResume,
  handleDelete,
}) => {
  const chipColor = statusColorMap[status] || '#ff9e44';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2,
        justifyContent: 'space-between',
      }}
    >
      {/* Левая часть: Название, Модуль, Статус */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            {name}
          </Typography>
          <Typography variant="caption" sx={{ color: '#999' }}>
            Module: {moduleName}
          </Typography>

          {/* Если это Tensor sniper (SDK), покажем картинку и label коллекции */}
          {moduleName === 'Tensor sniper (SDK)' && config?.collection_id && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Collection"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    objectFit: 'cover',
                    border: '1px solid #333',
                  }}
                />
              )}
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#ccc' }}>
                {collectionLabel}
              </Typography>
            </Box>
          )}
        </>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Chip
          label={status}
          sx={{
            backgroundColor: chipColor,
            color: '#000',
            fontWeight: 'bold',
          }}
        />

        {/* Иконки действий */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton sx={{ color: '#fff' }} onClick={toggleTable}>
            {tableCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>

          <IconButton sx={{ color: '#fff' }} onClick={handleOpenFullView}>
            <OpenInFullIcon />
          </IconButton>

          <IconButton sx={{ color: '#fff' }} onClick={handleOpenLogs}>
            <VisibilityIcon />
          </IconButton>

          <IconButton sx={{ color: '#fff' }} onClick={handleOpenSettings}>
            <SettingsIcon />
          </IconButton>

          {status === 'Running' ? (
            <IconButton sx={{ color: '#f44336' }} onClick={handleStop}>
              <StopIcon />
            </IconButton>
          ) : (
            <IconButton sx={{ color: '#00c853' }} onClick={handleResume}>
              <PlayArrowIcon />
            </IconButton>
          )}

          <IconButton sx={{ color: '#f44336' }} onClick={handleDelete}>
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};
