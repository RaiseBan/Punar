import React, { useState, useCallback } from "react";
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
import { JITO_REGIONS } from "../../constants";
import {
    validateTensorCollection,
    validatePrivateKey,
    validatePositiveNumber,
    validatePositiveInteger,
    validateNonEmptyString
} from "../../utils/validators";

export interface IStepConfigureTensorSdkProps {
    taskName: string;
    setTaskName: React.Dispatch<React.SetStateAction<string>>;
    tensorSdkParams: TensorSdkParams;
    setTensorSdkParams: React.Dispatch<React.SetStateAction<TensorSdkParams>>;
    wallets?: Wallet[];
    snipeConfigs?: string[];
}

interface FieldErrors {
    [key: string]: string | null;
}

export default function StepConfigureTensorSdk({
    taskName,
    setTaskName,
    tensorSdkParams,
    setTensorSdkParams,
    wallets,
    snipeConfigs,
}: IStepConfigureTensorSdkProps) {
    const {
        collectionId,
        priceByName,
        priceConfig,
        thresholdPrice,
        walletSource,
        privateKey,
        useJito,
        jitoRegion,
        jitoTipLamports,
        useBloxroute,
        bloxrouteRegion,
        bloxrouteTipLamports,
        txToSend,
    } = tensorSdkParams;

    const [errors, setErrors] = useState<FieldErrors>({});
    const [touched, setTouched] = useState<Set<string>>(new Set());

    const handleSetParam = <K extends keyof TensorSdkParams>(key: K, value: TensorSdkParams[K]) => {
        setTensorSdkParams((prev) => ({ ...prev, [key]: value }));
        
        // Валидация на лету если поле уже было тронуто
        if (touched.has(key)) {
            const error = validateField(key, value);
            setErrors(prev => ({ ...prev, [key]: error }));
        }
    };

    const validateField = useCallback((field: string, value: any): string | null => {
        switch (field) {
            case 'taskName':
                const nameResult = validateNonEmptyString(value, 'Task name');
                return nameResult.isValid ? null : nameResult.error || 'Required';

            case 'collectionId':
                const collResult = validateTensorCollection(value);
                return collResult.isValid ? null : collResult.error || 'Invalid collection';

            case 'thresholdPrice':
                if (priceByName) return null; // Не нужна валидация если priceByName
                const priceResult = validatePositiveNumber(value);
                return priceResult.isValid ? null : priceResult.error || 'Invalid price';

            case 'privateKey':
                if (walletSource !== 'manual') return null; // Не нужна валидация если existing
                const keyResult = validatePrivateKey(value);
                return keyResult.isValid ? null : keyResult.error || 'Invalid private key';

            case 'jitoTipLamports':
                if (!useJito) return null;
                const jitoResult = validatePositiveInteger(value);
                return jitoResult.isValid ? null : jitoResult.error || 'Invalid amount';

            case 'bloxrouteTipLamports':
                if (!useBloxroute) return null;
                const bloxResult = validatePositiveInteger(value);
                return bloxResult.isValid ? null : bloxResult.error || 'Invalid amount';

            case 'txToSend':
                const txResult = validatePositiveInteger(value);
                return txResult.isValid ? null : txResult.error || 'Invalid number';

            default:
                return null;
        }
    }, [priceByName, walletSource, useJito, useBloxroute]);

    const handleBlur = useCallback((field: string, value: any) => {
        setTouched(prev => new Set(prev).add(field));
        const error = validateField(field, value);
        setErrors(prev => ({ ...prev, [field]: error }));
    }, [validateField]);

    const getError = (field: string) => {
        return touched.has(field) ? errors[field] : null;
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 500 }}>
            <Typography variant="h6">Tensor sniper (SDK) Parameters</Typography>

            {/* Task Name */}
            <TextField
                label="Task Name"
                value={taskName}
                onChange={(e) => {
                    setTaskName(e.target.value);
                    if (touched.has('taskName')) {
                        const error = validateField('taskName', e.target.value);
                        setErrors(prev => ({ ...prev, taskName: error }));
                    }
                }}
                onBlur={() => handleBlur('taskName', taskName)}
                error={!!getError('taskName')}
                helperText={getError('taskName') || 'Name for this task'}
                fullWidth
                required
            />

            {/* Collection ID */}
            <TextField
                label="Collection URL On Tensor"
                value={collectionId}
                onChange={(e) => handleSetParam("collectionId", e.target.value)}
                onBlur={() => handleBlur('collectionId', collectionId)}
                error={!!getError('collectionId')}
                helperText={getError('collectionId') || 'Tensor collection URL or ID'}
                fullWidth
                required
            />

            {/* Price by name? */}
            <Typography>Price by name?</Typography>
            <RadioGroup
                row
                value={priceByName ? "yes" : "no"}
                onChange={(e) => handleSetParam("priceByName", e.target.value === "yes")}
            >
                <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                <FormControlLabel value="no" control={<Radio />} label="No" />
            </RadioGroup>

            {/* Если priceByName => Select config, иначе thresholdPrice */}
            {priceByName ? (
                snipeConfigs && snipeConfigs.length > 0 ? (
                    <FormControl fullWidth>
                        <InputLabel>Snipe Config</InputLabel>
                        <Select
                            label="Snipe Config"
                            value={priceConfig}
                            onChange={(e) => handleSetParam("priceConfig", e.target.value)}
                        >
                            <MenuItem value="">-- Select config file --</MenuItem>
                            {snipeConfigs.map((filePath) => (
                                <MenuItem key={filePath} value={filePath}>
                                    {filePath.split(/[/\\]/).pop()}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                ) : (
                    <Typography color="error">No snipe configs available</Typography>
                )
            ) : (
                <TextField
                    label="Threshold price (SOL)"
                    type="number"
                    value={thresholdPrice}
                    onChange={(e) => handleSetParam("thresholdPrice", parseFloat(e.target.value) || 0)}
                    onBlur={() => handleBlur('thresholdPrice', thresholdPrice)}
                    error={!!getError('thresholdPrice')}
                    helperText={getError('thresholdPrice') || 'Maximum price to pay in SOL'}
                    fullWidth
                    required
                    inputProps={{ min: 0, step: 0.01 }}
                />
            )}

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

            {/* Если existing => Select wallet, иначе manual */}
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
                    onBlur={() => handleBlur('privateKey', privateKey)}
                    error={!!getError('privateKey')}
                    helperText={getError('privateKey') || 'Base58 encoded private key'}
                    fullWidth
                    required
                />
            )}

            {/* Use Jito? */}
            <Typography>Use Jito?</Typography>
            <RadioGroup
                row
                value={useJito ? "yes" : "no"}
                onChange={(e) => handleSetParam("useJito", e.target.value === "yes")}
            >
                <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                <FormControlLabel value="no" control={<Radio />} label="No" />
            </RadioGroup>

            {useJito && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <FormControl fullWidth>
                        <InputLabel>Jito Region</InputLabel>
                        <Select
                            label="Jito Region"
                            value={jitoRegion}
                            onChange={(e) => handleSetParam("jitoRegion", e.target.value)}
                        >
                            <MenuItem value="">-- Select region --</MenuItem>
                            {JITO_REGIONS.map((region) => (
                                <MenuItem key={region.value} value={region.value}>
                                    {region.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        label="Jito tip lamports"
                        type="number"
                        value={jitoTipLamports}
                        onChange={(e) => handleSetParam("jitoTipLamports", parseInt(e.target.value) || 1000)}
                        onBlur={() => handleBlur('jitoTipLamports', jitoTipLamports)}
                        error={!!getError('jitoTipLamports')}
                        helperText={getError('jitoTipLamports') || 'Tip amount in lamports'}
                        fullWidth
                        inputProps={{ min: 0 }}
                    />
                </Box>
            )}

            {/* Use Bloxroute? */}
            <Typography>Use Bloxroute?</Typography>
            <RadioGroup
                row
                value={useBloxroute ? "yes" : "no"}
                onChange={(e) => handleSetParam("useBloxroute", e.target.value === "yes")}
            >
                <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                <FormControlLabel value="no" control={<Radio />} label="No" />
            </RadioGroup>

            {useBloxroute && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <TextField
                        label="Bloxroute Region"
                        value={bloxrouteRegion}
                        onChange={(e) => handleSetParam("bloxrouteRegion", e.target.value)}
                        fullWidth
                    />

                    <TextField
                        label="Bloxroute tip lamports"
                        type="number"
                        value={bloxrouteTipLamports}
                        onChange={(e) => handleSetParam("bloxrouteTipLamports", parseInt(e.target.value) || 1000000)}
                        onBlur={() => handleBlur('bloxrouteTipLamports', bloxrouteTipLamports)}
                        error={!!getError('bloxrouteTipLamports')}
                        helperText={getError('bloxrouteTipLamports') || 'Tip amount in lamports'}
                        fullWidth
                        inputProps={{ min: 0 }}
                    />
                </Box>
            )}

            {/* Tx to send */}
            <TextField
                label="Transactions to send"
                type="number"
                value={txToSend}
                onChange={(e) => handleSetParam("txToSend", parseInt(e.target.value) || 1)}
                onBlur={() => handleBlur('txToSend', txToSend)}
                error={!!getError('txToSend')}
                helperText={getError('txToSend') || 'Number of transactions to send'}
                fullWidth
                inputProps={{ min: 1 }}
            />
        </Box>
    );
}