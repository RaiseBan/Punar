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
    Divider,
} from "@mui/material";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import {MODULES} from "../constants";
// Импорт, если иконка ещё не добавлена


interface ModuleItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    isDisabled?: boolean;
}

// ------------------------
// Пример структуры "Wallet" (см. ваш код для одиночных кошельков)
interface Wallet {
    publicKey: string;
    privateKey: string;
}

// ------------------------
// Параметры для "Tensor sniper (SDK)" и "Tensor reprice" (уже были)
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
    delta: number;
    txToSend: number;
    walletSource: 'existing' | 'manual'; // уже было
    privateKey: string; // уже было
}

// ------------------------
// ПАРАМЕТРЫ НОВОГО МОДУЛЯ LAUNCH_MY_NFT
interface LaunchMyNftParams {
    target_url: string;
    total_priority_fee: number;
    compute_unit_limit: number;
    useJito: boolean;
    jito_tip_account: string;
    jito_tip_amount: number;
    jito_region: string;
    delay_when_sending: number;
    delay_before_sending: number;
    nfts_to_buy_per_account: number;

    // Логика выбора кошельков:
    // 1) "single"  или  "set"
    walletApproach: 'single' | 'set';

    // Если single → user может выбрать "existing" или "manual"
    singleWalletMethod: 'existing' | 'manual';

    // Если single + existing → privateKey берём из списка, а сюда сохраняем publicKey
    selectedWalletPublicKey: string;

    // Если single + manual → вводим вручную
    manualPrivateKey: string;

    // Если set → пользователь выбирает имя сета
    chosenSetName: string;
}

// ------------------------
const STEPS = ["Choose module", "Configure module", "Review & Create"];

