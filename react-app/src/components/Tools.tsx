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
    InputLabel
} from "@mui/material";

interface Wallet {
    publicKey: string;
    privateKey: string;
}

export default function Tools() {
    // ---------------------------
    // 1) Список одиночных кошельков + список сетов
    // ---------------------------
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [walletSets, setWalletSets] = useState<string[]>([]);

    // Загружаем кошельки и сет при монтировании
    useEffect(() => {
        const loadData = async () => {
            try {
                // Одиночные кошельки
                const w = await window.electronAPI?.getWallets();
                setWallets(w || []);

                // Сеты
                const settings = await window.electronAPI?.getSettings();
                if (settings?.walletsSet) {
                    // Получаем список имён ключей-сетов
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
    // radio: existing | manual
    const [fromMethod, setFromMethod] = useState<"existing" | "manual">("existing");

    // Если existing → храним выбранный publicKey (или храним кошелёк целиком)
    const [fromSelectedPubKey, setFromSelectedPubKey] = useState("");

    // Если manual → храним приватный ключ
    const [fromManualPrivateKey, setFromManualPrivateKey] = useState("");

    // ---------------------------
    // 3) Состояния для «куда» (To)
    // ---------------------------
    // radio: existing | manual | set
    const [toMethod, setToMethod] = useState<"existing" | "manual" | "set">("existing");

    // Если existing → выбранный publicKey из списка
    const [toSelectedPubKey, setToSelectedPubKey] = useState("");

    // Если manual → (в зависимости от вашей логики) будем вводить либо
    // приватный ключ, либо публичный ключ. Предположим, что сюда вводим "публичный ключ" получателя.
    const [toManualPubKey, setToManualPubKey] = useState("");

    // Если set → выбираем название сета
    const [toSelectedSetName, setToSelectedSetName] = useState("");

    // ---------------------------
    // 4) Обработчик отправки (заглушка)
    // ---------------------------
    const handleSend = () => {
        // Здесь вы можете вставить реальную логику отправки SOL.
        // Ниже просто выводим данные, которые пользователь выбрал
        console.log("=== SEND ACTION ===");

        // From
        if (fromMethod === "existing") {
            console.log("From existing wallet:", fromSelectedPubKey);
            // при необходимости вы найдёте приватный ключ из массива wallets
            // const found = wallets.find((w) => w.publicKey === fromSelectedPubKey);
            // console.log("Private key:", found?.privateKey);
        } else {
            console.log("From manual private key:", fromManualPrivateKey);
        }

        // To
        if (toMethod === "existing") {
            console.log("To existing wallet:", toSelectedPubKey);
        } else if (toMethod === "manual") {
            console.log("To manual public key:", toManualPubKey);
        } else if (toMethod === "set") {
            console.log("To wallet set:", toSelectedSetName);
            // при необходимости вы найдёте массив кошельков в settings.walletsSet[toSelectedSetName]
        }

        alert("Send action triggered! (Смотрите данные в console.log)");
    };

    // ---------------------------
    // RENDER
    // ---------------------------
    return (
        <Box p={2}>
            <Typography variant="h4" gutterBottom>
                Tools
            </Typography>

            {/* Выбор "откуда" отправляем SOL */}
            <Typography variant="h6" sx={{ mt: 2 }}>
                Откуда (From)
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
                    <InputLabel>Выберите кошелёк (From)</InputLabel>
                    <Select
                        fullWidth
                        value={fromSelectedPubKey}
                        onChange={(e) => setFromSelectedPubKey(e.target.value)}
                    >
                        {wallets.map((wallet) => (
                            <MenuItem key={wallet.publicKey} value={wallet.publicKey}>
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

            {/* Выбор "куда" отправляем SOL */}
            <Typography variant="h6" sx={{ mt: 4 }}>
                Куда (To)
            </Typography>
            <FormControl component="fieldset">
                <RadioGroup
                    row
                    value={toMethod}
                    onChange={(e) =>
                        setToMethod(e.target.value as "existing" | "manual" | "set")
                    }
                >
                    <FormControlLabel value="existing" control={<Radio />} label="Existing wallet" />
                    <FormControlLabel value="manual" control={<Radio />} label="Manual public key" />
                    <FormControlLabel value="set" control={<Radio />} label="Wallet set" />
                </RadioGroup>
            </FormControl>

            {toMethod === "existing" && (
                <Box mt={2}>
                    <InputLabel>Выберите кошелёк (To)</InputLabel>
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

            {/* Кнопка SEND */}
            <Box mt={4}>
                <Button variant="contained" color="primary" onClick={handleSend}>
                    Send
                </Button>
            </Box>
        </Box>
    );
}
