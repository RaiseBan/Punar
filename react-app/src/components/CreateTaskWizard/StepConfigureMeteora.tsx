import React, {useState} from "react";
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
import {ExpandMore, ExpandLess, Delete} from "@mui/icons-material";
import {MeteoraParams, Wallet} from "../../types";
import {JITO_REGIONS, STRATEGY} from "../../constants";

export interface IStepConfigureMeteoraProps {
    taskName: string;
    setTaskName: React.Dispatch<React.SetStateAction<string>>;
    meteoraParams: MeteoraParams;
    setMeteoraParams: React.Dispatch<React.SetStateAction<MeteoraParams>>;
    wallets?: Wallet[];
}

export default function StepConfigureMeteora({
                                                 taskName,
                                                 setTaskName,
                                                 meteoraParams,
                                                 setMeteoraParams,
                                                 wallets,
                                             }: IStepConfigureMeteoraProps) {
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const {
        accounts,
        useJito,
        jitoRegion,
        jitoTipAmount,
        walletSource,
        strategy,
        privateKey,
        additionalParams
    } = meteoraParams;

    // Обработчики для аккаунтов
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
            return {...prev, accounts: newAccounts};
        });
    };

    const handleRemoveAccount = (index: number) => {
        setMeteoraParams(prev => ({
            ...prev,
            accounts: prev.accounts.filter((_, i) => i !== index)
        }));
    };

    // Обработчики для параметров
    const handleSetParam = <K extends keyof MeteoraParams>(key: K, value: MeteoraParams[K]) => {
        setMeteoraParams(prev => ({...prev, [key]: value}));
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

    return (
        <Box sx={{display: "flex", flexDirection: "column", gap: 2, minWidth: 500}}>
            <Typography variant="h6">Meteora DLMM Parameters</Typography>

            {/* Название задачи */}
            <TextField
                label="Task Name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                fullWidth
            />

            {/* Секция выбора кошелька */}
            <Typography variant="subtitle1">Wallet Configuration</Typography>
            <RadioGroup
                row
                value={walletSource}
                onChange={(e) => handleSetParam("walletSource", e.target.value as "existing" | "manual")}
            >
                <FormControlLabel value="existing" control={<Radio/>} label="Existing Wallet"/>
                <FormControlLabel value="manual" control={<Radio/>} label="Manual Input"/>
            </RadioGroup>

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

            {/* Секция аккаунтов */}
            <Typography variant="subtitle1">Accounts</Typography>
            {accounts.map((account: string, index: number) => (
                <Box key={index} sx={{display: 'flex', gap: 1, alignItems: 'center'}}>
                    <TextField
                        label={`Account ${index + 1}`}
                        value={account}
                        onChange={(e) => handleAccountChange(index, e.target.value)}
                        fullWidth
                    />
                    <IconButton onClick={() => handleRemoveAccount(index)}>
                        <Delete/>
                    </IconButton>
                </Box>
            ))}
            <Button
                variant="outlined"
                onClick={handleAddAccount}
                sx={{alignSelf: 'flex-start'}}
            >
                + Add Account
            </Button>

            {/* Секция Jito */}
            <Divider sx={{my: 2}}/>
            <Typography>Use Jito?</Typography>
            <RadioGroup
                row
                value={useJito ? "yes" : "no"}
                onChange={(e) => handleSetParam("useJito", e.target.value === "yes")}
            >
                <FormControlLabel value="yes" control={<Radio/>} label="Yes"/>
                <FormControlLabel value="no" control={<Radio/>} label="No"/>
            </RadioGroup>

            {useJito && (
                <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
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
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                <InputLabel>STRATEGY</InputLabel>
                <Select
                    label="STRATEGY"
                    value={strategy}
                    onChange={(e) => handleSetParam("strategy", e.target.value)}
                >
                    <MenuItem value="">-- Select region --</MenuItem>
                    {STRATEGY.map((strategy) => (
                        <MenuItem key={strategy.value} value={strategy.value}>
                            {strategy.label}
                        </MenuItem>
                    ))}
                </Select>

            </Box>
            {/* Расширенные параметры */}
            <Divider sx={{my: 2}}/>
            <Box sx={{cursor: 'pointer'}} onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}>
                <Typography variant="subtitle1">
                    Advanced Parameters {isAdvancedOpen ? <ExpandLess/> : <ExpandMore/>}
                </Typography>
            </Box>

            <Collapse in={isAdvancedOpen}>
                <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, pl: 2}}>
                    {Object.entries(additionalParams).map(([key, value]) => (
                        <TextField
                            key={key}
                            label={key.replace(/_/g, ' ')}
                            type="number"
                            value={value}
                            onChange={(e) =>
                                handleAdvancedParamChange(
                                    key as keyof MeteoraParams["additionalParams"],
                                    Number(e.target.value)
                                )}
                            fullWidth
                        />
                    ))}
                </Box>
            </Collapse>
        </Box>
    );
}