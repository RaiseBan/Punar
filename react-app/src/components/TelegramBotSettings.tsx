// src/pages/TelegramSettingsPage.tsx
import React, { useState, useEffect } from "react";
import {
    TextField,
    Button,
    Typography,
    Box,
    List,
    ListItem,
    ListItemText,
    Divider,
    CircularProgress,
    Alert,
    Switch,
    FormControlLabel
} from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function TelegramSettingsPage() {
    const [botToken, setBotToken] = useState("");
    const [chatIds, setChatIds] = useState<string[]>([]);
    const [isActive, setIsActive] = useState(false);
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
            const config = await window.electronAPI?.getTelegramBotConfig();
            const status = await window.electronAPI?.getTelegramBotStatus();

            console.log(JSON.stringify(config, null, 2), status);

            if (config) {
                setBotToken(config.botToken || "");
                setChatIds(config.chatIds || []);
            }
            if (status) {
                setIsActive(status.isActive);
            }
        } catch (err) {
            console.log(err);
            setError("Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveToken = async () => {
        try {
            await window.electronAPI?.setTelegramBotToken(botToken);
            setSuccess("Token saved successfully");
            setTimeout(() => setSuccess(""), 2000);
        } catch (err) {
            setError("Error saving token");
        }
    };

    const handleToggleStream = async () => {
        try {
            if (isActive) {
                await window.electronAPI?.stopTelegramBotStream();
            } else {
                await window.electronAPI?.startTelegramBotStream();
            }
            setIsActive(!isActive);
        } catch (err) {
            setError("Error toggling stream");
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

            <Box sx={{ mb: 4 }}>
                <TextField
                    fullWidth
                    label="Bot Token"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    margin="normal"
                    placeholder="Enter your Telegram bot token"
                />

                <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSaveToken}
                    >
                        Save Token
                    </Button>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={isActive}
                                onChange={handleToggleStream}
                                color="primary"
                            />
                        }
                        label={isActive ? "Stream Active" : "Stream Inactive"}
                    />
                </Box>
            </Box>

            <Typography variant="h6" gutterBottom>
                Connected Chats
            </Typography>

            <List sx={{ bgcolor: "background.paper", borderRadius: 2 }}>
                {chatIds.map((chatId) => (
                    <React.Fragment key={chatId}>
                        <ListItem>
                            <ListItemText primary={`Chat ID: ${chatId}`} />
                        </ListItem>
                        <Divider />
                    </React.Fragment>
                ))}
            </List>

            <Box sx={{ mt: 4 }}>
                <Button
                    variant="outlined"
                    onClick={() => navigate(-1)}
                    sx={{ mr: 2 }}
                >
                    Back
                </Button>
            </Box>
        </Box>
    );
}