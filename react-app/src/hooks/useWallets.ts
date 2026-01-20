import { useState, useEffect, useCallback } from 'react';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

interface Wallet {
  publicKey: string;
  privateKey: string;
}

export function useWallets() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка кошельков при монтировании
  useEffect(() => {
    loadWallets();
  }, []);

  const loadWallets = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await window.electronAPI?.getWallets();
      
      if (response?.message) {
        console.log(response.message);
      } else {
        setWallets(response || []);
      }
    } catch (err) {
      console.error('Ошибка при загрузке кошельков', err);
      setError('Failed to load wallets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Создание нового кошелька
  const createWallet = useCallback(async () => {
    try {
      const newKeypair = Keypair.generate();
      const newWallet = {
        publicKey: newKeypair.publicKey.toString(),
        privateKey: bs58.encode(newKeypair.secretKey),
      };

      await window.electronAPI?.addWallet(newWallet);
      setWallets((prev) => [newWallet, ...prev]);
      return newWallet;
    } catch (err) {
      console.error('Ошибка при создании кошелька', err);
      throw err;
    }
  }, []);

  // Импорт кошелька
  const importWallet = useCallback(async (publicKey: string, privateKey: string) => {
    try {
      const newWallet = {
        publicKey: publicKey.trim(),
        privateKey: privateKey.trim(),
      };

      if (!newWallet.publicKey || !newWallet.privateKey) {
        throw new Error('Public key and private key are required');
      }

      await window.electronAPI?.addWallet(newWallet);
      setWallets((prev) => [newWallet, ...prev]);
      return newWallet;
    } catch (err) {
      console.error('Ошибка при импорте кошелька', err);
      throw err;
    }
  }, []);

  // Удаление кошелька
  const deleteWallet = useCallback(async (publicKey: string) => {
    try {
      await window.electronAPI?.deleteWallet(publicKey);
      setWallets((prev) => prev.filter((w) => w.publicKey !== publicKey));
    } catch (err) {
      console.error('Ошибка при удалении кошелька', err);
      throw err;
    }
  }, []);

  return {
    wallets,
    isLoading,
    error,
    createWallet,
    importWallet,
    deleteWallet,
    reload: loadWallets,
  };
}