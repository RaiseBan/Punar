import React from "react";
import {
    Box,
    Typography,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    RadioGroup,
    FormControlLabel,
    Radio
} from "@mui/material";
import { Wallet } from "../../types";

interface StepConfigureMevModuleProps {
    taskName: string;
    setTaskName: React.Dispatch<React.SetStateAction<string>>;
    mevParams: {
        volumeThreshold: number;
        checkInterval: number;
        maxAttempts: number;
        threadWorkers: number;
        mode: "manual" | "automatic"; // Добавлено новое поле
        walletSource: "existing" | "manual";
        privateKey: string;
        default_bound: number;
    };
    setMevParams: React.Dispatch<React.SetStateAction<{
        volumeThreshold: number;
        checkInterval: number;
        maxAttempts: number;
        threadWorkers: number;
        mode: "manual" | "automatic"; // Добавлено новое поле
        walletSource: "existing" | "manual";
        privateKey: string;
        default_bound: number;
    }>>;
    wallets?: Wallet[];
}

export default function StepConfigureMevModule({
                                                   taskName,
                                                   setTaskName,
                                                   mevParams,
                                                   setMevParams,
                                                   wallets,
                                               }: StepConfigureMevModuleProps) {
    const handleParamChange = (key: string, value: string | number) => {
        setMevParams(prev => ({ ...prev, [key]: value }));
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 500 }}>
            <Typography variant="h6">MEV Module Parameters</Typography>

            <TextField
                label="Task Name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                fullWidth
            />

            <TextField
                label="Volume Threshold (USD)"
                type="number"
                value={mevParams.volumeThreshold}
                onChange={(e) => handleParamChange("volumeThreshold", Number(e.target.value))}
                fullWidth
            />

            <TextField
                label="Default sending boundary (USD)"
                type="number"
                value={mevParams.default_bound}
                onChange={(e) => handleParamChange("default_bound", Number(e.target.value))}
                fullWidth
            />

            <TextField
                label="Check Interval (seconds)"
                type="number"
                value={mevParams.checkInterval}
                onChange={(e) => handleParamChange("checkInterval", Number(e.target.value))}
                fullWidth
            />

            <TextField
                label="Max Attempts"
                type="number"
                value={mevParams.maxAttempts}
                onChange={(e) => handleParamChange("maxAttempts", Number(e.target.value))}
                fullWidth
            />

            <TextField
                label="Thread Workers"
                type="number"
                value={mevParams.threadWorkers}
                onChange={(e) => handleParamChange("threadWorkers", Number(e.target.value))}
                fullWidth
            />

            {/* Добавлен новый Select для режима работы */}
            <FormControl fullWidth>
                <InputLabel>Operation Mode</InputLabel>
                <Select
                    value={mevParams.mode}
                    onChange={(e) => handleParamChange("mode", e.target.value as "manual" | "automatic")}
                    label="Operation Mode"
                >
                    <MenuItem value="manual">Manual</MenuItem>
                    <MenuItem value="automatic">Automatic</MenuItem>
                </Select>
            </FormControl>

            <Typography variant="subtitle1">Wallet Configuration</Typography>

            <RadioGroup
                row
                value={mevParams.walletSource}
                onChange={(e) => handleParamChange("walletSource", e.target.value as "existing" | "manual")}
            >
                <FormControlLabel value="existing" control={<Radio />} label="Existing Wallet" />
                <FormControlLabel value="manual" control={<Radio />} label="Manual Input" />
            </RadioGroup>

            {mevParams.walletSource === "existing" ? (
                wallets && wallets.length > 0 ? (
                    <FormControl fullWidth>
                        <InputLabel>Select Wallet</InputLabel>
                        <Select
                            value={wallets.find(w => w.privateKey === mevParams.privateKey)?.publicKey || ""}
                            onChange={(e) => {
                                const wallet = wallets.find(w => w.publicKey === e.target.value);
                                if (wallet) {
                                    handleParamChange("privateKey", wallet.privateKey);
                                }
                            }}
                            label="Select Wallet"
                        >
                            {wallets.map(wallet => (
                                <MenuItem key={wallet.publicKey} value={wallet.publicKey}>
                                    {wallet.publicKey}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                ) : (
                    <Typography color="error">No wallets available</Typography>
                )
            ) : (
                <TextField
                    label="Private Key"
                    value={mevParams.privateKey}
                    onChange={(e) => handleParamChange("privateKey", e.target.value)}
                    fullWidth
                    type="password"
                />
            )}
        </Box>
    );
}