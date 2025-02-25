import React, {useState, useEffect} from "react";
import {
    Box,
    Typography,
    Radio,
    RadioGroup,
    FormControlLabel,
    FormControl,
    Button,
    TextField,
    Select,
    MenuItem,
    InputLabel,
    Snackbar,
    Alert,
    CircularProgress,
    SnackbarCloseReason,
} from "@mui/material";
import {
    Transaction,
    SystemProgram,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import bs58 from "bs58";
import {sendTransactionWithRetries} from "../utils/transactionService";
import {Buffer} from "buffer";
import WithdrawBalances from "./WithdrawBalances";

window.Buffer = Buffer;

export default function Tools() {
    // ---------------------------
    // 1) Список кошельков и сетов
    // ---------------------------
    const [wallets, setWallets] = useState<any[]>([]);
    const [walletSets, setWalletSets] = useState<string[]>([]);
    const [rpcUrl, setRpcUrl] = useState("");

    useEffect(() => {
        const loadData = async () => {
            try {
                const w = await window.electronAPI?.getWallets();
                setWallets(w || []);

                const settings = await window.electronAPI?.getSettings();
                if (settings?.walletsSet) {
                    setRpcUrl(settings?.mainRpc!);
                    const setNames = Object.keys(settings.walletsSet);
                    setWalletSets(setNames);
                }
            } catch (error) {
                console.error("Ошибка при загрузке данных:", error);
            }
        };
        loadData();
    }, []);

    // ---------------------------
    // 2) Состояния для «откуда» (From)
    // ---------------------------
    const [fromMethod, setFromMethod] = useState<"existing" | "manual">("existing");
    const [fromSelectedPrivateKey, setFromSelectedPrivateKey] = useState("");
    const [fromManualPrivateKey, setFromManualPrivateKey] = useState("");

    // ---------------------------
    // 3) Состояния для «куда» (To)
    // ---------------------------
    const [toMethod, setToMethod] = useState<"existing" | "manual" | "set">("existing");
    const [toSelectedPubKey, setToSelectedPubKey] = useState("");
    const [toManualPubKey, setToManualPubKey] = useState("");
    const [toSelectedSetName, setToSelectedSetName] = useState("");

    // ---------------------------
    // 4) Поле для ввода суммы (amount)
    // ---------------------------
    const [amount, setAmount] = useState<string>("");
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        if (newValue === "" || /^\d*\.?\d*$/.test(newValue)) {
            setAmount(newValue);
        }
    };

    // ---------------------------
    // 5) Snackbar и загрузка
    // ---------------------------
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState("");
    const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error" | "info">("success");
    const [isLoading, setIsLoading] = useState(false);

    const handleCloseSnackbar = (_event: any, reason?: SnackbarCloseReason) => {
        if (reason === "clickaway") return;
        setSnackbarOpen(false);
    };

    // ---------------------------
    // 6) Обработчик отправки транзакции
    // ---------------------------

    const handleStatusUpdate = (message: string, severity: "success" | "error" | "info") => {
        setSnackbarMessage(message);
        setSnackbarSeverity(severity);
        setSnackbarOpen(true);
    };

    const handleLoading = (loading: boolean) => {
        setIsLoading(loading);
    };

    const handleSend = async () => {
        console.log("=== SEND ACTION ===");

        let sender: Keypair;
        if (fromMethod === "existing") {
            console.log("From existing wallet (private key):", fromSelectedPrivateKey);
            sender = Keypair.fromSecretKey(new Uint8Array(bs58.decode(fromSelectedPrivateKey)));
        } else {
            console.log("From manual private key:", fromManualPrivateKey);
            sender = Keypair.fromSecretKey(new Uint8Array(bs58.decode(fromManualPrivateKey)));
        }

        let receivers: PublicKey[] = [];
        const settings = await window.electronAPI?.getSettings();
        if (toMethod === "existing") {
            console.log("To existing wallet (public key):", toSelectedPubKey);
            receivers.push(new PublicKey(toSelectedPubKey));
        } else if (toMethod === "manual") {
            console.log("To manual public key:", toManualPubKey);
            receivers.push(new PublicKey(toManualPubKey));
        } else if (toMethod === "set") {
            console.log("To wallet set:", toSelectedSetName);
            if (settings?.walletsSet && settings.walletsSet[toSelectedSetName]) {
                const walletList = settings.walletsSet[toSelectedSetName];
                walletList.forEach((wallet: any) => {
                    receivers.push(new PublicKey(wallet.publicKey));
                    console.log("Public key:", wallet.publicKey);
                });
            } else {
                console.warn(`Set с названием "${toSelectedSetName}" не найден.`);
            }
        }

        const transaction = new Transaction();
        let instructions = [];
        for (const receiver of receivers) {
            let ix = SystemProgram.transfer({
                fromPubkey: sender.publicKey,
                toPubkey: receiver,
                lamports: Number(amount) * LAMPORTS_PER_SOL,
            });
            instructions.push(ix);
        }

        transaction.add(...instructions);

        const cuLimit = receivers.length * 600;
        if (!settings || !settings.mainRpc) {
            setSnackbarMessage("RPC not configured!");
            setSnackbarSeverity("error");
            setSnackbarOpen(true);
            return;
        }

        try {
            // Показываем индикатор загрузки
            setIsLoading(true);
            setSnackbarMessage("Sending transaction...");
            setSnackbarSeverity("info");
            setSnackbarOpen(true);

            const result = await sendTransactionWithRetries(
                transaction,
                sender,
                settings.mainRpc,
                5,
                30000,
                cuLimit
            );
            if (result.success) {
                setSnackbarMessage("Transaction confirmed!");
                setSnackbarSeverity("success");
            } else {
                setSnackbarMessage("Error sending transaction: " + (result.error || "Не удалось отправить транзакцию."));
                setSnackbarSeverity("error");
            }
            // console.log(amount)

        } catch (error) {
            console.error("Error sending transaction:", error);
            setSnackbarMessage("Error while sending tx.");
            setSnackbarSeverity("error");
        } finally {
            setIsLoading(false);
            setSnackbarOpen(true);
        }
    };

    // ---------------------------
    // RENDER
    // ---------------------------
    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Tools
            </Typography>



            <Box p={2} sx={{
                border: "1px solid #ccc", // Стиль границы
                borderRadius: "7px",      // Закругление углов
                padding: 3,               // Отступ внутри контейнера
                marginTop: 2              // Внешний отступ сверху
            }}>
                <Typography variant="h5" sx={{fontWeight: "bold"}} gutterBottom>
                    Sol distribution
                </Typography>
                {/* Откуда (From) */}
                <Typography variant="h6" sx={{mt: 2}}>
                    (From)
                </Typography>
                <FormControl component="fieldset">
                    <RadioGroup
                        row
                        value={fromMethod}
                        onChange={(e) => setFromMethod(e.target.value as "existing" | "manual")}
                    >
                        <FormControlLabel value="existing" control={<Radio/>} label="Existing wallet"/>
                        <FormControlLabel value="manual" control={<Radio/>} label="Manual private key"/>
                    </RadioGroup>
                </FormControl>
                {fromMethod === "existing" && (
                    <Box mt={2}>
                        <InputLabel>Choose wallet (From)</InputLabel>
                        <Select
                            fullWidth
                            value={fromSelectedPrivateKey}
                            onChange={(e) => setFromSelectedPrivateKey(e.target.value)}
                        >
                            {wallets.map((wallet) => (
                                <MenuItem key={wallet.publicKey} value={wallet.privateKey}>
                                    {wallet.publicKey}
                                </MenuItem>
                            ))}
                        </Select>
                    </Box>
                )}
                {fromMethod === "manual" && (
                    <Box mt={2}>
                        <TextField
                            fullWidth
                            label="From: private key"
                            value={fromManualPrivateKey}
                            onChange={(e) => setFromManualPrivateKey(e.target.value)}
                        />
                    </Box>
                )}

                {/* Куда (To) */}
                <Typography variant="h6" sx={{mt: 4, fontWeight: "bold"}}>
                    (To)
                </Typography>
                <FormControl component="fieldset">
                    <RadioGroup
                        row
                        value={toMethod}
                        onChange={(e) => setToMethod(e.target.value as "existing" | "manual" | "set")}
                    >
                        <FormControlLabel value="existing" control={<Radio/>} label="Existing wallet"/>
                        <FormControlLabel value="manual" control={<Radio/>} label="Manual public key"/>
                        <FormControlLabel value="set" control={<Radio/>} label="Wallet set"/>
                    </RadioGroup>
                </FormControl>
                {toMethod === "existing" && (
                    <Box mt={2}>
                        <InputLabel>Choose wallet (To)</InputLabel>
                        <Select
                            fullWidth
                            value={toSelectedPubKey}
                            onChange={(e) => setToSelectedPubKey(e.target.value)}
                        >
                            {wallets.map((wallet) => (
                                <MenuItem key={wallet.publicKey} value={wallet.publicKey}>
                                    {wallet.publicKey}
                                </MenuItem>
                            ))}
                        </Select>
                    </Box>
                )}
                {toMethod === "manual" && (
                    <Box mt={2}>
                        <TextField
                            fullWidth
                            label="To: public key"
                            value={toManualPubKey}
                            onChange={(e) => setToManualPubKey(e.target.value)}
                        />
                    </Box>
                )}
                {toMethod === "set" && (
                    <Box mt={2}>
                        <InputLabel>Выберите Set</InputLabel>
                        <Select
                            fullWidth
                            value={toSelectedSetName}
                            onChange={(e) => setToSelectedSetName(e.target.value)}
                        >
                            {walletSets.map((name) => (
                                <MenuItem key={name} value={name}>
                                    {name}
                                </MenuItem>
                            ))}
                        </Select>
                    </Box>
                )}

                {/* Поле ввода суммы */}
                <Box mt={2}>
                    <TextField
                        fullWidth
                        label="Amount"
                        type="number"
                        value={amount}
                        onChange={handleAmountChange}
                        inputProps={{min: 0}}
                    />
                </Box>

                {/* Кнопка SEND */}
                <Box mt={4}>
                    <Button variant="contained" color="primary" onClick={handleSend}>
                        Send
                    </Button>
                </Box>


                {/* Snackbar уведомление */}
                <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                    <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{width: "100%"}}>
                        {isLoading ? (
                            <Box display="flex" alignItems="center" gap={1}>
                                <CircularProgress size={20}/>
                                <Typography>Отправка транзакции...</Typography>
                            </Box>
                        ) : (
                            snackbarMessage
                        )}
                    </Alert>
                </Snackbar>
            </Box>
            <WithdrawBalances
                wallets={wallets}
                walletSets={walletSets}
                rpcUrl={rpcUrl}
                onStatusUpdate={handleStatusUpdate}
                onLoading={handleLoading}
            />
        </Box>
    );
}
