import React, { useState, useEffect } from 'react';
import { Button, TextField, IconButton, List, ListItem, ListItemText, Box, Dialog, DialogActions, DialogContent, DialogTitle, Typography, Divider } from '@mui/material';
import { Visibility, VisibilityOff, Delete } from '@mui/icons-material';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { styled } from '@mui/system';

const Wallets = () => {
    const [wallets, setWallets] = useState<any[]>([]);
    const [showPrivateKey, setShowPrivateKey] = useState<number | null>(null);
    const [open, setOpen] = useState(false); // Состояние модального окна
    const [newPublicKey, setNewPublicKey] = useState('');
    const [newPrivateKey, setNewPrivateKey] = useState('');

    useEffect(() => {
        window.electronAPI!.getWallets()
            .then((response: any) => {
                if (response.message) {
                    console.log(response.message);
                } else {
                    setWallets(response);
                }
            })
            .catch((error: any) => console.error('Ошибка при загрузке кошельков', error));
    }, []);

    const handleCreateWallet = () => {
        const newKeypair = Keypair.generate();
        const newWallet = {
            publicKey: newKeypair.publicKey.toString(),
            privateKey: bs58.encode(newKeypair.secretKey),
        };

        window.electronAPI!.addWallet(newWallet)
            .then(() => {
                setWallets(prev => [newWallet, ...prev]); // Добавляем новый кошелек в начало списка
            })
            .catch((error: any) => console.error('Ошибка при создании кошелька', error));
    };

    const handleOpenDialog = () => {
        setOpen(true);
    };

    const handleCloseDialog = () => {
        setOpen(false);
        setNewPublicKey('');
        setNewPrivateKey('');
    };

    const handleSaveWallet = () => {
        const newWallet = {
            publicKey: newPublicKey,
            privateKey: newPrivateKey,
        };

        window.electronAPI!.addWallet(newWallet)
            .then(() => {
                setWallets(prev => [newWallet, ...prev]); // Добавляем новый кошелек в начало списка
                handleCloseDialog();
            })
            .catch((error: any) => console.error('Ошибка при добавлении кошелька', error));
    };

    const handleDeleteWallet = (publicKey: string) => {
        window.electronAPI!.deleteWallet(publicKey)
            .then(() => {
                setWallets(prev => prev.filter(wallet => wallet.publicKey !== publicKey));
            })
            .catch((error: any) => console.error('Ошибка при удалении кошелька', error));
    };

    const isSaveDisabled = !newPublicKey || !newPrivateKey;

    return (
        <Box p={2}>
            <Typography variant="h4" gutterBottom>Wallets</Typography>
            <Divider sx={{ marginBottom: '20px' }} /> {/* Черта-разделитель */}

            {/* Кнопки для добавления кошелька */}
            <Box display="flex" justifyContent="space-between" marginBottom={2}>
                <StyledButton onClick={handleCreateWallet}>Generate</StyledButton>
                <StyledButton onClick={handleOpenDialog}>Import</StyledButton>
            </Box>

            <List>
                {wallets.map((wallet, index) => (
                    <ListItem key={wallet.publicKey} sx={{ border: '1px solid #ccc', borderRadius: '8px', marginBottom: '10px', padding: '10px' }}>
                        <ListItemText
                            primary={`Public Key: ${wallet.publicKey}`}
                            secondary={
                                <Box display="flex" alignItems="center">
                                    <span style={{ marginRight: '10px' }}>Private Key: </span>
                                    {showPrivateKey === index ? (
                                        <TextField
                                            value={wallet.privateKey}
                                            InputProps={{ readOnly: true }}
                                            fullWidth
                                        />
                                    ) : (
                                        <span>••••••••••••</span>
                                    )}
                                    <IconButton
                                        onClick={() => setShowPrivateKey(showPrivateKey === index ? null : index)}
                                        sx={{ marginLeft: '10px' }}
                                    >
                                        {showPrivateKey === index ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                    {/* Кнопка-иконка мусорки */}
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
                ))}
            </List>

            {/* Модальное окно для добавления кошелька */}
            <Dialog open={open} onClose={handleCloseDialog}>
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
                    <Button
                        onClick={handleSaveWallet}
                        color="primary"
                        disabled={isSaveDisabled} // Кнопка будет недоступна, если поля пустые
                    >
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

// Стилизуем кнопки с анимацией и оранжевым цветом
const StyledButton = styled(Button)({
    // fontFamily: 'Tensor',
    // fontWeight: 'bold',
    backgroundColor: '#FF5722', // Оранжевый цвет
    color: '#fff',
    padding: '10px 20px',
    '&:hover': {
        backgroundColor: '#E64A19', // Тёмно-оранжевый при наведении
        transform: 'scale(1.05)', // Легкое увеличение кнопки при наведении
    },
    '&:active': {
        animation: 'scaleUp 0.3s ease-in-out',
    },
    '@keyframes scaleUp': {
        '0%': { transform: 'scale(1)' },
        '100%': { transform: 'scale(1.1)' },
    },
});

export default  Wallets;
