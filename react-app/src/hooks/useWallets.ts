import { useState, useEffect, useCallback } from 'react';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

interface Wallet {
  publicKey: string;
  privateKey: string;
}

/**
 * Возвращаемое значение хука useWallets
 */
interface UseWalletsReturn {
  /** Массив всех кошельков */
  wallets: Wallet[];
  /** Флаг загрузки */
  isLoading: boolean;
  /** Сообщение об ошибке */
  error: string | null;
  /** Создать новый кошелек (генерирует keypair автоматически) */
  createWallet: () => Promise<Wallet>;
  /** Импортировать существующий кошелек */
  importWallet: (publicKey: string, privateKey: string) => Promise<Wallet>;
  /** Удалить кошелек по publicKey */
  deleteWallet: (publicKey: string) => Promise<void>;
  /** Перезагрузить список кошельков */
  reload: () => Promise<void>;
}

/**
 * React hook для управления Solana кошельками
 *
 * Обеспечивает:
 * - Загрузку кошельков из Electron main process
 * - Создание новых кошельков (автогенерация keypair)
 * - Импорт существующих кошельков
 * - Удаление кошельков
 * - Управление состоянием загрузки и ошибок
 *
 * @returns объект с методами и состоянием кошельков
 *
 * @example
 * ```typescript
 * function WalletsPage() {
 *   const {
 *     wallets,
 *     isLoading,
 *     error,
 *     createWallet,
 *     importWallet,
 *     deleteWallet,
 *     reload
 *   } = useWallets();
 *
 *   const handleCreate = async () => {
 *     try {
 *       const wallet = await createWallet();
 *       console.log('Created:', wallet.publicKey);
 *     } catch (err) {
 *       alert('Failed to create wallet');
 *     }
 *   };
 *
 *   const handleImport = async () => {
 *     try {
 *       await importWallet(publicKey, privateKey);
 *       alert('Wallet imported!');
 *     } catch (err) {
 *       alert(err.message);
 *     }
 *   };
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *
 *   return (
 *     <div>
 *       <h1>Wallets ({wallets.length})</h1>
 *       {wallets.map(w => (
 *         <div key={w.publicKey}>
 *           {w.publicKey}
 *           <button onClick={() => deleteWallet(w.publicKey)}>
 *             Delete
 *           </button>
 *         </div>
 *       ))}
 *       <button onClick={handleCreate}>Create New</button>
 *       <button onClick={reload}>Reload</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWallets(): UseWalletsReturn {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Загрузить кошельки из Electron main process
   *
   * Автоматически вызывается при монтировании компонента.
   * Можно вызвать вручную через возвращаемое значение `reload`.
   *
   * @example
   * ```typescript
   * const { reload } = useWallets();
   * // Перезагрузить после внешних изменений
   * await reload();
   * ```
   */
  const loadWallets = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await window.electronAPI.getWallets();
      setWallets(response || []);
    } catch (err) {
      console.error('Ошибка при загрузке кошельков', err);
      setError('Failed to load wallets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  /**
   * Создать новый Solana кошелек
   *
   * Автоматически генерирует новый Keypair через @solana/web3.js,
   * сохраняет в Electron и добавляет в локальный state.
   *
   * @returns Promise с созданным кошельком
   * @throws {Error} если не удалось создать или сохранить кошелек
   *
   * @example
   * ```typescript
   * const handleCreate = async () => {
   *   try {
   *     const wallet = await createWallet();
   *     alert(`Created: ${wallet.publicKey}`);
   *   } catch (err) {
   *     alert('Failed to create wallet');
   *   }
   * };
   * ```
   */
  const createWallet = useCallback(async () => {
    try {
      const newKeypair = Keypair.generate();
      const newWallet = {
        publicKey: newKeypair.publicKey.toString(),
        privateKey: bs58.encode(newKeypair.secretKey),
      };

      await window.electronAPI.addWallet(newWallet);
      setWallets((prev) => [newWallet, ...prev]);
      return newWallet;
    } catch (err) {
      console.error('Ошибка при создании кошелька', err);
      throw err;
    }
  }, []);

  /**
   * Импортировать существующий кошелек
   *
   * Валидирует что publicKey и privateKey не пустые,
   * сохраняет в Electron и добавляет в локальный state.
   *
   * @param publicKey - публичный ключ кошелька
   * @param privateKey - приватный ключ в base58 формате
   * @returns Promise с импортированным кошельком
   * @throws {Error} если publicKey или privateKey пустые
   * @throws {Error} если не удалось добавить кошелек (например, дубликат)
   *
   * @example
   * ```typescript
   * const handleImport = async () => {
   *   const pubKey = prompt('Enter public key');
   *   const privKey = prompt('Enter private key');
   *
   *   try {
   *     await importWallet(pubKey, privKey);
   *     alert('Wallet imported successfully!');
   *   } catch (err) {
   *     alert(err.message);
   *   }
   * };
   * ```
   */
  const importWallet = useCallback(async (publicKey: string, privateKey: string) => {
    try {
      const newWallet = {
        publicKey: publicKey.trim(),
        privateKey: privateKey.trim(),
      };

      if (!newWallet.publicKey || !newWallet.privateKey) {
        throw new Error('Public key and private key are required');
      }

      await window.electronAPI.addWallet(newWallet);
      setWallets((prev) => [newWallet, ...prev]);
      return newWallet;
    } catch (err) {
      console.error('Ошибка при импорте кошелька', err);
      throw err;
    }
  }, []);

  /**
   * Удалить кошелек по публичному ключу
   *
   * Удаляет из Electron и обновляет локальный state.
   *
   * @param publicKey - публичный ключ кошелька для удаления
   * @throws {Error} если не удалось удалить кошелек
   *
   * @example
   * ```typescript
   * const handleDelete = async (publicKey: string) => {
   *   if (confirm('Delete this wallet?')) {
   *     try {
   *       await deleteWallet(publicKey);
   *     } catch (err) {
   *       alert('Failed to delete');
   *     }
   *   }
   * };
   * ```
   */
  const deleteWallet = useCallback(async (publicKey: string) => {
    try {
      await window.electronAPI.deleteWallet(publicKey);
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
