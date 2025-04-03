import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Paper, CircularProgress, Button } from '@mui/material';
import styles from './Task.module.css';

interface TaskLogsProps {
  logs: string[];
  taskId: number;
}

interface FileLog {
  content: string;
  timestamp: string;
  type: string;
}

const LOG_DISPLAY_LIMIT = 100; // Максимальное количество логов для отображения

const TaskLogs: React.FC<TaskLogsProps> = ({ logs, taskId }) => {
  const [fileLogs, setFileLogs] = useState<FileLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [displayMode, setDisplayMode] = useState<'memory' | 'file'>('memory');
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  // Загрузка логов из файла
  const loadLogsFromFile = async (reset = false) => {
    if (!window.electronAPI) return;

    try {
      setIsLoading(true);
      const newOffset = reset ? 0 : offset;

      const result = await window.electronAPI.invoke('get-task-logs', {
        taskId,
        offset: newOffset,
        limit: LOG_DISPLAY_LIMIT
      });

      if (result && Array.isArray(result.logs)) {
        // Парсим логи из файла
        const parsedLogs = result.logs.map(logLine => {
          try {
            // Предполагаем формат: [timestamp] [TYPE] message
            const matches = logLine.match(/\[(.*?)\]\s*\[(.*?)\]\s*(.*)/);
            if (matches && matches.length >= 4) {
              return {
                timestamp: matches[1],
                type: matches[2],
                content: matches[3]
              };
            }
            return { timestamp: '', type: 'INFO', content: logLine };
          } catch (e) {
            return { timestamp: '', type: 'INFO', content: logLine };
          }
        });

        setFileLogs(reset ? parsedLogs : [...parsedLogs, ...fileLogs]);
        setTotalLogs(result.totalLines || 0);
        setOffset(newOffset + LOG_DISPLAY_LIMIT);
      }
    } catch (error) {
      console.error('Ошибка при загрузке логов из файла:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Переключение между режимами отображения
  const toggleDisplayMode = () => {
    const newMode = displayMode === 'memory' ? 'file' : 'memory';
    setDisplayMode(newMode);

    if (newMode === 'file' && fileLogs.length === 0) {
      loadLogsFromFile(true);
    }
  };

  // Прокрутка вниз при добавлении новых логов
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, fileLogs, autoScroll]);

  // Рендеринг логов из памяти
  const renderMemoryLogs = () => {
    // Отображаем только последние LOG_DISPLAY_LIMIT логов для оптимизации
    const limitedLogs = logs.slice(-LOG_DISPLAY_LIMIT);

    return (
      <>
        {limitedLogs.length === 0 ? (
          <Typography variant="body2" sx={{ fontStyle: 'italic', p: 2 }}>
            Логи пока отсутствуют
          </Typography>
        ) : (
          limitedLogs.map((log, index) => (
            <div key={index} className={styles.logLine}>
              {log}
            </div>
          ))
        )}
        {logs.length > LOG_DISPLAY_LIMIT && (
          <Typography variant="body2" sx={{ fontStyle: 'italic', p: 1, color: 'text.secondary' }}>
            Отображаются только последние {LOG_DISPLAY_LIMIT} сообщений из {logs.length}
          </Typography>
        )}
      </>
    );
  };

  // Рендеринг логов из файла
  const renderFileLogs = () => {
    return (
      <>
        {fileLogs.length === 0 ? (
          isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Typography variant="body2" sx={{ fontStyle: 'italic', p: 2 }}>
              В файле логов нет записей
            </Typography>
          )
        ) : (
          <>
            {fileLogs.map((log, index) => (
              <div key={index} className={styles.logLine}>
                <span className={styles.logTimestamp}>{log.timestamp}</span>
                <span className={styles.logType}>[{log.type}]</span>
                <span className={styles.logContent}>{log.content}</span>
              </div>
            ))}
            {offset < totalLogs && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => loadLogsFromFile(false)}
                  disabled={isLoading}
                >
                  {isLoading ? <CircularProgress size={16} /> : 'Загрузить еще'}
                </Button>
              </Box>
            )}
          </>
        )}
      </>
    );
  };

  return (
    <Paper elevation={1} className={styles.logsContainer}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
        <Typography variant="subtitle2">Логи</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="text"
            onClick={() => setAutoScroll(!autoScroll)}
          >
            {autoScroll ? 'Отключить автопрокрутку' : 'Включить автопрокрутку'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={toggleDisplayMode}
          >
            {displayMode === 'memory' ? 'Из файла' : 'Из памяти'}
          </Button>
          {displayMode === 'file' && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => loadLogsFromFile(true)}
              disabled={isLoading}
            >
              Обновить
            </Button>
          )}
        </Box>
      </Box>

      <Box className={styles.logs}>
        {displayMode === 'memory' ? renderMemoryLogs() : renderFileLogs()}
        <div ref={logsEndRef} />
      </Box>
    </Paper>
  );
};

export default TaskLogs; 