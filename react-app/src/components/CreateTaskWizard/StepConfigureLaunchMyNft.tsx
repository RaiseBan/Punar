import React from "react";
import {
    Box,
    Typography,
    TextField,
    RadioGroup,
    FormControlLabel,
    Radio,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Divider
} from "@mui/material";

import { LaunchMyNftParams, Wallet } from "../../types";

export interface IStepConfigureLaunchMyNftProps {
    taskName: string;
    setTaskName: React.Dispatch<React.SetStateAction<string>>;

    launchMyNftParams: LaunchMyNftParams;
    setLaunchMyNftParams: React.Dispatch<React.SetStateAction<LaunchMyNftParams>>;

    wallets?: Wallet[];       // Сделаем опционально (на случай undefined)
    walletSets?: string[];    // Аналогично
}

export default function StepConfigureLaunchMyNft({
                                                     taskName,
                                                     setTaskName,
                                                     launchMyNftParams,
                                                     setLaunchMyNftParams,
                                                     wallets,
                                                     walletSets,
                                                 }: IStepConfigureLaunchMyNftProps) {
    const {
        target_url,
        total_priority_fee,
        compute_unit_limit,
        useJito,
        jito_tip_amount,
        jito_region,
        delay_when_sending,
        delay_before_sending,
        nfts_to_buy_per_account,
        walletApproach,
        singleWalletMethod,
        selectedWalletPublicKey,
        manualPrivateKey,
        chosenSetName,
    } = launchMyNftParams;

    const handleSetParam = <K extends keyof LaunchMyNftParams>(key: K, value: LaunchMyNftParams[K]) => {
        setLaunchMyNftParams((prev) => ({ ...prev, [key]: value }));
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 500 }}>
            <Typography variant="h6">LaunchMyNft Parameters</Typography>

            {/* Task Name */}
            <TextField
                label="Task Name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                fullWidth
            />

            {/* Target URL */}
            <TextField
                label="Target URL"
                value={target_url}
                onChange={(e) => handleSetParam("target_url", e.target.value)}
                fullWidth
            />

            {/* Total Priority Fee */}
            <TextField
                label="Total Priority Fee (lamports)"
                type="number"
                value={total_priority_fee}
                onChange={(e) => handleSetParam("total_priority_fee", parseInt(e.target.value) || 0)}
                fullWidth
            />

            {/* Compute Unit Limit */}
            <TextField
                label="Compute Unit Limit"
                type="number"
                value={compute_unit_limit}
                onChange={(e) => handleSetParam("compute_unit_limit", parseInt(e.target.value) || 1400000)}
                fullWidth
            />

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

            {/* Если useJito => select Region + tip amount */}
            {useJito && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <FormControl fullWidth>
                        <InputLabel>Jito Region</InputLabel>
                        <Select
                            label="Jito Region"
                            value={jito_region}
                            onChange={(e) => handleSetParam("jito_region", e.target.value)}
                        >
                            <MenuItem value="">-- Select region --</MenuItem>
                            <MenuItem value="https://amsterdam.mainnet.block-engine.jito.wtf">Amsterdam</MenuItem>
                            <MenuItem value="https://ny.mainnet.block-engine.jito.wtf">New York</MenuItem>
                            {/* ...etc */}
                        </Select>
                    </FormControl>

                    <TextField
                        label="Jito tip amount (lamports)"
                        type="number"
                        value={jito_tip_amount}
                        onChange={(e) => handleSetParam("jito_tip_amount", parseInt(e.target.value) || 1000)}
                        fullWidth
                    />
                </Box>
            )}

            {/* Delays */}
            <TextField
                label="Delay when sending (ms)"
                type="number"
                value={delay_when_sending}
                onChange={(e) => handleSetParam("delay_when_sending", parseInt(e.target.value) || 0)}
                fullWidth
            />

            <TextField
                label="Delay before sending (ms)"
                type="number"
                value={delay_before_sending}
                onChange={(e) => handleSetParam("delay_before_sending", parseInt(e.target.value) || 0)}
                fullWidth
            />

            <TextField
                label="NFTs to buy per account"
                type="number"
                value={nfts_to_buy_per_account}
                onChange={(e) =>
                    handleSetParam("nfts_to_buy_per_account", parseInt(e.target.value) || 1)
                }
                fullWidth
            />

            <Divider sx={{ my: 2 }} />

            {/* Wallet Approach: single / set */}
            <Typography>Wallet Approach</Typography>
            <RadioGroup
                row
                value={walletApproach}
                onChange={(e) => handleSetParam("walletApproach", e.target.value as "single" | "set")}
            >
                <FormControlLabel value="single" control={<Radio />} label="Single" />
                <FormControlLabel value="set" control={<Radio />} label="Wallet set" />
            </RadioGroup>

            {/* Если single → radio: existing/manual */}
            {walletApproach === "single" && (
                <Box sx={{ ml: 3 }}>
                    <Typography>Single Wallet Method</Typography>
                    <RadioGroup
                        row
                        value={singleWalletMethod}
                        onChange={(e) =>
                            handleSetParam("singleWalletMethod", e.target.value as "existing" | "manual")
                        }
                    >
                        <FormControlLabel value="existing" control={<Radio />} label="Existing" />
                        <FormControlLabel value="manual" control={<Radio />} label="Manual" />
                    </RadioGroup>

                    {/* existing => Select wallet */}
                    {singleWalletMethod === "existing" ? (
                        wallets && wallets.length > 0 ? (
                            <FormControl fullWidth sx={{ mt: 1 }}>
                                <InputLabel>Select Wallet</InputLabel>
                                <Select
                                    label="Select Wallet"
                                    value={selectedWalletPublicKey}
                                    onChange={(e) =>
                                        handleSetParam("selectedWalletPublicKey", e.target.value as string)
                                    }
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
                            <Typography color="error" sx={{ mt: 1 }}>
                                No available wallets
                            </Typography>
                        )
                    ) : (
                        // manual => text password
                        <TextField
                            label="Private Key"
                            type="password"
                            value={manualPrivateKey}
                            onChange={(e) => handleSetParam("manualPrivateKey", e.target.value)}
                            fullWidth
                            sx={{ mt: 1 }}
                        />
                    )}
                </Box>
            )}

            {/* Если set => выпадающий список с именами сетов */}
            {walletApproach === "set" && (
                walletSets && walletSets.length > 0 ? (
                    <FormControl fullWidth>
                        <InputLabel>Select Wallet Set</InputLabel>
                        <Select
                            label="Select Wallet Set"
                            value={chosenSetName}
                            onChange={(e) => handleSetParam("chosenSetName", e.target.value)}
                        >
                            <MenuItem value="">-- Select Wallet Set --</MenuItem>
                            {walletSets.map((name) => (
                                <MenuItem key={name} value={name}>
                                    {name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                ) : (
                    <Typography color="error" sx={{ mt: 1 }}>
                        No available wallet sets
                    </Typography>
                )
            )}
        </Box>
    );
}
