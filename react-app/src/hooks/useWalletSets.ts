import { useState, useEffect, useCallback } from 'react';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

interface Wallet {
  publicKey: string;
  privateKey: string;
}

interface WalletSet {
  [setName: string]: Wallet[];
}

export function useWalletSets() {
  const [walletSets, setWalletSets] = useState<WalletSet>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadWalletSets = useCallback(async () => {
    try {
      setIsLoading(true);
      const settings = await window.electronAPI.getSettings();
      if (settings.walletsSet) {
        setWalletSets(settings.walletsSet);
      }
    } catch (err) {
      console.error('Ошибка при загрузке wallet sets', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWalletSets();
  }, [loadWalletSets]);

  const saveToSettings = useCallback(async (updatedSets: WalletSet) => {
    try {
      const settings = await window.electronAPI.getSettings();
      await window.electronAPI.saveSettings({
        ...settings,
        walletsSet: updatedSets,
      });
    } catch (err) {
      console.error('Ошибка при сохранении wallet sets', err);
      throw err;
    }
  }, []);

  const createSet = useCallback(
    async (setName: string) => {
      if (!setName.trim()) {
        throw new Error('Set name is required');
      }
      if (walletSets[setName]) {
        throw new Error('Set with this name already exists');
      }

      const updatedSets = { ...walletSets, [setName]: [] };
      setWalletSets(updatedSets);
      await saveToSettings(updatedSets);
    },
    [walletSets, saveToSettings]
  );

  const generateSet = useCallback(
    async (setName: string, count: number) => {
      if (!setName.trim()) {
        throw new Error('Set name is required');
      }
      if (walletSets[setName]) {
        throw new Error('Set with this name already exists');
      }

      const generated: Wallet[] = [];
      for (let i = 0; i < count; i++) {
        const kp = Keypair.generate();
        generated.push({
          publicKey: kp.publicKey.toString(),
          privateKey: bs58.encode(kp.secretKey),
        });
      }

      const updatedSets = { ...walletSets, [setName]: generated };
      setWalletSets(updatedSets);
      await saveToSettings(updatedSets);
    },
    [walletSets, saveToSettings]
  );

  const deleteSet = useCallback(
    async (setName: string) => {
      const updatedSets = { ...walletSets };
      delete updatedSets[setName];
      setWalletSets(updatedSets);
      await saveToSettings(updatedSets);
    },
    [walletSets, saveToSettings]
  );

  const generateWalletInSet = useCallback(
    async (setName: string) => {
      const kp = Keypair.generate();
      const newWallet: Wallet = {
        publicKey: kp.publicKey.toString(),
        privateKey: bs58.encode(kp.secretKey),
      };

      const updatedSet = [newWallet, ...(walletSets[setName] || [])];
      const updatedSets = { ...walletSets, [setName]: updatedSet };
      setWalletSets(updatedSets);
      await saveToSettings(updatedSets);
    },
    [walletSets, saveToSettings]
  );

  const importWalletInSet = useCallback(
    async (setName: string, publicKey: string, privateKey: string) => {
      const wallet: Wallet = {
        publicKey: publicKey.trim(),
        privateKey: privateKey.trim(),
      };

      if (!wallet.publicKey || !wallet.privateKey) {
        throw new Error('Public key and private key are required');
      }

      const updatedSet = [wallet, ...(walletSets[setName] || [])];
      const updatedSets = { ...walletSets, [setName]: updatedSet };
      setWalletSets(updatedSets);
      await saveToSettings(updatedSets);
    },
    [walletSets, saveToSettings]
  );

  const deleteWalletFromSet = useCallback(
    async (setName: string, publicKey: string) => {
      const filtered = (walletSets[setName] || []).filter((w) => w.publicKey !== publicKey);
      const updatedSets = { ...walletSets, [setName]: filtered };
      setWalletSets(updatedSets);
      await saveToSettings(updatedSets);
    },
    [walletSets, saveToSettings]
  );

  return {
    walletSets,
    isLoading,
    createSet,
    generateSet,
    deleteSet,
    generateWalletInSet,
    importWalletInSet,
    deleteWalletFromSet,
    reload: loadWalletSets,
  };
}
