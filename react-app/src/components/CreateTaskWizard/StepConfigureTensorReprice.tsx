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

import { Wallet, TensorSdkParams } from "../../types";

export interface IStepConfigureTensorRepriceProps {
    taskName: string;
    setTaskName: React.Dispatch<React.SetStateAction<string>>;

    tensorSdkParams: TensorSdkParams;
    setTensorSdkParams: React.Dispatch<React.SetStateAction<TensorSdkParams>>;

    wallets?: Wallet[];
    repriceConfigs?: string[];
}

export default function StepConfigureTensorReprice({
                                                       taskName,
                                                       setTaskName,
                                                       tensorSdkParams,
                                                       setTensorSdkParams,
                                                       wallets,
                                                       repriceConfigs,
                                                   }: IStepConfigureTensorRepriceProps) {
    const { collectionId, walletSource, privateKey, delta, priceConfig } = tensorSdkParams;

    // Утилита для обновления полей
    const handleSetParam = <K extends keyof TensorSdkParams>(key: K, value: TensorSdkParams[K]) => {
        setTensorSdkParams((prev) => ({ ...prev, [key]: value }));
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 500 }}>
            <Typography variant="h6">Tensor Reprice Parameters</Typography>

            <TextField
                label="Task Name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                fullWidth
            />

            <TextField
                label="Collection ID"
                value={collectionId}
                onChange={(e) => handleSetParam("collectionId", e.target.value)}
                fullWidth
            />

            {/* Wallet Source */}
            <Typography>Wallet Source</Typography>
            <RadioGroup
                row
                value={walletSource}
                onChange={(e) => handleSetParam("walletSource", e.target.value as "existing" | "manual")}
            >
                <FormControlLabel value="existing" control={<Radio />} label="Existing" />
                <FormControlLabel value="manual" control={<Radio />} label="Manual" />
            </RadioGroup>

            {/* Если existing => Select wallet. Иначе -> manual entry */}
            {walletSource === "existing" ? (
                wallets && wallets.length > 0 ? (
                    <FormControl fullWidth>
                        <InputLabel>Select Wallet</InputLabel>
                        <Select
                            label="Select Wallet"
                            value={wallets.find((w) => w.privateKey === privateKey)?.publicKey || ""}
                            onChange={(e) => {
                                const found = wallets.find((w) => w.publicKey === e.target.value);
                                if (found) {
                                    handleSetParam("privateKey", found.privateKey);
                                }
                            }}
                        >
                            <MenuItem value="">-- Select wallet --</MenuItem>
                            {wallets.map((w) => (
                                <MenuItem key={w.publicKey} value={w.publicKey}>
                                    {w.publicKey}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                ) : (
                    <Typography color="error">No available wallets</Typography>
                )
            ) : (
                <TextField
                    label="Private Key"
                    type="password"
                    value={privateKey}
                    onChange={(e) => handleSetParam("privateKey", e.target.value)}
                    fullWidth
                />
            )}

            {/* Delta */}
            <TextField
                label="Delta"
                type="number"
                value={delta}
                onChange={(e) => handleSetParam("delta", parseFloat(e.target.value) || 0)}
                fullWidth
            />

            {/* Price Config */}
            {repriceConfigs && repriceConfigs.length > 0 ? (
                <FormControl fullWidth>
                    <InputLabel>Reprice Config</InputLabel>
                    <Select
                        label="Reprice Config"
                        value={priceConfig}
                        onChange={(e) => handleSetParam("priceConfig", e.target.value)}
                    >
                        <MenuItem value="">-- Select reprice config --</MenuItem>
                        {repriceConfigs.map((filePath) => (
                            <MenuItem key={filePath} value={filePath}>
                                {filePath.split(/[/\\]/).pop()}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            ) : (
                <Typography color="error">No reprice configs available</Typography>
            )}
        </Box>
    );
}
