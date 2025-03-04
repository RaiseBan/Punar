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
import {JITO_REGIONS} from "../../constants";

export interface IStepConfigureTensorSdkProps {
    taskName: string;
    setTaskName: React.Dispatch<React.SetStateAction<string>>;

    tensorSdkParams: TensorSdkParams;
    setTensorSdkParams: React.Dispatch<React.SetStateAction<TensorSdkParams>>;

    wallets?: Wallet[];
    snipeConfigs?: string[];
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

    const handleSetParam = <K extends keyof TensorSdkParams>(key: K, value: TensorSdkParams[K]) => {
        setTensorSdkParams((prev) => ({ ...prev, [key]: value }));
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 500 }}>
            <Typography variant="h6">Tensor sniper (SDK) Parameters</Typography>

            {/* Task Name */}
            <TextField
                label="Task Name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                fullWidth
            />

            {/* Collection ID */}
            <TextField
                label="Collection URL On Tensor"
                value={collectionId}
                onChange={(e) => handleSetParam("collectionId", e.target.value)}
                fullWidth
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
                    fullWidth
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
                    fullWidth
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
                        fullWidth
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
                    <FormControl fullWidth>
                        <InputLabel>Bloxroute Region</InputLabel>
                        <Select
                            label="Bloxroute Region"
                            value={bloxrouteRegion}
                            onChange={(e) => handleSetParam("bloxrouteRegion", e.target.value)}
                        >
                            <MenuItem value="">-- Select Bloxroute region --</MenuItem>
                            <MenuItem value="England">🇬🇧 England</MenuItem>
                            <MenuItem value="New York">🇺🇸 New York</MenuItem>
                            <MenuItem value="Los Angeles">🇺🇸 Los Angeles</MenuItem>
                            <MenuItem value="Frankfurt">🇩🇪 Frankfurt</MenuItem>
                            <MenuItem value="Amsterdam">🇳🇱 Amsterdam</MenuItem>
                            <MenuItem value="Tokyo">🇯🇵 Tokyo</MenuItem>
                        </Select>
                    </FormControl>

                    <TextField
                        label="Bloxroute Tip (lamports)"
                        type="number"
                        value={bloxrouteTipLamports}
                        onChange={(e) =>
                            handleSetParam("bloxrouteTipLamports", parseInt(e.target.value) || 1000000)
                        }
                        fullWidth
                    />
                </Box>
            )}

            {/* Tx to send */}
            <TextField
                label="Tx to send"
                type="number"
                value={txToSend}
                onChange={(e) => handleSetParam("txToSend", parseInt(e.target.value) || 1)}
                fullWidth
            />
        </Box>
    );
}
