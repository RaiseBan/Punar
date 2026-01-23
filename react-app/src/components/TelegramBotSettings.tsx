import React, { useState, useEffect } from 'react';
import {
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Switch,
  FormControlLabel,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { validateTelegramBotToken, validateChatIds } from '../utils/validators';

export default function TelegramBotSettings() {
  const [botToken, setBotToken] = useState('');
  const [chatIds, setChatIds] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [botStatus, setBotStatus] = useState<{
    isRunning: boolean;
    isConfigured: boolean;
    chatCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Валидация
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [chatIdsError, setChatIdsError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ token: false, chatIds: false });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      if (!window.electronAPI.telegramBot) {
        setError('Telegram API not available');
        setLoading(false);
        return;
      }

      const config = await window.electronAPI.telegramBot.getConfig();
      const status = await window.electronAPI.telegramBot.getStatus();

      setBotToken(config.token || '');
      setChatIds(config.chatIds?.join(', ') || '');

      setBotStatus({
        isRunning: status?.isRunning || false,
        isConfigured: !!config.token,
        chatCount: config.chatIds?.length || 0,
      });
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleTokenChange = (value: string) => {
    setBotToken(value);
    if (touched.token) {
      const result = validateTelegramBotToken(value);
      setTokenError(result.isValid ? null : result.error || 'Invalid token');
    }
  };

  const handleChatIdsChange = (value: string) => {
    setChatIds(value);
    if (touched.chatIds) {
      const result = validateChatIds(value);
      setChatIdsError(result.isValid ? null : result.error || 'Invalid chat IDs');
    }
  };

  const handleTokenBlur = () => {
    setTouched((prev) => ({ ...prev, token: true }));
    const result = validateTelegramBotToken(botToken);
    setTokenError(result.isValid ? null : result.error || 'Invalid token');
  };

  const handleChatIdsBlur = () => {
    setTouched((prev) => ({ ...prev, chatIds: true }));
    const result = validateChatIds(chatIds);
    setChatIdsError(result.isValid ? null : result.error || 'Invalid chat IDs');
  };

  const handleSaveToken = async () => {
    // Валидация перед сохранением
    const tokenResult = validateTelegramBotToken(botToken);
    const chatIdsResult = validateChatIds(chatIds);

    setTouched({ token: true, chatIds: true });
    setTokenError(tokenResult.isValid ? null : tokenResult.error || 'Invalid token');
    setChatIdsError(chatIdsResult.isValid ? null : chatIdsResult.error || 'Invalid chat IDs');

    if (!tokenResult.isValid || !chatIdsResult.isValid) {
      setError('Please fix validation errors');
      return;
    }

    if (!window.electronAPI.telegramBot) {
      setError('Telegram API not available');
      return;
    }

    setError('');
    setSuccess('');

    try {
      // Парсим chat IDs
      const parsedChatIds = chatIds
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));

      // Сохраняем токен
      const result = await window.electronAPI.telegramBot.setToken(botToken);

      if (result.success) {
        // Обновляем настройки с chat IDs
        const settings = await window.electronAPI.getSettings();
        settings.telegramChatIds = parsedChatIds;
        await window.electronAPI.saveSettings(settings);

        setSuccess('Token saved successfully!');
        await loadSettings();
      } else {
        setError(result.error || 'Failed to save token');
      }
    } catch (err) {
      console.error('Error saving token:', err);
      setError('Failed to save configuration');
    }
  };

  const handleToggle = async () => {
    if (!window.electronAPI.telegramBot) return;

    try {
      if (botStatus?.isRunning) {
        await window.electronAPI.telegramBot.stop();
      } else {
        await window.electronAPI.telegramBot.start();
      }
      await loadSettings();
    } catch (err) {
      console.error('Error toggling bot:', err);
      setError('Failed to toggle bot');
    }
  };

  const handleTestConnection = async () => {
    if (!window.electronAPI.telegramBot) {
      setError('Telegram API not available');
      return;
    }

    setError('');
    setSuccess('');

    try {
      const result = await window.electronAPI.telegramBot.testConnection();
      if (result.success) {
        setSuccess(`Connection successful!`);
      } else {
        setError(result.error || 'Connection test failed');
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setError('Failed to test connection');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <Typography variant="h4" gutterBottom>
        Telegram Bot Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {botStatus && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="h6" gutterBottom>
            Bot Status
          </Typography>
          <Typography>
            Status:{' '}
            <strong style={{ color: botStatus.isRunning ? '#4caf50' : '#f44336' }}>
              {botStatus.isRunning ? '🟢 Running' : '🔴 Stopped'}
            </strong>
          </Typography>
          <Typography>
            Configured: <strong>{botStatus.isConfigured ? '✅ Yes' : '❌ No'}</strong>
          </Typography>
          <Typography>
            Connected Chats: <strong>{botStatus.chatCount}</strong>
          </Typography>
        </Box>
      )}

      <Box sx={{ mb: 4 }}>
        <TextField
          fullWidth
          label="Bot Token"
          type={showToken ? 'text' : 'password'}
          value={botToken}
          onChange={(e) => handleTokenChange(e.target.value)}
          onBlur={handleTokenBlur}
          error={touched.token && !!tokenError}
          helperText={touched.token && tokenError ? tokenError : 'Get from @BotFather on Telegram'}
          margin="normal"
          placeholder="123456:ABC-DEF..."
          required
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowToken(!showToken)} edge="end">
                  {showToken ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <TextField
          fullWidth
          label="Chat IDs (comma-separated)"
          value={chatIds}
          onChange={(e) => handleChatIdsChange(e.target.value)}
          onBlur={handleChatIdsBlur}
          error={touched.chatIds && !!chatIdsError}
          helperText={
            touched.chatIds && chatIdsError
              ? chatIdsError
              : 'Get your chat ID: send /start to @userinfobot'
          }
          margin="normal"
          placeholder="123456789, 987654321"
        />

        <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveToken}
            disabled={!!tokenError || !!chatIdsError}
          >
            Save Configuration
          </Button>

          <Button
            variant="outlined"
            onClick={handleTestConnection}
            disabled={!botToken || !!tokenError}
          >
            Test Connection
          </Button>

          <FormControlLabel
            control={
              <Switch
                checked={botStatus?.isRunning || false}
                onChange={handleToggle}
                color="primary"
                disabled={!botStatus?.isConfigured}
              />
            }
            label={botStatus?.isRunning ? 'Stop Bot' : 'Start Bot'}
          />
        </Box>
      </Box>
    </Box>
  );
}
