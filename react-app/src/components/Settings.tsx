import React, { useState, useEffect } from "react";
import { TextField, Button, Box, Typography, IconButton, Stack } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckCircle from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";

interface AppSettings {
    scriptDirectory?: string;
    mevBotDirectory?: string;
    mainRpc?: string;
    additionalRpc?: string;
    heliusRpcs?: string[];
    tensor_api_token?: string;
    bloxroute_api_token?: string;


    lookupOwner?: string;
    // mev
    migration_wallet?: string;
    jito_strategy?: string;
    jito_lower_bound?: string;
    jito_upper_bound?: string;
    tx_count?: string;
    compute_unit_limit?: string;


    proxy_server_ip?: string;
    proxy_server_port?: number;
    primary_ip?: string;
    requests_per_second?: number;
    token_release_port?: number;

    delay_between_nodes?: string;

    min_process_age_for_cleanup?: string;
    processes_check_interval?: string;



    thor_streamer_address?: string;
    thor_streamer_token?: string;
}

export default function Settings() {
    const [settings, setSettings] = useState<AppSettings>({});
    const [isChanged, setIsChanged] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            const loadedSettings = await window.electronAPI?.getSettings();
            if (loadedSettings) {
                setSettings(loadedSettings);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        await window.electronAPI?.saveSettings(settings);
        setIsChanged(false); // Сбрасываем флаг изменений после сохранения
    };

    const handleAddHeliusRpc = () => {
        setSettings(prev => ({
            ...prev,
            heliusRpcs: [...(prev.heliusRpcs || []), ""]
        }));
        setIsChanged(true);
    };

    const handleDeleteHeliusRpc = (index: number) => {
        setSettings(prev => ({
            ...prev,
            heliusRpcs: prev.heliusRpcs?.filter((_, i) => i !== index) || []
        }));
        setIsChanged(true);
    };

    const handleChange = (field: keyof AppSettings) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings(prev => ({ ...prev, [field]: e.target.value }));
        setIsChanged(true);
    };

    const handleHeliusRpcChange = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings(prev => ({
            ...prev,
            heliusRpcs: prev.heliusRpcs?.map((rpc, i) =>
                i === index ? e.target.value : rpc
            ) || []
        }));
        setIsChanged(true);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>Settings</Typography>

            {/* Script Directory */}
            <Box sx={{ mb: 4 }}>
                <TextField
                    label="Scripts Directory"
                    fullWidth
                    value={settings.scriptDirectory || ""}
                    onChange={handleChange('scriptDirectory')}
                    margin="normal"
                />
            </Box>


            <Box sx={{ mb: 4 }}>
                <TextField
                    label="mev directory"
                    fullWidth
                    value={settings.mevBotDirectory || ""}
                    onChange={handleChange('mevBotDirectory')}
                    margin="normal"
                />
            </Box>



            {/* RPCs */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                    RPCs
                    <TextField
                        label="Main RPC"
                        fullWidth
                        value={settings.mainRpc || ""}
                        onChange={handleChange('mainRpc')}
                        margin="normal"
                    />

                    <TextField
                        label="additional rpc"
                        fullWidth
                        value={settings.additionalRpc || ""}
                        onChange={handleChange('additionalRpc')}
                        margin="normal"
                    />

                </Typography>


            </Box>

            {/* Lookup tables */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                    Lookup tables
                    <TextField
                        label="Lookup owner"
                        fullWidth
                        value={settings.lookupOwner || ""}
                        onChange={handleChange('lookupOwner')}
                        margin="normal"
                    />

                </Typography>


            </Box>

            {/* Jito config */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                    Jito config

                    <TextField
                        label="Strategy"
                        fullWidth
                        value={settings.jito_strategy || ""}
                        onChange={handleChange('jito_strategy')}
                        margin="normal"
                    />

                    <TextField
                        label="Jito lower bound"
                        fullWidth
                        value={settings.jito_lower_bound || ""}
                        onChange={handleChange('jito_lower_bound')}
                        margin="normal"
                    />
                    <TextField
                        label="Jito upper bound"
                        fullWidth
                        value={settings.jito_upper_bound || ""}
                        onChange={handleChange('jito_upper_bound')}
                        margin="normal"
                    />

                    <TextField
                        label="transaction count"
                        fullWidth
                        value={settings.tx_count || ""}
                        onChange={handleChange('tx_count')}
                        margin="normal"
                    />

                </Typography>


            </Box>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                    Migrate token settings

                    <TextField
                        label="Migration wallet"
                        fullWidth
                        value={settings.migration_wallet || ""}
                        onChange={handleChange('migration_wallet')}
                        margin="normal"
                    />

                    <TextField
                        label="Compute units"
                        fullWidth
                        value={settings.compute_unit_limit || ""}
                        onChange={handleChange('compute_unit_limit')}
                        margin="normal"
                    />


                    <TextField
                        label="proxy server ip address"
                        fullWidth
                        value={settings.proxy_server_ip || ""}
                        onChange={handleChange('proxy_server_ip')}
                        margin="normal"
                    />

                    <TextField
                        label="proxy server port"
                        fullWidth
                        value={settings.proxy_server_port || ""}
                        onChange={handleChange('proxy_server_port')}
                        margin="normal"
                    />

                    <TextField
                        label="Node ip address"
                        fullWidth
                        value={settings.primary_ip || ""}
                        onChange={handleChange('primary_ip')}
                        margin="normal"
                    />

                    <TextField
                        label="Req/s"
                        fullWidth
                        value={settings.requests_per_second || ""}
                        onChange={handleChange('requests_per_second')}
                        margin="normal"
                    />

                    <TextField
                        label="Delay_nodes"
                        fullWidth
                        value={settings.delay_between_nodes || ""}
                        onChange={handleChange('delay_between_nodes')}
                        margin="normal"
                    />

                    <TextField
                        label="Token release port"
                        fullWidth
                        value={settings.token_release_port || ""}
                        onChange={handleChange('token_release_port')}
                        margin="normal"
                    />

                </Typography>

            </Box>


            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                    Garbage collector settings
                    <TextField
                        label="GC interval (min)"
                        fullWidth
                        value={settings.processes_check_interval || ""}
                        onChange={handleChange('processes_check_interval')}
                        margin="normal"
                    />

                    <TextField
                        label="Minimum process age (min)"
                        fullWidth
                        value={settings.min_process_age_for_cleanup || ""}
                        onChange={handleChange('min_process_age_for_cleanup')}
                        margin="normal"
                    />

                </Typography>


            </Box>



            {/* API keys */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                    API KEYS
                    <TextField
                        label="Tensor API key"
                        fullWidth
                        value={settings.tensor_api_token || ""}
                        onChange={handleChange('tensor_api_token')}
                        margin="normal"
                    />

                    <TextField
                        label="Bloxroute API key"
                        fullWidth
                        value={settings.bloxroute_api_token || ""}
                        onChange={handleChange('bloxroute_api_token')}
                        margin="normal"
                    />

                </Typography>


            </Box>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                    THOR STREAMER
                    <TextField
                        label="ADDRESS"
                        fullWidth
                        value={settings.thor_streamer_address || ""}
                        onChange={handleChange('thor_streamer_address')}
                        margin="normal"
                    />

                    <TextField
                        label="TOKEN"
                        fullWidth
                        value={settings.thor_streamer_token || ""}
                        onChange={handleChange('thor_streamer_token')}
                        margin="normal"
                    />

                </Typography>


            </Box>

            {/* Helius RPCs */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                    Helius RPC Endpoints
                    <IconButton
                        color="primary"
                        onClick={handleAddHeliusRpc}
                        sx={{ ml: 1 }}
                    >
                        <AddIcon />
                    </IconButton>
                </Typography>

                <Stack spacing={2}>
                    {settings.heliusRpcs?.map((rpc, index) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TextField
                                fullWidth
                                value={rpc}
                                onChange={handleHeliusRpcChange(index)}
                                margin="normal"
                            />
                            <IconButton
                                color="error"
                                onClick={() => handleDeleteHeliusRpc(index)}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Box>
                    ))}
                </Stack>
            </Box>

            {/* Save Button or Checkmark */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {isChanged ? (
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        sx={{
                            backgroundColor: "#1976d2",
                            color: "white",
                            "&:hover": {
                                backgroundColor: "#1565c0",
                            },
                        }}
                    >
                        SAVE
                    </Button>
                ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircle fontSize="large" color="success" />
                        <Typography variant="body1" color="text.secondary">
                            Settings saved
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
}