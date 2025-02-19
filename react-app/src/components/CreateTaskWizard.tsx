import React, {useEffect, useState} from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Button,
    Typography,
    RadioGroup,
    FormControlLabel,
    Radio,
    TextField,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    Stepper,
    Step,
    StepLabel,
} from "@mui/material";
import { MODULES } from "../constants";

interface TensorSdkParams {
    collectionId: string;
    priceByName: boolean;
    priceConfig: string;
    thresholdPrice: number;
    useJito: boolean;
    jitoRegion: string;
    jitoTipLamports: number;
    useBloxroute: boolean;
    bloxrouteRegion: string;
    bloxrouteTipLamports: number;
    txToSend: number;
    walletSource: 'existing' | 'manual'; // новый параметр
    privateKey: string; // новый параметр
}

const STEPS = ["Choose module", "Configure module", "Review & Create"];

interface CreateTaskWizardProps {
    open: boolean;
    onClose: () => void;
    onCreateTask: (config: any) => void;
}

export default function CreateTaskWizard({
                                             open,
                                             onClose,
                                             onCreateTask,
                                         }: CreateTaskWizardProps) {
    const [step, setStep] = useState(0);

    // Выбранный модуль
    const [selectedModule, setSelectedModule] = useState<string | null>(null);
    const [wallets, setWallets] = useState<{ publicKey: string; privateKey: string }[]>([]);
    // Параметры Tensor sniper (SDK)
    const [tensorSdkParams, setTensorSdkParams] = useState<TensorSdkParams>({
        collectionId: "",
        priceByName: false,
        priceConfig: "",
        thresholdPrice: 0,
        useJito: false,
        jitoRegion: "",
        jitoTipLamports: 1000,
        useBloxroute: false,
        bloxrouteRegion: "",
        bloxrouteTipLamports: 1000000,
        txToSend: 1,
        walletSource: 'existing',
        privateKey: ""
    });

    // Новое: имя таска
    const [taskName, setTaskName] = useState("");

    const handleNext = () => {
        setStep((prev) => prev + 1);
    };
    const handleBack = () => {
        setStep((prev) => prev - 1);
    };
    const handleClose = () => {
        setStep(0);
        setSelectedModule(null);
        setTensorSdkParams({
            collectionId: "",
            priceByName: false,
            priceConfig: "",
            thresholdPrice: 0,
            useJito: false,
            jitoRegion: "",
            jitoTipLamports: 1000,
            useBloxroute: false,
            bloxrouteRegion: "",
            bloxrouteTipLamports: 1000000,
            txToSend: 1,
            walletSource: 'existing', // новый параметр
            privateKey: ""
        });
        setTaskName("");
        onClose();
    };

    const handleCreate = () => {
        if (selectedModule === "tensor_sdk") {
            // Формируем config
            const cfg = {
                module_name: "Tensor sniper (SDK)",
                task_name: taskName || "", // <-- новое поле
                collection_id: tensorSdkParams.collectionId,
                price_by_name: tensorSdkParams.priceByName,
                price_config: tensorSdkParams.priceConfig || null,
                threshold_price: tensorSdkParams.thresholdPrice,
                use_jito: tensorSdkParams.useJito,
                jito_region: tensorSdkParams.jitoRegion || null,
                jito_tip_lamports: tensorSdkParams.jitoTipLamports,
                use_bloxroute: tensorSdkParams.useBloxroute,
                bloxroute_region: tensorSdkParams.bloxrouteRegion || null,
                bloxroute_tip_lamports: tensorSdkParams.bloxrouteTipLamports,
                tx_to_send: tensorSdkParams.txToSend,
                privateKey: tensorSdkParams.privateKey
            };
            onCreateTask(cfg);
        }
        // Можно добавить логику для остальных модулей
        handleClose();
    };

    useEffect(() => {
        const fetchWallets = async () => {
            if (open) {
                try {
                    const wallets = await window.electronAPI!.getWallets();
                    setWallets(wallets);
                } catch (error) {
                    console.error('Error loading wallets:', error);
                }
            }
        };
        fetchWallets();
    }, [open]);

    const renderStepChooseModule = () => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 400 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
                Choose a module to run
            </Typography>

            {MODULES.map((mod) => (
                <Button
                    key={mod.id}
                    variant="contained"
                    onClick={() => {
                        if (!mod.isDisabled) {
                            setSelectedModule(mod.id);
                            handleNext();
                        }
                    }}
                    startIcon={mod.icon}
                    disabled={!!mod.isDisabled}
                    sx={{
                        justifyContent: "flex-start",
                        backgroundColor: mod.isDisabled ? "#555" : "#ff9e44",
                        color: "#000",
                        "&:hover": {
                            backgroundColor: mod.isDisabled ? "#444" : "#ff9800",
                        },
                    }}
                >
                    {mod.label}
                </Button>
            ))}
        </Box>
    );


    // Рендер для шага 1: настройки выбранного модуля
    const renderStepConfigure = () => {
        if (selectedModule === "tensor_sdk") {
            const params = tensorSdkParams;
            return (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 500 }}>
                    <Typography variant="h6">Tensor sniper (SDK) Parameters</Typography>
                    {/* Новое: Task Name */}
                    <TextField
                        label="Task Name"
                        value={taskName}
                        onChange={(e) => setTaskName(e.target.value)}
                        sx={{ mb: 2 }}
                    />

                    {/* Collection id */}
                    <TextField
                        label="Collection ID"
                        value={params.collectionId}
                        onChange={(e) =>
                            setTensorSdkParams({ ...params, collectionId: e.target.value })
                        }
                    />

                    {/* price_by_name */}
                    <Box>
                        <Typography>Price by name?</Typography>
                        <RadioGroup
                            row
                            value={params.priceByName ? "yes" : "no"}
                            onChange={(e) =>
                                setTensorSdkParams({
                                    ...params,
                                    priceByName: e.target.value === "yes",
                                })
                            }
                        >
                            <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                            <FormControlLabel value="no" control={<Radio />} label="No" />
                        </RadioGroup>
                    </Box>
                    {/* Секция выбора кошелька */}
                    <Typography variant="subtitle1" sx={{ mt: 2 }}>
                        Wallet Configuration
                    </Typography>

                    <RadioGroup
                        row
                        value={params.walletSource}
                        onChange={(e) =>
                            setTensorSdkParams({
                                ...params,
                                walletSource: e.target.value as 'existing' | 'manual'
                            })
                        }
                    >
                        <FormControlLabel
                            value="existing"
                            control={<Radio />}
                            label="Select existing wallet"
                        />
                        <FormControlLabel
                            value="manual"
                            control={<Radio />}
                            label="Enter private key manually"
                        />
                    </RadioGroup>

                    {params.walletSource === 'existing' ? (
                        <FormControl fullWidth>
                            <InputLabel>Select Wallet</InputLabel>
                            <Select
                                value={wallets.find(w => w.privateKey === params.privateKey)?.publicKey || ''}
                                onChange={(e) => {
                                    const selectedWallet = wallets.find(w => w.publicKey === e.target.value);
                                    if (selectedWallet) {
                                        setTensorSdkParams({
                                            ...params,
                                            privateKey: selectedWallet.privateKey
                                        });
                                    }
                                }}
                                label="Select Wallet"
                            >
                                {wallets.map((wallet) => (
                                    <MenuItem key={wallet.publicKey} value={wallet.publicKey}>
                                        {wallet.publicKey}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    ) : (
                        <TextField
                            label="Private Key"
                            value={params.privateKey}
                            onChange={(e) =>
                                setTensorSdkParams({ ...params, privateKey: e.target.value })
                            }
                            type="password"
                            fullWidth
                        />
                    )}



                    {/* Если priceByName = true => Price config (строка/файл) */}
                    {params.priceByName && (
                        <TextField
                            label="Price config (file path)"
                            value={params.priceConfig}
                            onChange={(e) =>
                                setTensorSdkParams({ ...params, priceConfig: e.target.value })
                            }
                        />
                    )}

                    {/* Если priceByName = false => thresholdPrice (число) */}
                    {!params.priceByName && (
                        <TextField
                            label="Threshold price (SOL)"
                            type="number"
                            value={params.thresholdPrice}
                            onChange={(e) =>
                                setTensorSdkParams({
                                    ...params,
                                    thresholdPrice: parseFloat(e.target.value),
                                })
                            }
                        />
                    )}

                    {/* useJito */}
                    <Box>
                        <Typography>Use Jito?</Typography>
                        <RadioGroup
                            row
                            value={params.useJito ? "yes" : "no"}
                            onChange={(e) =>
                                setTensorSdkParams({
                                    ...params,
                                    useJito: e.target.value === "yes",
                                })
                            }
                        >
                            <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                            <FormControlLabel value="no" control={<Radio />} label="No" />
                        </RadioGroup>
                    </Box>

                    {/* Если useJito => выбрать region + tip */}
                    {params.useJito && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <FormControl fullWidth>
                                <InputLabel>Region</InputLabel>
                                <Select
                                    label="Region"
                                    value={params.jitoRegion}
                                    onChange={(e) =>
                                        setTensorSdkParams({ ...params, jitoRegion: e.target.value })
                                    }
                                >
                                    <MenuItem value="🇳🇱 Amsterdam">🇳🇱 Amsterdam</MenuItem>
                                    <MenuItem value="🇩🇪 Frankfurt">🇩🇪 Frankfurt</MenuItem>
                                    <MenuItem value="🇺🇸 New York">🇺🇸 New York</MenuItem>
                                    <MenuItem value="🇯🇵 Tokyo">🇯🇵 Tokyo</MenuItem>
                                    <MenuItem value="🇺🇸 Salt Lake City">🇺🇸 Salt Lake City</MenuItem>
                                </Select>
                            </FormControl>

                            <TextField
                                label="Tip amount (lamports)"
                                type="number"
                                inputProps={{ min: 1000 }}
                                value={params.jitoTipLamports}
                                onChange={(e) =>
                                    setTensorSdkParams({
                                        ...params,
                                        jitoTipLamports: parseInt(e.target.value) || 1000,
                                    })
                                }
                            />
                        </Box>
                    )}

                    {/* use bloxroute */}
                    <Box>
                        <Typography>Use Bloxroute?</Typography>
                        <RadioGroup
                            row
                            value={params.useBloxroute ? "yes" : "no"}
                            onChange={(e) =>
                                setTensorSdkParams({
                                    ...params,
                                    useBloxroute: e.target.value === "yes",
                                })
                            }
                        >
                            <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                            <FormControlLabel value="no" control={<Radio />} label="No" />
                        </RadioGroup>
                    </Box>

                    {params.useBloxroute && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <FormControl fullWidth>
                                <InputLabel>Region</InputLabel>
                                <Select
                                    label="Region"
                                    value={params.bloxrouteRegion}
                                    onChange={(e) =>
                                        setTensorSdkParams({
                                            ...params,
                                            bloxrouteRegion: e.target.value,
                                        })
                                    }
                                >
                                    <MenuItem value="🇬🇧 England">🇬🇧 England</MenuItem>
                                    <MenuItem value="🇺🇸 New York">🇺🇸 New York</MenuItem>
                                    <MenuItem value="🇺🇸 Los Angeles">🇺🇸 Los Angeles</MenuItem>
                                    <MenuItem value="🇩🇪 Frankfurt">🇩🇪 Frankfurt</MenuItem>
                                    <MenuItem value="🇳🇱 Amsterdam">🇳🇱 Amsterdam</MenuItem>
                                    <MenuItem value="🇯🇵 Tokyo">🇯🇵 Tokyo</MenuItem>
                                </Select>
                            </FormControl>

                            <TextField
                                label="Tip amount (lamports)"
                                type="number"
                                // min 0.001 SOL => 1000000 lamports
                                inputProps={{ min: 1000000 }}
                                value={params.bloxrouteTipLamports}
                                onChange={(e) =>
                                    setTensorSdkParams({
                                        ...params,
                                        bloxrouteTipLamports: parseInt(e.target.value) || 1000000,
                                    })
                                }
                            />
                        </Box>
                    )}

                    {/* tx_to_send */}
                    <TextField
                        label="Tx to send"
                        type="number"
                        value={params.txToSend}
                        onChange={(e) =>
                            setTensorSdkParams({
                                ...params,
                                txToSend: parseInt(e.target.value) || 1,
                            })
                        }
                    />
                </Box>
            );
        }

        // Заглушка для недоступных модулей
        return (
            <Typography color="error">
                This module is not yet supported.
            </Typography>
        );
    };

    // Шаг 2: вывод выбранных параметров + «Confirm»
    const renderStepReview = () => {
        if (selectedModule === "tensor_sdk") {
            const p = tensorSdkParams;
            return (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 500 }}>
                    <Typography variant="h6">Review your parameters</Typography>
                    <Typography>
                        <b>Task Name:</b> {taskName}
                    </Typography>
                    <Typography>
                        <b>Module:</b> Tensor sniper (SDK)
                    </Typography>
                    <Typography>
                        <b>collectionId:</b> {p.collectionId}
                    </Typography>
                    <Typography>
                        <b>Wallet Source:</b> {p.walletSource === 'existing'
                        ? 'Existing Wallet'
                        : 'Manual Entry'}
                    </Typography>
                    <Typography>
                        <b>Wallet:</b> {p.walletSource === 'existing'
                        ? wallets.find(w => w.privateKey === p.privateKey)?.publicKey
                        : '*********'}
                    </Typography>
                    <Typography>
                        <b>priceByName:</b> {p.priceByName ? "Yes" : "No"}
                    </Typography>
                    {p.priceByName && (
                        <Typography>
                            <b>priceConfig:</b> {p.priceConfig}
                        </Typography>
                    )}
                    {!p.priceByName && (
                        <Typography>
                            <b>thresholdPrice (SOL):</b> {p.thresholdPrice}
                        </Typography>
                    )}

                    <Typography>
                        <b>useJito:</b> {p.useJito ? "Yes" : "No"}
                    </Typography>
                    {p.useJito && (
                        <>
                            <Typography>
                                <b>jitoRegion:</b> {p.jitoRegion}
                            </Typography>
                            <Typography>
                                <b>jitoTipLamports:</b> {p.jitoTipLamports}
                            </Typography>
                        </>
                    )}

                    <Typography>
                        <b>useBloxroute:</b> {p.useBloxroute ? "Yes" : "No"}
                    </Typography>
                    {p.useBloxroute && (
                        <>
                            <Typography>
                                <b>bloxrouteRegion:</b> {p.bloxrouteRegion}
                            </Typography>
                            <Typography>
                                <b>bloxrouteTipLamports:</b> {p.bloxrouteTipLamports}
                            </Typography>
                        </>
                    )}

                    <Typography>
                        <b>txToSend:</b> {p.txToSend}
                    </Typography>
                </Box>
            );
        }
        return null;
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
            <DialogTitle>Create Task</DialogTitle>
            <DialogContent dividers>
                <Stepper activeStep={step} sx={{ mb: 3 }}>
                    {STEPS.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {step === 0 && renderStepChooseModule()}
                {step === 1 && renderStepConfigure()}
                {step === 2 && renderStepReview()}
            </DialogContent>

            <DialogActions>
                {step > 0 && (
                    <Button onClick={handleBack} color="inherit">
                        Back
                    </Button>
                )}
                {step < 2 && (
                    <Button onClick={handleNext} variant="contained">
                        Next
                    </Button>
                )}
                {step === 2 && (
                    <Button onClick={handleCreate} variant="contained" color="primary">
                        Create
                    </Button>
                )}
                <Button onClick={handleClose} color="inherit">
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    );
}
