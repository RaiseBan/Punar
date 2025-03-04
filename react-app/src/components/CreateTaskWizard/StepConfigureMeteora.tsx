import React, { useState } from "react";
import {
    Box,
    Typography,
    TextField,
    Button,
    IconButton,
    Divider,
    Collapse,
    RadioGroup,
    FormControlLabel,
    Radio,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from "@mui/material";
import { ExpandMore, ExpandLess, Delete } from "@mui/icons-material";
import {MeteoraParams} from "../../types";
import {JITO_REGIONS} from "../../constants";

export interface IStepConfigureMeteoraProps {
    taskName: string;
    setTaskName: React.Dispatch<React.SetStateAction<string>>;
    meteoraParams: MeteoraParams;
    setMeteoraParams: React.Dispatch<React.SetStateAction<MeteoraParams>>;
}

export default function StepConfigureMeteora({
                                                 taskName,
                                                 setTaskName,
                                                 meteoraParams,
                                                 setMeteoraParams,
                                             }: IStepConfigureMeteoraProps) {
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const {
        accounts,
        useJito,
        jitoRegion,
        jitoTipAmount,
        additionalParams
    } = meteoraParams;

    const handleAddAccount = () => {
        setMeteoraParams(prev => ({
            ...prev,
            accounts: [...prev.accounts, ""]
        }));
    };

    const handleAccountChange = (index: number, value: string) => {
        setMeteoraParams(prev => {
            const newAccounts = [...prev.accounts];
            newAccounts[index] = value;
            return { ...prev, accounts: newAccounts };
        });
    };

    const handleRemoveAccount = (index: number) => {
        setMeteoraParams(prev => ({
            ...prev,
            accounts: prev.accounts.filter((_, i) => i !== index)
        }));
    };

    const handleAdvancedParamChange = (key: keyof MeteoraParams["additionalParams"], value: number) => {
        setMeteoraParams(prev => ({
            ...prev,
            additionalParams: {
                ...prev.additionalParams,
                [key]: value
            }
        }));
    };

    const handleSetParam = <K extends keyof MeteoraParams>(key: K, value: MeteoraParams[K]) => {
        setMeteoraParams(prev => ({ ...prev, [key]: value }));
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 500 }}>
            <Typography variant="h6">Meteora DLMM Parameters</Typography>

            <TextField
                label="Task Name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                fullWidth
            />

            <Typography variant="subtitle1">Accounts</Typography>
            {accounts.map((account: string, index: number) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                        label={`Account ${index + 1}`}
                        value={account}
                        onChange={(e) => handleAccountChange(index, e.target.value)}
                        fullWidth
                    />
                    <IconButton onClick={() => handleRemoveAccount(index)}>
                        <Delete />
                    </IconButton>
                </Box>
            ))}
            <Button
                variant="outlined"
                onClick={handleAddAccount}
                sx={{ alignSelf: 'flex-start' }}
            >
                + Add Account
            </Button>

            <Divider sx={{ my: 2 }} />

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
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                        label="Jito Tip Amount (lamports)"
                        type="number"
                        value={jitoTipAmount}
                        onChange={(e) => handleSetParam("jitoTipAmount", Number(e.target.value))}
                        fullWidth
                    />
                </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <Box sx={{ cursor: 'pointer' }} onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}>
                <Typography variant="subtitle1">
                    Advanced Parameters {isAdvancedOpen ? <ExpandLess /> : <ExpandMore />}
                </Typography>
            </Box>

            <Collapse in={isAdvancedOpen}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pl: 2 }}>
                    <TextField
                        label="CONFIRMATION_TIMEOUT"
                        type="number"
                        value={meteoraParams.additionalParams.CONFIRMATION_TIMEOUT}
                        onChange={(e) => handleAdvancedParamChange("CONFIRMATION_TIMEOUT", Number(e.target.value))}
                        defaultValue={6000}
                        fullWidth
                    />
                    <TextField
                        label="MAX_TX_ATTEMPTS"
                        type="number"
                        value={meteoraParams.additionalParams.MAX_TX_ATTEMPTS}
                        onChange={(e) => handleAdvancedParamChange("MAX_TX_ATTEMPTS", Number(e.target.value))}
                        defaultValue={10}
                        fullWidth
                    />
                    <TextField
                        label="SLIPPAGE (%)"
                        type="number"
                        value={meteoraParams.additionalParams.SLIPPAGE}
                        onChange={(e) => handleAdvancedParamChange("SLIPPAGE", Number(e.target.value))}
                        defaultValue={7}
                        fullWidth
                    />
                    <TextField
                        label="ADDITIONAL_FEE_ON_FAILED"
                        type="number"
                        value={meteoraParams.additionalParams.ADDITIONAL_FEE_ON_FAILED}
                        onChange={(e) => handleAdvancedParamChange("ADDITIONAL_FEE_ON_FAILED", Number(e.target.value))}
                        defaultValue={100000}
                        fullWidth
                    />
                    <TextField
                        label="FEE_ADD_LIQUIDITY"
                        type="number"
                        value={meteoraParams.additionalParams.FEE_ADD_LIQUIDITY}
                        onChange={(e) => handleAdvancedParamChange("FEE_ADD_LIQUIDITY", Number(e.target.value))}
                        defaultValue={500000}
                        fullWidth
                    />
                    <TextField
                        label="FEE_CLAIM_FEE"
                        type="number"
                        value={meteoraParams.additionalParams.FEE_CLAIM_FEE}
                        onChange={(e) => handleAdvancedParamChange("FEE_CLAIM_FEE", Number(e.target.value))}
                        defaultValue={180000}
                        fullWidth
                    />
                    <TextField
                        label="FEE_REMOVE_LIQUIDITY"
                        type="number"
                        value={meteoraParams.additionalParams.FEE_REMOVE_LIQUIDITY}
                        onChange={(e) => handleAdvancedParamChange("FEE_REMOVE_LIQUIDITY", Number(e.target.value))}
                        defaultValue={500000}
                        fullWidth
                    />
                    <TextField
                        label="FEE_CREATE_POSITION"
                        type="number"
                        value={meteoraParams.additionalParams.FEE_CREATE_POSITION}
                        onChange={(e) => handleAdvancedParamChange("FEE_CREATE_POSITION", Number(e.target.value))}
                        defaultValue={500000}
                        fullWidth
                    />
                </Box>
            </Collapse>
        </Box>
    );
}