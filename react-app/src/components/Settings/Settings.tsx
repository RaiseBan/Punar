import React, { useState, useEffect, useCallback } from "react";
import { 
    TextField, 
    Button, 
    Box, 
    Typography, 
    IconButton, 
    Stack,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckCircle from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import { 
    validateUrl, 
    validatePositiveInteger,
    validatePublicKey,
    validateApiToken,
    validateNonEmptyString 
} from "../../utils/validators";

interface AppSettings {
    scriptDirectory?: string;
    mevBotDirectory?: string;
    mainRpc?: string;
    additionalRpc?: string;
    heliusRpcs?: string[];
    tensor_api_token?: string;
    bloxroute_api_token?: string;
    lookupOwner?: string;
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

interface FieldErrors {
    [key: string]: string | null;
}

export default function Settings() {
    const [settings, setSettings] = useState<AppSettings>({});
    const [isChanged, setIsChanged] = useState(false);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [touched, setTouched] = useState<Set<string>>(new Set());

    useEffect(() => {
        const loadSettings = async () => {
            const loadedSettings = await window.electronAPI?.getSettings();
            if (loadedSettings) {
                setSettings(loadedSettings);
            }
        };
        loadSettings();
    }, []);

    // Валидация поля
    const validateField = useCallback((field: keyof AppSettings, value: string): string | null => {
        // RPC URLs
        if (field === 'mainRpc' || field === 'additionalRpc') {
            if (!value) return null; // Опционально
            const result = validateUrl(value);
            return result.isValid ? null : result.error || 'Invalid URL';
        }

        // API Tokens
        if (field === 'tensor_api_token' || field === 'bloxroute_api_token' || field === 'thor_streamer_token') {
            if (!value) return null; // Опционально
            const result = validateApiToken(value);
            return result.isValid ? null : result.error || 'Invalid token';
        }

        // Solana addresses
        if (field === 'lookupOwner' || field === 'migration_wallet' || field === 'thor_streamer_address') {
            if (!value) return null; // Опционально
            const result = validatePublicKey(value);
            return result.isValid ? null : result.error || 'Invalid address';
        }

        // Ports
        if (field === 'proxy_server_port' || field === 'token_release_port' || field === 'requests_per_second') {
            if (!value) return null; // Опционально
            const result = validatePositiveInteger(value);
            return result.isValid ? null : result.error || 'Invalid number';
        }

        // Directories
        if (field === 'scriptDirectory' || field === 'mevBotDirectory') {
            if (!value) return null; // Опционально
            const result = validateNonEmptyString(value, 'Directory');
            return result.isValid ? null : result.error || 'Required';
        }

        // IP addresses
        if (field === 'proxy_server_ip' || field === 'primary_ip') {
            if (!value) return null;
            // Простая проверка IP
            const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipPattern.test(value)) {
                return 'Invalid IP address format';
            }
        }

        return null;
    }, []);

    const handleBlur = useCallback((field: keyof AppSettings) => {
        setTouched(prev => new Set(prev).add(field));
        const error = validateField(field, settings[field]);
        setErrors(prev => ({ ...prev, [field]: error }));
    }, [settings, validateField]);

    const handleSave = async () => {
        // Валидируем все поля перед сохранением
        const newErrors: FieldErrors = {};
        let hasErrors = false;

        Object.keys(settings).forEach((key) => {
            const error = validateField(key as keyof AppSettings, settings[key as keyof AppSettings]);
            if (error) {
                newErrors[key] = error;
                hasErrors = true;
            }
        });

        setErrors(newErrors);
        setTouched(new Set(Object.keys(settings)));

        if (hasErrors) {
            console.error('Please fix all validation errors before saving');
            return;
        }

        await window.electronAPI?.saveSettings(settings);
        setIsChanged(false);
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
        
        // Валидация на лету если поле уже было тронуто
        if (touched.has(field)) {
            const error = validateField(field, e.target.value);
            setErrors(prev => ({ ...prev, [field]: error }));
        }
    };

    const handleHeliusRpcChange = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSettings(prev => ({
            ...prev,
            heliusRpcs: prev.heliusRpcs?.map((rpc, i) => i === index ? value : rpc) || []
        }));
        setIsChanged(true);

        // Валидация Helius RPC
        const fieldKey = `heliusRpc_${index}`;
        if (touched.has(fieldKey)) {
            const error = validateUrl(value);
            setErrors(prev => ({ ...prev, [fieldKey]: error.isValid ? null : error.error || 'Invalid URL' }));
        }
    };

    const handleHeliusRpcBlur = (index: number, value: string) => {
        const fieldKey = `heliusRpc_${index}`;
        setTouched(prev => new Set(prev).add(fieldKey));
        const error = validateUrl(value);
        setErrors(prev => ({ ...prev, [fieldKey]: error.isValid ? null : error.error || 'Invalid URL' }));
    };

    const getError = (field: string) => {
        return touched.has(field) ? errors[field] : null;
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
                    onBlur={() => handleBlur('scriptDirectory')}
                    error={!!getError('scriptDirectory')}
                    helperText={getError('scriptDirectory')}
                    margin="normal"
                />
            </Box>

            <Box sx={{ mb: 4 }}>
                <TextField
                    label="MEV Directory"
                    fullWidth
                    value={settings.mevBotDirectory || ""}
                    onChange={handleChange('mevBotDirectory')}
                    onBlur={() => handleBlur('mevBotDirectory')}
                    error={!!getError('mevBotDirectory')}
                    helperText={getError('mevBotDirectory')}
                    margin="normal"
                />
            </Box>

            {/* RPCs */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>RPCs</Typography>
                
                <TextField
                    label="Main RPC"
                    fullWidth
                    value={settings.mainRpc || ""}
                    onChange={handleChange('mainRpc')}
                    onBlur={() => handleBlur('mainRpc')}
                    error={!!getError('mainRpc')}
                    helperText={getError('mainRpc') || 'HTTPS URL required'}
                    margin="normal"
                />

                <TextField
                    label="Additional RPC"
                    fullWidth
                    value={settings.additionalRpc || ""}
                    onChange={handleChange('additionalRpc')}
                    onBlur={() => handleBlur('additionalRpc')}
                    error={!!getError('additionalRpc')}
                    helperText={getError('additionalRpc')}
                    margin="normal"
                />
            </Box>

            {/* Lookup tables */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>Lookup Tables</Typography>
                
                <TextField
                    label="Lookup Owner"
                    fullWidth
                    value={settings.lookupOwner || ""}
                    onChange={handleChange('lookupOwner')}
                    onBlur={() => handleBlur('lookupOwner')}
                    error={!!getError('lookupOwner')}
                    helperText={getError('lookupOwner') || 'Solana address'}
                    margin="normal"
                />
            </Box>

            {/* API keys */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>API Keys</Typography>
                
                <TextField
                    label="Tensor API Key"
                    fullWidth
                    value={settings.tensor_api_token || ""}
                    onChange={handleChange('tensor_api_token')}
                    onBlur={() => handleBlur('tensor_api_token')}
                    error={!!getError('tensor_api_token')}
                    helperText={getError('tensor_api_token')}
                    margin="normal"
                    type="password"
                />

                <TextField
                    label="Bloxroute API Key"
                    fullWidth
                    value={settings.bloxroute_api_token || ""}
                    onChange={handleChange('bloxroute_api_token')}
                    onBlur={() => handleBlur('bloxroute_api_token')}
                    error={!!getError('bloxroute_api_token')}
                    helperText={getError('bloxroute_api_token')}
                    margin="normal"
                    type="password"
                />
            </Box>

            {/* Thor Streamer */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>Thor Streamer</Typography>
                
                <TextField
                    label="Address"
                    fullWidth
                    value={settings.thor_streamer_address || ""}
                    onChange={handleChange('thor_streamer_address')}
                    onBlur={() => handleBlur('thor_streamer_address')}
                    error={!!getError('thor_streamer_address')}
                    helperText={getError('thor_streamer_address') || 'Solana address'}
                    margin="normal"
                />

                <TextField
                    label="Token"
                    fullWidth
                    value={settings.thor_streamer_token || ""}
                    onChange={handleChange('thor_streamer_token')}
                    onBlur={() => handleBlur('thor_streamer_token')}
                    error={!!getError('thor_streamer_token')}
                    helperText={getError('thor_streamer_token')}
                    margin="normal"
                    type="password"
                />
            </Box>

            {/* Helius RPCs */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                    Helius RPC Endpoints
                    <IconButton color="primary" onClick={handleAddHeliusRpc} sx={{ ml: 1 }}>
                        <AddIcon />
                    </IconButton>
                </Typography>

                <Stack spacing={2}>
                    {settings.heliusRpcs?.map((rpc, index) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                            <Box sx={{ flex: 1 }}>
                                <TextField
                                    fullWidth
                                    value={rpc}
                                    onChange={handleHeliusRpcChange(index)}
                                    onBlur={() => handleHeliusRpcBlur(index, rpc)}
                                    error={!!getError(`heliusRpc_${index}`)}
                                    helperText={getError(`heliusRpc_${index}`)}
                                    margin="normal"
                                />
                            </Box>
                            <IconButton
                                color="error"
                                onClick={() => handleDeleteHeliusRpc(index)}
                                sx={{ mt: 2 }}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Box>
                    ))}
                </Stack>
            </Box>

            {/* Network Settings */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>Network Settings</Typography>
                
                <TextField
                    label="Proxy Server IP"
                    fullWidth
                    value={settings.proxy_server_ip || ""}
                    onChange={handleChange('proxy_server_ip')}
                    onBlur={() => handleBlur('proxy_server_ip')}
                    error={!!getError('proxy_server_ip')}
                    helperText={getError('proxy_server_ip') || 'e.g., 192.168.1.1'}
                    margin="normal"
                />

                <TextField
                    label="Proxy Server Port"
                    fullWidth
                    type="number"
                    value={settings.proxy_server_port || ""}
                    onChange={handleChange('proxy_server_port')}
                    onBlur={() => handleBlur('proxy_server_port')}
                    error={!!getError('proxy_server_port')}
                    helperText={getError('proxy_server_port')}
                    margin="normal"
                />

                <TextField
                    label="Primary IP"
                    fullWidth
                    value={settings.primary_ip || ""}
                    onChange={handleChange('primary_ip')}
                    onBlur={() => handleBlur('primary_ip')}
                    error={!!getError('primary_ip')}
                    helperText={getError('primary_ip')}
                    margin="normal"
                />

                <TextField
                    label="Requests Per Second"
                    fullWidth
                    type="number"
                    value={settings.requests_per_second || ""}
                    onChange={handleChange('requests_per_second')}
                    onBlur={() => handleBlur('requests_per_second')}
                    error={!!getError('requests_per_second')}
                    helperText={getError('requests_per_second')}
                    margin="normal"
                />

                <TextField
                    label="Token Release Port"
                    fullWidth
                    type="number"
                    value={settings.token_release_port || ""}
                    onChange={handleChange('token_release_port')}
                    onBlur={() => handleBlur('token_release_port')}
                    error={!!getError('token_release_port')}
                    helperText={getError('token_release_port')}
                    margin="normal"
                />
            </Box>

            {/* Garbage Collector Settings */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>Garbage Collector Settings</Typography>
                
                <TextField
                    label="GC Interval (min)"
                    fullWidth
                    type="number"
                    value={settings.processes_check_interval || ""}
                    onChange={handleChange('processes_check_interval')}
                    margin="normal"
                />

                <TextField
                    label="Minimum Process Age (min)"
                    fullWidth
                    type="number"
                    value={settings.min_process_age_for_cleanup || ""}
                    onChange={handleChange('min_process_age_for_cleanup')}
                    margin="normal"
                />
            </Box>

            {/* Save Button */}
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