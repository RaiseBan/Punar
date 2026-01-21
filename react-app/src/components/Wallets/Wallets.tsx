import React, { useState, useCallback } from 'react';
import { Box, Typography, Divider } from '@mui/material';
import { useWallets } from '../../hooks/useWallets';
import { useWalletSets } from '../../hooks/useWalletSets';
import { SingleWalletsList } from './SingleWalletsList';
import { WalletSetsList } from './WalletSetsList';
import { ImportWalletDialog } from './ImportWalletDialog';
import { CreateSetDialog } from './CreateSetDialog';
import { GenerateSetDialog } from './GenerateSetDialog';
import { ImportWalletInSetDialog } from './ImportWalletInSetDialog';

export default function Wallets() {
  // Хуки для работы с данными
  const {
    wallets,
    isLoading: walletsLoading,
    createWallet,
    importWallet,
    deleteWallet,
  } = useWallets();

  const {
    walletSets,
    isLoading: setsLoading,
    createSet,
    generateSet,
    deleteSet,
    generateWalletInSet,
    importWalletInSet,
    deleteWalletFromSet,
  } = useWalletSets();

  const confirmDialog = (message: string) => {
    // eslint-disable-next-line no-restricted-globals
    return confirm(message);
  };

  // Состояния диалогов
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [createSetDialogOpen, setCreateSetDialogOpen] = useState(false);
  const [generateSetDialogOpen, setGenerateSetDialogOpen] = useState(false);
  const [importInSetDialogOpen, setImportInSetDialogOpen] = useState(false);
  const [activeSetName, setActiveSetName] = useState('');

  // Обработчики для одиночных кошельков
  const handleCreateWallet = useCallback(async () => {
    try {
      await createWallet();
    } catch (err) {
      console.error('Failed to create wallet:', err);
    }
  }, [createWallet]);

  const handleImportWallet = useCallback(async (publicKey: string, privateKey: string) => {
    await importWallet(publicKey, privateKey);
  }, [importWallet]);

  const handleDeleteWallet = useCallback(async (publicKey: string) => {
    if (confirmDialog('Are you sure you want to delete this wallet?')) {
      await deleteWallet(publicKey);
    }
  }, [deleteWallet]);

  // Обработчики для наборов
  const handleCreateSet = useCallback(async (setName: string) => {
    await createSet(setName);
  }, [createSet]);

  const handleGenerateSet = useCallback(async (setName: string, count: number) => {
    await generateSet(setName, count);
  }, [generateSet]);

  const handleDeleteSet = useCallback(async (setName: string) => {
    if (confirmDialog(`Are you sure you want to delete set "${setName}"?`)) {
      await deleteSet(setName);
    }
  }, [deleteSet]);

  const handleGenerateWalletInSet = useCallback(async (setName: string) => {
    try {
      await generateWalletInSet(setName);
    } catch (err) {
      console.error('Failed to generate wallet:', err);
    }
  }, [generateWalletInSet]);

  const handleImportWalletInSet = useCallback(async (
    publicKey: string,
    privateKey: string
  ) => {
    await importWalletInSet(activeSetName, publicKey, privateKey);
  }, [importWalletInSet, activeSetName]);

  const handleDeleteWalletFromSet = useCallback(async (
    setName: string,
    publicKey: string
  ) => {
    if (confirmDialog('Are you sure you want to delete this wallet from the set?')) {
      await deleteWalletFromSet(setName, publicKey);
    }
  }, [deleteWalletFromSet]);

  // Открытие диалога импорта в набор
  const handleOpenImportInSet = useCallback((setName: string) => {
    setActiveSetName(setName);
    setImportInSetDialogOpen(true);
  }, []);

  return (
    <Box p={2}>
      <Typography variant="h4" gutterBottom>
        Wallets
      </Typography>
      <Divider sx={{ marginBottom: '20px' }} />

      {/* Одиночные кошельки */}
      <SingleWalletsList
        wallets={wallets}
        onCreateWallet={handleCreateWallet}
        onImportWallet={() => setImportDialogOpen(true)}
        onDeleteWallet={handleDeleteWallet}
        isLoading={walletsLoading}
      />

      {/* Наборы кошельков */}
      <WalletSetsList
        walletSets={walletSets}
        onCreateSet={() => setCreateSetDialogOpen(true)}
        onGenerateSet={() => setGenerateSetDialogOpen(true)}
        onDeleteSet={handleDeleteSet}
        onGenerateWallet={handleGenerateWalletInSet}
        onImportWallet={handleOpenImportInSet}
        onDeleteWallet={handleDeleteWalletFromSet}
        isLoading={setsLoading}
      />

      {/* Диалоги */}
      <ImportWalletDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImport={handleImportWallet}
      />

      <CreateSetDialog
        open={createSetDialogOpen}
        onClose={() => setCreateSetDialogOpen(false)}
        onCreate={handleCreateSet}
      />

      <GenerateSetDialog
        open={generateSetDialogOpen}
        onClose={() => setGenerateSetDialogOpen(false)}
        onGenerate={handleGenerateSet}
      />

      <ImportWalletInSetDialog
        open={importInSetDialogOpen}
        onClose={() => setImportInSetDialogOpen(false)}
        setName={activeSetName}
        onImport={handleImportWalletInSet}
      />
    </Box>
  );
}