// ------------------------
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

    // Одиночные кошельки (список), уже было
    const [wallets, setWallets] = useState<Wallet[]>([]);

    // Параметры Tensor sniper (SDK) + reprice
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
        delta: 50000,
        walletSource: 'existing',
        privateKey: ""
    });

    // ---- НОВОЕ: Параметры LaunchMyNft
    const [launchMyNftParams, setLaunchMyNftParams] = useState<LaunchMyNftParams>({
        target_url: "",
        total_priority_fee: 0,
        compute_unit_limit: 1400000, // к примеру
        useJito: false,
        jito_tip_account: "",
        jito_tip_amount: 10000,
        jito_region: "",
        delay_when_sending: 0,
        delay_before_sending: 0,
        nfts_to_buy_per_account: 1,

        walletApproach: 'single',
        singleWalletMethod: 'existing',
        selectedWalletPublicKey: "",
        manualPrivateKey: "",
        chosenSetName: "",
    });

    // Имя таска
    const [taskName, setTaskName] = useState("");

    // walletSets: ключи для выпадающего списка, если пользователь выбрал «Wallet Set»
    const [walletSets, setWalletSets] = useState<string[]>([]);

    // ------------------------
    // Шаги
    const handleNext = () => setStep((prev) => prev + 1);
    const handleBack = () => setStep((prev) => prev - 1);

    const handleClose = () => {
        setStep(0);
        setSelectedModule(null);

        // Сброс Tensor
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
            delta: 50000,
            txToSend: 1,
            walletSource: 'existing',
            privateKey: ""
        });

        // Сброс LaunchMyNft
        setLaunchMyNftParams({
            target_url: "",
            total_priority_fee: 0,
            compute_unit_limit: 1400000,
            useJito: false,
            jito_tip_account: "",
            jito_tip_amount: 10000,
            jito_region: "",
            delay_when_sending: 0,
            delay_before_sending: 0,
            nfts_to_buy_per_account: 1,

            walletApproach: 'single',
            singleWalletMethod: 'existing',
            selectedWalletPublicKey: "",
            manualPrivateKey: "",
            chosenSetName: "",
        });

        setTaskName("");
        onClose();
    };

    // ------------------------
    // Создание таска (шаг Review & Create → Create)
    const handleCreate = async () => {
        if (selectedModule === "tensor_sdk") {
            const settings = await window.electronAPI?.getSettings();
            const p = tensorSdkParams;
            const cfg = {
                module_name: "Tensor sniper (SDK)",
                task_name: taskName || "",
                collection_id: p.collectionId,
                price_by_name: p.priceByName,
                price_config: p.priceConfig || null,
                threshold_price: p.thresholdPrice,
                use_jito: p.useJito,
                jito_region: p.jitoRegion || null,
                jito_tip_lamports: p.jitoTipLamports,
                use_bloxroute: p.useBloxroute,
                bloxroute_region: p.bloxrouteRegion || null,
                bloxroute_tip_lamports: p.bloxrouteTipLamports,
                tx_to_send: p.txToSend,
                privateKey: p.privateKey,
                main_rpc: settings?.mainRpc || "",
                helius_rpcs: settings?.heliusRpcs || [],
            };
            onCreateTask(cfg);

        } else if (selectedModule === "tensor_reprice") {
            const settings = await window.electronAPI?.getSettings();
            const p = tensorSdkParams;
            const cfg = {
                module_name: "Tensor reprice",
                task_name: taskName,
                collection_id: p.collectionId,
                delta: p.delta,
                limit_config: p.priceConfig,
                privateKey: p.privateKey,
                main_rpc: settings?.mainRpc || "",
                helius_rpcs: settings?.heliusRpcs || [],
                tensor_api_token: settings?.tensor_api_token || "",
            };
            onCreateTask(cfg);

        } else if (selectedModule === "launch_my_nft") {
            const settings = await window.electronAPI?.getSettings();
            const p = launchMyNftParams;

            // Формируем логику, как именно получить нужное поле wallet или walletSet:
            let walletSource: "manaully" | "set" = "manaully"; // по умолчанию
            let singleWalletPk = "";
            let walletSet: Wallet[] = [];

            if (p.walletApproach === "single") {
                // Если пользователь выбрал одиночный кошелек
                walletSource = "manaully"; // по вашим условиям
                if (p.singleWalletMethod === "existing") {
                    // Ищем приватный ключ у выбранного публичного
                    const found = wallets.find((w) => w.publicKey === p.selectedWalletPublicKey);
                    if (found) {
                        singleWalletPk = found.privateKey;
                    }
                } else {
                    // manual
                    singleWalletPk = p.manualPrivateKey.trim();
                }
            } else {
                // Выбор «set»
                walletSource = "set";
                if (p.chosenSetName && settings?.walletsSet?.[p.chosenSetName]) {
                    walletSet = settings.walletsSet[p.chosenSetName];
                }
            }

            const cfg = {
                module_name: "LaunchMyNft",
                task_name: taskName,

                // Параметры LaunchMyNft
                target_url: p.target_url,
                total_priority_fee: p.total_priority_fee,
                compute_unit_limit: p.compute_unit_limit,
                use_jito: p.useJito,
                jito_tip_account: p.jito_tip_account,
                jito_tip_amount: p.jito_tip_amount,
                jito_region: p.jito_region,
                delay_when_sending: p.delay_when_sending,
                delay_before_sending: p.delay_before_sending,
                nfts_to_buy_per_account: p.nfts_to_buy_per_account,

                // Кошельки
                walletSource, // "manaully" или "set"
                wallet: singleWalletPk, // пусто, если user выбрал set
                walletSet,     // [] если user выбрал single

                main_rpc: settings?.mainRpc || "",
            };
            onCreateTask(cfg);
        }
        handleClose();
    };

    // ------------------------
    // При открытии диалога загружаем одиночные кошельки + имена сетов
    useEffect(() => {
        const fetchData = async () => {
            if (open) {
                try {
                    // 1) Обычные кошельки
                    const w = await window.electronAPI!.getWallets();
                    setWallets(w);

                    // 2) Список сетов (keys)
                    const s = await window.electronAPI!.getSettings();
                    if (s?.walletsSet) {
                        setWalletSets(Object.keys(s.walletsSet));
                    } else {
                        setWalletSets([]);
                    }
                } catch (error) {
                    console.error("Error loading data:", error);
                }
            }
        };
        fetchData();
    }, [open]);

    // ------------------------
    // Рендер шагов
    // ------------------------
    // Шаг 0: выбор модуля
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

    // Шаг 1: конфигурация в зависимости от выбранного модуля
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
                                    <MenuItem value="https://amsterdam.mainnet.block-engine.jito.wtf">🇳🇱 Amsterdam</MenuItem>
                                    <MenuItem value="https://frankfurt.mainnet.block-engine.jito.wtf">🇩🇪 Frankfurt</MenuItem>
                                    <MenuItem value="https://ny.mainnet.block-engine.jito.wtf">🇺🇸 New York</MenuItem>
                                    <MenuItem value="https://tokyo.mainnet.block-engine.jito.wtf">🇯🇵 Tokyo</MenuItem>
                                    <MenuItem value="https://slc.mainnet.block-engine.jito.wtf">🇺🇸 Salt Lake City</MenuItem>
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
                                    <MenuItem value="England">🇬🇧 England</MenuItem>
                                    <MenuItem value="New York">🇺🇸 New York</MenuItem>
                                    <MenuItem value="Los Angeles">🇺🇸 Los Angeles</MenuItem>
                                    <MenuItem value="Frankfurt">🇩🇪 Frankfurt</MenuItem>
                                    <MenuItem value="Amsterdam">🇳🇱 Amsterdam</MenuItem>
                                    <MenuItem value="Tokyo">🇯🇵 Tokyo</MenuItem>
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
        }else if (selectedModule === "tensor_reprice") {
            const params = tensorSdkParams;
            return (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 500 }}>
                    <Typography variant="h6">Tensor Reprice Parameters</Typography>

                    <TextField
                        label="Task Name"
                        value={taskName}
                        onChange={(e) => setTaskName(e.target.value)}
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        label="Collection ID"
                        value={params.collectionId}
                        onChange={(e) =>
                            setTensorSdkParams({ ...params, collectionId: e.target.value })
                        }
                    />

                    {/* Wallet Configuration */}
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

                    {/* Delta */}
                    <TextField
                        label="Delta"
                        type="number"
                        value={params.delta}
                        onChange={(e) =>
                            setTensorSdkParams({
                                ...params,
                                delta: parseFloat(e.target.value) || 0,
                            })
                        }
                    />

                    {/* Limit Config */}
                    <TextField
                        label="Limit Config (file path)"
                        value={params.priceConfig}
                        onChange={(e) =>
                            setTensorSdkParams({ ...params, priceConfig: e.target.value })
                        }
                    />
                </Box>
            );
        }
            // -------------
        // launch_my_nft (НОВЫЙ МОДУЛЬ)
        else if (selectedModule === "launch_my_nft") {
            const p = launchMyNftParams;
            return (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 500 }}>
                    <Typography variant="h6">LaunchMyNft Parameters</Typography>

                    {/* Task Name */}
                    <TextField
                        label="Task Name"
                        value={taskName}
                        onChange={(e) => setTaskName(e.target.value)}
                    />

                    <Divider sx={{ my: 2 }} />

                    <TextField
                        label="Target URL"
                        value={p.target_url}
                        onChange={(e) =>
                            setLaunchMyNftParams({ ...p, target_url: e.target.value })
                        }
                    />

                    <TextField
                        label="Total Priority Fee (lamports)"
                        type="number"
                        value={p.total_priority_fee}
                        onChange={(e) =>
                            setLaunchMyNftParams({
                                ...p,
                                total_priority_fee: parseInt(e.target.value) || 0,
                            })
                        }
                    />

                    <TextField
                        label="Compute Unit Limit"
                        type="number"
                        value={p.compute_unit_limit}
                        onChange={(e) =>
                            setLaunchMyNftParams({
                                ...p,
                                compute_unit_limit: parseInt(e.target.value) || 1400000,
                            })
                        }
                    />

                    {/* useJito */}
                    <Box>
                        <Typography>Use Jito?</Typography>
                        <RadioGroup
                            row
                            value={p.useJito ? "yes" : "no"}
                            onChange={(e) =>
                                setLaunchMyNftParams({
                                    ...p,
                                    useJito: e.target.value === "yes",
                                })
                            }
                        >
                            <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                            <FormControlLabel value="no" control={<Radio />} label="No" />
                        </RadioGroup>
                    </Box>

                    {p.useJito && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            <TextField
                                label="Jito Tip Account"
                                value={p.jito_tip_account}
                                onChange={(e) =>
                                    setLaunchMyNftParams({
                                        ...p,
                                        jito_tip_account: e.target.value,
                                    })
                                }
                            />
                            <TextField
                                label="Jito Tip Amount (lamports)"
                                type="number"
                                value={p.jito_tip_amount}
                                onChange={(e) =>
                                    setLaunchMyNftParams({
                                        ...p,
                                        jito_tip_amount: parseInt(e.target.value) || 1000,
                                    })
                                }
                            />
                            <TextField
                                label="Jito Region"
                                value={p.jito_region}
                                onChange={(e) =>
                                    setLaunchMyNftParams({
                                        ...p,
                                        jito_region: e.target.value,
                                    })
                                }
                            />
                        </Box>
                    )}

                    <TextField
                        label="Delay when sending (ms)"
                        type="number"
                        value={p.delay_when_sending}
                        onChange={(e) =>
                            setLaunchMyNftParams({
                                ...p,
                                delay_when_sending: parseInt(e.target.value) || 0,
                            })
                        }
                    />

                    <TextField
                        label="Delay before sending (ms)"
                        type="number"
                        value={p.delay_before_sending}
                        onChange={(e) =>
                            setLaunchMyNftParams({
                                ...p,
                                delay_before_sending: parseInt(e.target.value) || 0,
                            })
                        }
                    />

                    <TextField
                        label="NFTs to buy per account"
                        type="number"
                        value={p.nfts_to_buy_per_account}
                        onChange={(e) =>
                            setLaunchMyNftParams({
                                ...p,
                                nfts_to_buy_per_account: parseInt(e.target.value) || 1,
                            })
                        }
                    />

                    <Divider sx={{ my: 2 }} />

                    {/* Выбор: Single Wallet / Wallet Set */}
                    <Typography variant="subtitle1">Wallet Choice</Typography>
                    <RadioGroup
                        row
                        value={p.walletApproach}
                        onChange={(e) =>
                            setLaunchMyNftParams({
                                ...p,
                                walletApproach: e.target.value as 'single' | 'set',
                            })
                        }
                    >
                        <FormControlLabel
                            value="single"
                            control={<Radio />}
                            label="Use single wallet"
                        />
                        <FormControlLabel
                            value="set"
                            control={<Radio />}
                            label="Use wallet set"
                        />
                    </RadioGroup>

                    {/* Если single → radio: existing/manual */}
                    {p.walletApproach === "single" && (
                        <>
                            <RadioGroup
                                row
                                value={p.singleWalletMethod}
                                onChange={(e) =>
                                    setLaunchMyNftParams({
                                        ...p,
                                        singleWalletMethod: e.target.value as 'existing' | 'manual',
                                    })
                                }
                            >
                                <FormControlLabel
                                    value="existing"
                                    control={<Radio />}
                                    label="Existing Wallet"
                                />
                                <FormControlLabel
                                    value="manual"
                                    control={<Radio />}
                                    label="Manual Private Key"
                                />
                            </RadioGroup>

                            {p.singleWalletMethod === "existing" ? (
                                <FormControl fullWidth>
                                    <InputLabel>Select Wallet</InputLabel>
                                    <Select
                                        value={p.selectedWalletPublicKey}
                                        label="Select Wallet"
                                        onChange={(e) =>
                                            setLaunchMyNftParams({
                                                ...p,
                                                selectedWalletPublicKey: e.target.value as string,
                                            })
                                        }
                                    >
                                        {wallets.map((w) => (
                                            <MenuItem key={w.publicKey} value={w.publicKey}>
                                                {w.publicKey}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            ) : (
                                <TextField
                                    label="Private Key"
                                    type="password"
                                    value={p.manualPrivateKey}
                                    onChange={(e) =>
                                        setLaunchMyNftParams({
                                            ...p,
                                            manualPrivateKey: e.target.value,
                                        })
                                    }
                                    fullWidth
                                />
                            )}
                        </>
                    )}

                    {/* Если set → выпадающий список с именами сетов */}
                    {p.walletApproach === "set" && (
                        <FormControl fullWidth>
                            <InputLabel>Select Wallet Set</InputLabel>
                            <Select
                                value={p.chosenSetName}
                                label="Select Wallet Set"
                                onChange={(e) =>
                                    setLaunchMyNftParams({
                                        ...p,
                                        chosenSetName: e.target.value as string,
                                    })
                                }
                            >
                                {walletSets.map((setName) => (
                                    <MenuItem key={setName} value={setName}>
                                        {setName}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                </Box>
            );
        }

        // -------------
        // Иначе заглушка
        return (
            <Typography color="error">
                This module is not yet supported.
            </Typography>
        );
    };

    // Шаг 2: Review выбранных параметров
    const renderStepReview = () => {
        if (selectedModule === "tensor_sdk") {
            // Упрощённая заглушка
            return <Typography>Review Tensor SDK (не меняем)</Typography>;
        } else if (selectedModule === "tensor_reprice") {
            return <Typography>Review Tensor Reprice (не меняем)</Typography>;
        } else if (selectedModule === "launch_my_nft") {
            const p = launchMyNftParams;
            return (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 500 }}>
                    <Typography variant="h6">Review LaunchMyNft Params</Typography>
                    <Typography><b>Task Name:</b> {taskName}</Typography>
                    <Typography><b>Module:</b> LaunchMyNft</Typography>
                    <Typography><b>Target URL:</b> {p.target_url}</Typography>
                    <Typography><b>Priority Fee:</b> {p.total_priority_fee}</Typography>
                    <Typography><b>Compute Unit Limit:</b> {p.compute_unit_limit}</Typography>
                    <Typography><b>useJito:</b> {p.useJito ? 'Yes' : 'No'}</Typography>
                    {p.useJito && (
                        <>
                            <Typography><b>jito_tip_account:</b> {p.jito_tip_account}</Typography>
                            <Typography><b>jito_tip_amount:</b> {p.jito_tip_amount}</Typography>
                            <Typography><b>jito_region:</b> {p.jito_region}</Typography>
                        </>
                    )}
                    <Typography><b>delay_when_sending:</b> {p.delay_when_sending}</Typography>
                    <Typography><b>delay_before_sending:</b> {p.delay_before_sending}</Typography>
                    <Typography><b>nfts_to_buy_per_account:</b> {p.nfts_to_buy_per_account}</Typography>

                    <Divider sx={{ my: 2 }} />

                    <Typography><b>Wallet Approach:</b> {p.walletApproach === 'single' ? 'Single wallet' : 'Wallet set'}</Typography>
                    {p.walletApproach === 'single' ? (
                        <>
                            <Typography><b>Method:</b> {p.singleWalletMethod}</Typography>
                            {p.singleWalletMethod === 'existing' ? (
                                <Typography>
                                    <b>Selected Wallet:</b> {p.selectedWalletPublicKey}
                                </Typography>
                            ) : (
                                <Typography>
                                    <b>Manual Private Key:</b> **** (hidden)
                                </Typography>
                            )}
                        </>
                    ) : (
                        <Typography><b>Chosen Set:</b> {p.chosenSetName}</Typography>
                    )}
                </Box>
            );
        }
        return null;
    };

    // ------------------------
    // Основной рендер
    // ------------------------
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
