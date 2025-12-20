// src/components/TelegramBotSettings.tsx
import React, { useState, useEffect } from "react";
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
    IconButton
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

export default function TelegramBotSettings() {
    const [botToken, setBotToken] = useState("");
    const [chatIds, setChatIds] = useState("");
    const [showToken, setShowToken] = useState(false);
    const [botStatus, setBotStatus] = useState<{
        isRunning: boolean;
        isConfigured: boolean;
        chatCount: number;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            if (!window.electronAPI?.telegramBot) {
                setError("Telegram API not available");
                setLoading(false);
                return;
            }

            const config = await window.electronAPI.telegramBot.getConfig();
            const status = await window.electronAPI.telegramBot.getStatus();

            setBotToken(config.token || "");
            setChatIds(config.chatIds?.join(", ") || "");

            // Берем chatCount из локального конфига вместо бекенда
            setBotStatus({
                isRunning: status?.isRunning || false,
                isConfigured: !!config.token,
                chatCount: config.chatIds?.length || 0,
            });
        } catch (err) {
            console.error("Failed to load settings:", err);
            setError("Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveToken = async () => {
        if (!botToken.trim()) {
            setError("Token is required");
            return;
        }

        if (!window.electronAPI?.telegramBot) {
            setError("Telegram API not available");
            return;
        }

        setError("");
        setSuccess("");

        try {
            // Парсим chat IDs
            const parsedChatIds = chatIds
                .split(",")
                .map(id => parseInt(id.trim()))
                .filter(id => !isNaN(id));

            // Сохраняем токен
            const result = await window.electronAPI.telegramBot.setToken(botToken);

            if (result.success) {
                // Обновляем настройки с chat IDs
                const settings = await window.electronAPI.getSettings();
                settings.telegramChatIds = parsedChatIds;
                await window.electronAPI.saveSettings(settings);

                setSuccess("Token saved successfully!");
                await loadSettings();

                setTimeout(() => setSuccess(""), 2000);
            } else {
                setError(result.error || "Failed to save token");
            }
        } catch (err) {
            console.error("Error saving token:", err);
            setError((err as Error).message);
        }
    };

    const handleStart = async () => {
        if (!window.electronAPI?.telegramBot) {
            setError("Telegram API not available");
            return;
        }

        if (!botToken.trim()) {
            setError("Please set bot token first");
            return;
        }

        setError("");
        try {
            const result = await window.electronAPI.telegramBot.start();
            if (result.success) {
                setSuccess("Bot started successfully!");
                await loadSettings();
                setTimeout(() => setSuccess(""), 2000);
            } else {
                setError(result.error || "Failed to start bot");
            }
        } catch (err) {
            console.error("Error starting bot:", err);
            setError((err as Error).message);
        }
    };

    const handleStop = async () => {
        if (!window.electronAPI?.telegramBot) {
            setError("Telegram API not available");
            return;
        }

        setError("");
        try {
            const result = await window.electronAPI.telegramBot.stop();
            if (result.success) {
                setSuccess("Bot stopped successfully!");
                await loadSettings();
                setTimeout(() => setSuccess(""), 2000);
            } else {
                setError(result.error || "Failed to stop bot");
            }
        } catch (err) {
            console.error("Error stopping bot:", err);
            setError((err as Error).message);
        }
    };

    const handleToggle = async () => {
        if (botStatus?.isRunning) {
            await handleStop();
        } else {
            await handleStart();
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" mt={4}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3, maxWidth: 800, margin: "0 auto" }}>
            <Typography variant="h4" gutterBottom>
                Telegram Bot Configuration
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

            {/* Bot Status */}
            {botStatus && (
                <Box sx={{ mb: 3, p: 2, bgcolor: "background.paper", borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom>Bot Status</Typography>
                    <Typography>
                        Status: <strong style={{ color: botStatus.isRunning ? '#4caf50' : '#f44336' }}>
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
                    type={showToken ? "text" : "password"}
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    margin="normal"
                    placeholder="123456:ABC-DEF..."
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    onClick={() => setShowToken(!showToken)}
                                    edge="end"
                                >
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
                    onChange={(e) => setChatIds(e.target.value)}
                    margin="normal"
                    placeholder="123456789, 987654321"
                    helperText="Get your chat ID: send /start to @userinfobot"
                />

                <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "center" }}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSaveToken}
                    >
                        Save Configuration
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
                        label={botStatus?.isRunning ? "Bot Active" : "Bot Inactive"}
                    />
                </Box>
            </Box>

            <Box sx={{ mt: 4 }}>
                <Button
                    variant="outlined"
                    onClick={() => navigate(-1)}
                    sx={{ mr: 2 }}
                >
                    Back
                </Button>
                <Button
                    variant="outlined"
                    onClick={loadSettings}
                >
                    Refresh Status
                </Button>
            </Box>
        </Box>
    );
}