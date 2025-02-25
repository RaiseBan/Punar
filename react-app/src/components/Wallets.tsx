import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    TextField,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Collapse
} from '@mui/material';
import { Visibility, VisibilityOff, Delete, Add } from '@mui/icons-material';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { styled } from '@mui/system';
import {AppSettings} from "../global";

// ----------------------------------------------------------------------------
// СТИЛИЗАЦИЯ (пример из вашего старого кода)
const StyledButton = styled(Button)({
    backgroundColor: '#FF5722',
    color: '#fff',
    padding: '10px 20px',
    '&:hover': {
        backgroundColor: '#E64A19',
        transform: 'scale(1.05)',
    },
    '&:active': {
        animation: 'scaleUp 0.3s ease-in-out',
    },
    '@keyframes scaleUp': {
        '0%': { transform: 'scale(1)' },
        '100%': { transform: 'scale(1.1)' },
    },
});

// ----------------------------------------------------------------------------
// ТИПЫ (при желании можно вынести в отдельный файл)
interface Wallet {
    publicKey: string;
    privateKey: string;
}



// ----------------------------------------------------------------------------
export default function Wallets() {
    // ========================================================================
    // СТАРЫЙ КОД (одиночные кошельки):
    // Использует window.electronAPI!.getWallets, addWallet, deleteWallet
    // ========================================================================

    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [showPrivateKey, setShowPrivateKey] = useState<number | null>(null);

    // Диалог для импорта одиночного кошелька
    const [openImportDialog, setOpenImportDialog] = useState(false);
    const [newPublicKey, setNewPublicKey] = useState('');
    const [newPrivateKey, setNewPrivateKey] = useState('');

    useEffect(() => {
        // Загружаем одиночные кошельки
        window.electronAPI!
            .getWallets()
            .then((response: any) => {
                if (response.message) {
                    console.log(response.message);
                } else {
                    setWallets(response);
                }
            })
            .catch((error: any) => console.error('Ошибка при загрузке кошельков', error));
    }, []);

    // Генерация одиночного кошелька
    const handleCreateWallet = () => {
        const newKeypair = Keypair.generate();
        const newWallet = {
            publicKey: newKeypair.publicKey.toString(),
            privateKey: bs58.encode(newKeypair.secretKey),
        };

        // Добавляем на диск и в стейт
        window.electronAPI!
            .addWallet(newWallet)
            .then(() => {
                setWallets((prev) => [newWallet, ...prev]); // Добавляем в начало списка
            })
            .catch((error: any) => console.error('Ошибка при создании кошелька', error));
    };

    // Открыть диалог для импорта одиночного кошелька
    const handleOpenDialog = () => {
        setOpenImportDialog(true);
    };

    // Закрыть диалог
    const handleCloseDialog = () => {
        setOpenImportDialog(false);
        setNewPublicKey('');
        setNewPrivateKey('');
    };

    // Импорт одиночного кошелька
    const handleSaveWallet = () => {
        const newWallet = {
            publicKey: newPublicKey.trim(),
            privateKey: newPrivateKey.trim(),
        };
        if (!newWallet.publicKey || !newWallet.privateKey) {
            return; // Можно добавить какие-то проверки
        }

        // Сохраняем на диск и в стейт
        window.electronAPI!
            .addWallet(newWallet)
            .then(() => {
                setWallets((prev) => [newWallet, ...prev]);
                handleCloseDialog();
            })
            .catch((error: any) => console.error('Ошибка при добавлении кошелька', error));
    };

    // Удаление одиночного кошелька
    const handleDeleteWallet = (publicKey: string) => {
        window.electronAPI!
            .deleteWallet(publicKey)
            .then(() => {
                setWallets((prev) => prev.filter((wallet) => wallet.publicKey !== publicKey));
            })
            .catch((error: any) => console.error('Ошибка при удалении кошелька', error));
    };

    // Показ/скрытие приватного ключа (одиночные)
    const toggleShowPrivateKey = (index: number) => {
        setShowPrivateKey((prev) => (prev === index ? null : index));
    };

    // ========================================================================
    // НОВАЯ ЧАСТЬ: WalletsSet (LMNFT), храним через settings (getSettings/saveSettings)
    // ========================================================================

    const [walletsSet, setWalletsSet] = useState<{ [setName: string]: Wallet[] }>({});
    const [expandedSets, setExpandedSets] = useState<{ [setName: string]: boolean }>({});

    // -- Диалоги для сетов --
    // 1) Создать Set вручную
    const [openCreateSetDialog, setOpenCreateSetDialog] = useState(false);
    const [newSetName, setNewSetName] = useState('');

    // 2) Авто-генерация Set
    const [openGenerateSetDialog, setOpenGenerateSetDialog] = useState(false);
    const [generateSetName, setGenerateSetName] = useState('');
    const [generateSetCount, setGenerateSetCount] = useState(1);

    // 3) Импорт кошелька в конкретный Set
    const [openImportSetDialog, setOpenImportSetDialog] = useState(false);
    const [activeSetName, setActiveSetName] = useState('');
    const [importPubKey, setImportPubKey] = useState('');
    const [importPrivKey, setImportPrivKey] = useState('');

    // Показ приватного ключа в конкретном сете
    const [showSetPrivateKey, setShowSetPrivateKey] = useState<{
        [setName: string]: number | null;
    }>({});

    // Загружаем walletsSet из настроек (settings)
    useEffect(() => {
        (async () => {
            const loadedSettings = await window.electronAPI?.getSettings();
            if (loadedSettings?.walletsSet) {
                setWalletsSet(loadedSettings.walletsSet);
            }
        })();
    }, []);

    // Сохраняем только walletsSet, не затирая другие поля настроек
    const saveWalletsSetToSettings = async (updatedSets: { [setName: string]: Wallet[] }) => {
        const currentSettings = await window.electronAPI?.getSettings();
        const newSettings: AppSettings = {
            ...currentSettings,
            walletsSet: updatedSets,
        };
        await window.electronAPI?.saveSettings(newSettings);
    };

    // Развернуть/свернуть конкретный сет
    const toggleExpandSet = (setName: string) => {
        setExpandedSets((prev) => ({
            ...prev,
            [setName]: !prev[setName],
        }));
    };

    // -----------------------------
    // 1) Создать ПУСТОЙ сет (manually)
    // -----------------------------
    const handleCreateSet = async () => {
        const name = newSetName.trim();
        if (!name) return;

        if (walletsSet[name]) {
            alert('Set с таким названием уже существует!');
            return;
        }
        const updatedSets = { ...walletsSet, [name]: [] };
        setWalletsSet(updatedSets);

        // Сохраняем в общий файл настроек
        await saveWalletsSetToSettings(updatedSets);

        setOpenCreateSetDialog(false);
        setNewSetName('');
    };

    // -----------------------------
    // 2) Авто-генерация сета
    // -----------------------------
    const handleGenerateSet = async () => {
        const name = generateSetName.trim();
        if (!name) return;

        if (walletsSet[name]) {
            alert('Set с таким названием уже существует!');
            return;
        }

        const generated: Wallet[] = [];
        for (let i = 0; i < generateSetCount; i++) {
            const kp = Keypair.generate();
            generated.push({
                publicKey: kp.publicKey.toString(),
                privateKey: bs58.encode(kp.secretKey),
            });
        }

        const updatedSets = { ...walletsSet, [name]: generated };
        setWalletsSet(updatedSets);
        await saveWalletsSetToSettings(updatedSets);

        setOpenGenerateSetDialog(false);
        setGenerateSetName('');
        setGenerateSetCount(1);
    };

    // -----------------------------
    // Удалить целиком сет
    // -----------------------------
    const handleDeleteSet = async (setName: string) => {
        const updatedSets = { ...walletsSet };
        delete updatedSets[setName];
        setWalletsSet(updatedSets);
        await saveWalletsSetToSettings(updatedSets);
    };

    // -----------------------------
    // Добавить (generate) один кошелёк в сет
    // -----------------------------
    const handleGenerateWalletInSet = async (setName: string) => {
        const kp = Keypair.generate();
        const newWallet: Wallet = {
            publicKey: kp.publicKey.toString(),
            privateKey: bs58.encode(kp.secretKey),
        };

        const updatedSet = [newWallet, ...(walletsSet[setName] || [])];
        const updatedSets = { ...walletsSet, [setName]: updatedSet };
        setWalletsSet(updatedSets);
        await saveWalletsSetToSettings(updatedSets);
    };

    // -----------------------------
    // Импорт кошелька в указанный сет (диалог)
    // -----------------------------
    const openImportSetWalletDialog = (setName: string) => {
        setActiveSetName(setName);
        setImportPubKey('');
        setImportPrivKey('');
        setOpenImportSetDialog(true);
    };

    const handleImportWalletInSet = async () => {
        if (!activeSetName) return;

        const wallet: Wallet = {
            publicKey: importPubKey.trim(),
            privateKey: importPrivKey.trim(),
        };
        if (!wallet.publicKey || !wallet.privateKey) {
            return;
        }

        const updatedSet = [wallet, ...(walletsSet[activeSetName] || [])];
        const updatedSets = { ...walletsSet, [activeSetName]: updatedSet };
        setWalletsSet(updatedSets);
        await saveWalletsSetToSettings(updatedSets);

        setOpenImportSetDialog(false);
    };

    // -----------------------------
    // Удалить кошелёк в сете
    // -----------------------------
    const handleDeleteWalletInSet = async (setName: string, pubKey: string) => {
        const filtered = (walletsSet[setName] || []).filter((w) => w.publicKey !== pubKey);
        const updatedSets = { ...walletsSet, [setName]: filtered };
        setWalletsSet(updatedSets);
        await saveWalletsSetToSettings(updatedSets);
    };

    // Показ/скрытие приватного ключа (внутри сета)
    const toggleShowSetPrivateKey = (setName: string, index: number) => {
        setShowSetPrivateKey((prev) => ({
            ...prev,
            [setName]: prev[setName] === index ? null : index,
        }));
    };

    // ========================================================================
    // РЕНДЕР
    // ========================================================================
    return (
        <Box p={2}>
            <Typography variant="h4" gutterBottom>
                Wallets
            </Typography>
            <Divider sx={{ marginBottom: '20px' }} />

            {/* ------------------------------------------- */}
            {/* СТАРАЯ СЕКЦИЯ: Одиночные кошельки */}
            {/* ------------------------------------------- */}
            <Typography variant="h5" gutterBottom>
                Single Wallets
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box display="flex" justifyContent="space-between" marginBottom={2}>
                <StyledButton onClick={handleCreateWallet}>Generate</StyledButton>
                <StyledButton onClick={handleOpenDialog}>Import</StyledButton>
            </Box>

            <List>
                {wallets.length > 0 ? (
                    wallets.map((wallet, index) => (
                        <ListItem
                            key={wallet.publicKey}
                            sx={{
                                border: '1px solid #ccc',
                                borderRadius: '8px',
                                marginBottom: '10px',
                                padding: '10px',
                            }}
                        >
                            <ListItemText
                                primary={`Public Key: ${wallet.publicKey}`}
                                secondary={
                                    <Box display="flex" alignItems="center">
                                        <span style={{ marginRight: '10px' }}>Private Key: </span>
                                        {showPrivateKey === index ? (
                                            <TextField value={wallet.privateKey} InputProps={{ readOnly: true }} fullWidth />
                                        ) : (
                                            <span>••••••••••••</span>
                                        )}
                                        <IconButton
                                            onClick={() => toggleShowPrivateKey(index)}
                                            sx={{ marginLeft: '10px' }}
                                        >
                                            {showPrivateKey === index ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                        <IconButton
                                            onClick={() => handleDeleteWallet(wallet.publicKey)}
                                            sx={{ marginLeft: '10px', color: 'red' }}
                                        >
                                            <Delete />
                                        </IconButton>
                                    </Box>
                                }
                            />
                        </ListItem>
                    ))
                ) : (
                    <Typography variant="body1" sx={{ textAlign: 'center', marginTop: '20px', color: '#888' }}>
                        Create your wallet
                    </Typography>
                )}
            </List>


            {/* Диалог: импорт одиночного кошелька */}
            <Dialog open={openImportDialog} onClose={handleCloseDialog}>
                <DialogTitle>Добавить кошелек</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Public Key"
                        fullWidth
                        value={newPublicKey}
                        onChange={(e) => setNewPublicKey(e.target.value)}
                        margin="normal"
                    />
                    <TextField
                        label="Private Key"
                        fullWidth
                        value={newPrivateKey}
                        onChange={(e) => setNewPrivateKey(e.target.value)}
                        margin="normal"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog} color="primary">
                        Отмена
                    </Button>
                    <Button onClick={handleSaveWallet} color="primary">
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ------------------------------------------- */}
            {/* НОВАЯ СЕКЦИЯ: Наборы кошельков (walletsSet) */}
            {/* ------------------------------------------- */}
            <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
                Wallets Set (LMNFT)
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box display="flex" gap={2} mb={2}>
                <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setOpenCreateSetDialog(true)}
                >
                    Create Set (manually)
                </Button>
                <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setOpenGenerateSetDialog(true)}
                >
                    Generate Set (auto)
                </Button>
            </Box>

            <List>
                {Object.keys(walletsSet).map((setName) => {
                    const wset = walletsSet[setName] || [];
                    return (
                        <Box key={setName} mb={2}>
                            <ListItem
                                sx={{ border: '1px solid #ccc', borderRadius: '8px', mb: 1 }}
                                secondaryAction={
                                    <IconButton
                                        edge="end"
                                        sx={{ color: 'red' }}
                                        onClick={() => handleDeleteSet(setName)}
                                    >
                                        <Delete />
                                    </IconButton>
                                }
                                onClick={() => toggleExpandSet(setName)}
                            >
                                <ListItemText primary={`Set: ${setName} (${wset.length} wallets)`} />
                            </ListItem>

                            <Collapse in={expandedSets[setName] || false} timeout="auto" unmountOnExit>
                                <Box pl={4} pb={2}>
                                    {/* Кнопки внутри сета */}
                                    <Box display="flex" gap={2} mb={2}>
                                        <Button variant="outlined" onClick={() => handleGenerateWalletInSet(setName)}>
                                            Generate Wallet
                                        </Button>
                                        <Button variant="outlined" onClick={() => openImportSetWalletDialog(setName)}>
                                            Import Wallet
                                        </Button>
                                    </Box>

                                    <List>
                                        {wset.map((wallet, idx) => (
                                            <ListItem
                                                key={wallet.publicKey}
                                                sx={{
                                                    border: '1px solid #ccc',
                                                    borderRadius: '8px',
                                                    mb: 1,
                                                    padding: '10px',
                                                }}
                                                secondaryAction={
                                                    <IconButton
                                                        edge="end"
                                                        sx={{ color: 'red' }}
                                                        onClick={() => handleDeleteWalletInSet(setName, wallet.publicKey)}
                                                    >
                                                        <Delete />
                                                    </IconButton>
                                                }
                                            >
                                                <ListItemText
                                                    primary={`Public Key: ${wallet.publicKey}`}
                                                    secondary={
                                                        <Box display="flex" alignItems="center" gap={1}>
                                                            <span>Private Key: </span>
                                                            {showSetPrivateKey[setName] === idx ? (
                                                                <TextField
                                                                    value={wallet.privateKey}
                                                                    size="small"
                                                                    InputProps={{ readOnly: true }}
                                                                />
                                                            ) : (
                                                                <span>••••••••••••</span>
                                                            )}
                                                            <IconButton onClick={() => toggleShowSetPrivateKey(setName, idx)}>
                                                                {showSetPrivateKey[setName] === idx ? (
                                                                    <VisibilityOff />
                                                                ) : (
                                                                    <Visibility />
                                                                )}
                                                            </IconButton>
                                                        </Box>
                                                    }
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            </Collapse>
                        </Box>
                    );
                })}
            </List>

            {/* Диалог: Create Set manually */}
            <Dialog open={openCreateSetDialog} onClose={() => setOpenCreateSetDialog(false)}>
                <DialogTitle>Create a New Set (manually)</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Set Name"
                        fullWidth
                        value={newSetName}
                        onChange={(e) => setNewSetName(e.target.value)}
                        margin="normal"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreateSetDialog(false)}>Cancel</Button>
                    <Button onClick={handleCreateSet} disabled={!newSetName.trim()}>
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог: Generate Set (auto) */}
            <Dialog open={openGenerateSetDialog} onClose={() => setOpenGenerateSetDialog(false)}>
                <DialogTitle>Generate New Set (auto)</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Set Name"
                        fullWidth
                        value={generateSetName}
                        onChange={(e) => setGenerateSetName(e.target.value)}
                        margin="normal"
                    />
                    <TextField
                        label="How many wallets?"
                        fullWidth
                        type="number"
                        value={generateSetCount}
                        onChange={(e) => setGenerateSetCount(Number(e.target.value))}
                        margin="normal"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenGenerateSetDialog(false)}>Cancel</Button>
                    <Button
                        onClick={handleGenerateSet}
                        disabled={!generateSetName.trim() || generateSetCount < 1}
                    >
                        Generate
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог: Import Wallet в конкретный Set */}
            <Dialog open={openImportSetDialog} onClose={() => setOpenImportSetDialog(false)}>
                <DialogTitle>Import Wallet into "{activeSetName}"</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Public Key"
                        fullWidth
                        value={importPubKey}
                        onChange={(e) => setImportPubKey(e.target.value)}
                        margin="normal"
                    />
                    <TextField
                        label="Private Key"
                        fullWidth
                        value={importPrivKey}
                        onChange={(e) => setImportPrivKey(e.target.value)}
                        margin="normal"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenImportSetDialog(false)}>Cancel</Button>
                    <Button
                        onClick={handleImportWalletInSet}
                        disabled={!importPubKey.trim() || !importPrivKey.trim()}
                    >
                        Import
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
