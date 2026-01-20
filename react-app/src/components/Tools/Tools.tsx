import React, { useState, useEffect } from "react";
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
    FormHelperText,
} from "@mui/material";
import {
    Transaction,
    SystemProgram,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import bs58 from "bs58";
import { sendTransactionWithRetries } from "../../utils/transactionService";
import { Buffer } from "buffer";
import WithdrawBalances from "../WithdrawBalances";
import { 
    validatePublicKey, 
    validatePrivateKey, 
    validateSolAmount 
} from "../../utils/validators";
import { useFormValidation } from "../../hooks/useFormValidation";

window.Buffer = Buffer;

export default function Tools() {
    // Загрузка данных
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

    // Состояния формы
    const [fromMethod, setFromMethod] = useState<"existing" | "manual">("existing");
    const [fromSelectedPrivateKey, setFromSelectedPrivateKey] = useState("");
    const [fromManualPrivateKey, setFromManualPrivateKey] = useState("");

    const [toMethod, setToMethod] = useState<"existing" | "manual" | "set">("existing");
    const [toSelectedPubKey, setToSelectedPubKey] = useState("");
    const [toManualPubKey, setToManualPubKey] = useState("");
    const [toSelectedSetName, setToSelectedSetName] = useState("");

    const [amount, setAmount] = useState<string>("");

    const [isLoading, setIsLoading] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState("");
    const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">("success");

    // Валидация
    const validation = useFormValidation({
        fromManualPrivateKey: {
            value: fromManualPrivateKey,
            validator: validatePrivateKey,
        },
        toManualPubKey: {
            value: toManualPubKey,
            validator: validatePublicKey,
        },
        amount: {
            value: amount,
            validator: validateSolAmount,
        },
    });

    // Обработчики
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        // Разрешаем только числа и точку
        if (newValue === "" || /^\d*\.?\d*$/.test(newValue)) {
            setAmount(newValue);
        }
    };

    const handleSendTransaction = async () => {
        // Валидация перед отправкой
        const formValues = {
            fromManualPrivateKey: fromMethod === "manual" ? fromManualPrivateKey : "",
            toManualPubKey: toMethod === "manual" ? toManualPubKey : "",
            amount,
        };

        // Валидация amount всегда
        if (!validateSolAmount(amount).isValid) {
            validation.setFieldError('amount', validateSolAmount(amount).error || null);
            setSnackbarMessage("Please enter a valid amount");
            setSnackbarSeverity("error");
            setSnackbarOpen(true);
            return;
        }

        // Валидация manual полей если выбраны
        if (fromMethod === "manual") {
            if (!validatePrivateKey(fromManualPrivateKey).isValid) {
                validation.setFieldError('fromManualPrivateKey', validatePrivateKey(fromManualPrivateKey).error || null);
                setSnackbarMessage("Invalid private key");
                setSnackbarSeverity("error");
                setSnackbarOpen(true);
                return;
            }
        }

        if (toMethod === "manual") {
            if (!validatePublicKey(toManualPubKey).isValid) {
                validation.setFieldError('toManualPubKey', validatePublicKey(toManualPubKey).error || null);
                setSnackbarMessage("Invalid recipient address");
                setSnackbarSeverity("error");
                setSnackbarOpen(true);
                return;
            }
        }

        // Дополнительная проверка что все поля заполнены
        if (fromMethod === "existing" && !fromSelectedPrivateKey) {
            setSnackbarMessage("Please select a wallet to send from");
            setSnackbarSeverity("error");
            setSnackbarOpen(true);
            return;
        }

        if (toMethod === "existing" && !toSelectedPubKey) {
            setSnackbarMessage("Please select a recipient wallet");
            setSnackbarSeverity("error");
            setSnackbarOpen(true);
            return;
        }

        if (toMethod === "set" && !toSelectedSetName) {
            setSnackbarMessage("Please select a wallet set");
            setSnackbarSeverity("error");
            setSnackbarOpen(true);
            return;
        }

        // Все проверки прошли, отправляем транзакцию
        setIsLoading(true);

        try {
            const fromPrivKey = fromMethod === "existing" 
                ? fromSelectedPrivateKey 
                : fromManualPrivateKey;

            let recipients: string[] = [];

            if (toMethod === "existing") {
                recipients = [toSelectedPubKey];
            } else if (toMethod === "manual") {
                recipients = [toManualPubKey];
            } else if (toMethod === "set") {
                const settings = await window.electronAPI?.getSettings();
                const selectedSet = settings?.walletsSet?.[toSelectedSetName];
                if (selectedSet && Array.isArray(selectedSet)) {
                    recipients = selectedSet.map((w: any) => w.publicKey);
                }
            }

            if (recipients.length === 0) {
                throw new Error("No recipients found");
            }

            const amountInSol = parseFloat(amount);
            const result = await window.electronAPI?.sendSol({
                fromPrivateKey: fromPrivKey,
                recipients,
                amountPerWallet: amountInSol,
                rpcUrl,
            });

            if (result?.success) {
                setSnackbarMessage(`Successfully sent ${amountInSol} SOL to ${recipients.length} wallet(s)`);
                setSnackbarSeverity("success");
                // Очищаем форму
                setAmount("");
                validation.clearErrors();
            } else {
                setSnackbarMessage("Error: " + (result?.error || "Failed to send transaction"));
                setSnackbarSeverity("error");
            }
        } catch (error) {
            console.error("Error sending transaction:", error);
            setSnackbarMessage("Error while sending transaction");
            setSnackbarSeverity("error");
        } finally {
            setIsLoading(false);
            setSnackbarOpen(true);
        }
    };

    // Получаем состояния валидации
    const fromPrivKeyState = validation.getFieldState('fromManualPrivateKey');
    const toPubKeyState = validation.getFieldState('toManualPubKey');
    const amountState = validation.getFieldState('amount');

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Tools
            </Typography>

            <Box
                p={2}
                sx={{
                    border: "1px solid #ccc",
                    borderRadius: "7px",
                    padding: 3,
                    marginTop: 2,
                }}
            >
                <Typography variant="h5" sx={{ fontWeight: "bold" }} gutterBottom>
                    Sol distribution
                </Typography>

                {/* From Section */}
                <Typography variant="h6" sx={{ mt: 2 }}>
                    From
                </Typography>
                <FormControl component="fieldset">
                    <RadioGroup
                        row
                        value={fromMethod}
                        onChange={(e) => setFromMethod(e.target.value as "existing" | "manual")}
                    >
                        <FormControlLabel value="existing" control={<Radio />} label="Existing wallet" />
                        <FormControlLabel value="manual" control={<Radio />} label="Manual private key" />
                    </RadioGroup>
                </FormControl>

                {fromMethod === "existing" && (
                    <Box mt={2}>
                        <FormControl fullWidth>
                            <InputLabel>Choose wallet (From)</InputLabel>
                            <Select
                                value={fromSelectedPrivateKey}
                                onChange={(e) => setFromSelectedPrivateKey(e.target.value)}
                                disabled={wallets.length === 0}
                            >
                                {wallets.length > 0 ? (
                                    wallets.map((wallet) => (
                                        <MenuItem key={wallet.publicKey} value={wallet.privateKey}>
                                            {wallet.publicKey}
                                        </MenuItem>
                                    ))
                                ) : (
                                    <MenuItem disabled>No wallets available</MenuItem>
                                )}
                            </Select>
                        </FormControl>
                    </Box>
                )}

                {fromMethod === "manual" && (
                    <Box mt={2}>
                        <TextField
                            fullWidth
                            label="From: private key"
                            value={fromManualPrivateKey}
                            onChange={(e) => setFromManualPrivateKey(e.target.value)}
                            onBlur={() => validation.handleBlur('fromManualPrivateKey', fromManualPrivateKey)}
                            error={fromPrivKeyState.touched && !!fromPrivKeyState.error}
                            helperText={fromPrivKeyState.touched ? fromPrivKeyState.error : ''}
                        />
                    </Box>
                )}

                {/* To Section */}
                <Typography variant="h6" sx={{ mt: 4 }}>
                    To
                </Typography>
                <FormControl component="fieldset">
                    <RadioGroup
                        row
                        value={toMethod}
                        onChange={(e) => setToMethod(e.target.value as "existing" | "manual" | "set")}
                    >
                        <FormControlLabel value="existing" control={<Radio />} label="Existing wallet" />
                        <FormControlLabel value="manual" control={<Radio />} label="Manual public key" />
                        <FormControlLabel value="set" control={<Radio />} label="Wallet set" />
                    </RadioGroup>
                </FormControl>

                {toMethod === "existing" && (
                    <Box mt={2}>
                        <FormControl fullWidth>
                            <InputLabel>Choose wallet (To)</InputLabel>
                            <Select
                                value={toSelectedPubKey}
                                onChange={(e) => setToSelectedPubKey(e.target.value)}
                                disabled={wallets.length === 0}
                            >
                                {wallets.length > 0 ? (
                                    wallets.map((wallet) => (
                                        <MenuItem key={wallet.publicKey} value={wallet.publicKey}>
                                            {wallet.publicKey}
                                        </MenuItem>
                                    ))
                                ) : (
                                    <MenuItem disabled>No wallets available</MenuItem>
                                )}
                            </Select>
                        </FormControl>
                    </Box>
                )}

                {toMethod === "manual" && (
                    <Box mt={2}>
                        <TextField
                            fullWidth
                            label="To: public key"
                            value={toManualPubKey}
                            onChange={(e) => setToManualPubKey(e.target.value)}
                            onBlur={() => validation.handleBlur('toManualPubKey', toManualPubKey)}
                            error={toPubKeyState.touched && !!toPubKeyState.error}
                            helperText={toPubKeyState.touched ? toPubKeyState.error : ''}
                        />
                    </Box>
                )}

                {toMethod === "set" && (
                    <Box mt={2}>
                        <FormControl fullWidth>
                            <InputLabel>Choose wallet set</InputLabel>
                            <Select
                                value={toSelectedSetName}
                                onChange={(e) => setToSelectedSetName(e.target.value)}
                                disabled={walletSets.length === 0}
                            >
                                {walletSets.length > 0 ? (
                                    walletSets.map((setName) => (
                                        <MenuItem key={setName} value={setName}>
                                            {setName}
                                        </MenuItem>
                                    ))
                                ) : (
                                    <MenuItem disabled>No wallet sets available</MenuItem>
                                )}
                            </Select>
                        </FormControl>
                    </Box>
                )}

                {/* Amount */}
                <Box mt={4}>
                    <TextField
                        fullWidth
                        label="Amount (SOL)"
                        value={amount}
                        onChange={handleAmountChange}
                        onBlur={() => validation.handleBlur('amount', amount)}
                        error={amountState.touched && !!amountState.error}
                        helperText={amountState.touched ? amountState.error : 'Amount per wallet in SOL'}
                        type="text"
                        inputProps={{ inputMode: 'decimal' }}
                    />
                </Box>

                {/* Send Button */}
                <Box mt={4}>
                    <Button
                        variant="contained"
                        color="primary"
                        fullWidth
                        onClick={handleSendTransaction}
                        disabled={isLoading}
                    >
                        {isLoading ? <CircularProgress size={24} /> : "Send Transaction"}
                    </Button>
                </Box>
            </Box>

            {/* WithdrawBalances компонент */}
            <WithdrawBalances 
    wallets={wallets}
    walletSets={walletSets}
    rpcUrl={rpcUrl}
    onStatusUpdate={(message, severity) => {
        setSnackbarMessage(message);
        setSnackbarSeverity(severity);
        setSnackbarOpen(true);
    }}
    onLoading={setIsLoading}
/>

            {/* Snackbar для уведомлений */}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={() => setSnackbarOpen(false)}
            >
                <Alert
                    onClose={() => setSnackbarOpen(false)}
                    severity={snackbarSeverity}
                    sx={{ width: "100%" }}
                >
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
}