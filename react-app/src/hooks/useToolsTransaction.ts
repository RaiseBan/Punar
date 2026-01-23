import { useState, useCallback, useEffect } from 'react';
import { useFormValidation } from './useFormValidation';
import { validatePrivateKey, validatePublicKey, validateSolAmount } from '../utils/validators';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import { sendTransactionWithRetries } from '../utils/transactionService';
import { AppSettings } from '../../../shared/types';

export function useToolsTransaction() {
  const [wallets, setWallets] = useState<Array<{ publicKey: string; privateKey: string }>>([]);
  const [walletSets, setWalletSets] = useState<string[]>([]);
  const [rpcUrl, setRpcUrl] = useState('');

  // From состояния
  const [fromMethod, setFromMethod] = useState<'existing' | 'manual'>('existing');
  const [fromSelectedPrivateKey, setFromSelectedPrivateKey] = useState('');
  const [fromManualPrivateKey, setFromManualPrivateKey] = useState('');

  // To состояния
  const [toMethod, setToMethod] = useState<'existing' | 'manual' | 'set'>('existing');
  const [toSelectedPubKey, setToSelectedPubKey] = useState('');
  const [toManualPubKey, setToManualPubKey] = useState('');
  const [toSelectedSetName, setToSelectedSetName] = useState('');

  // Amount
  const [amount, setAmount] = useState('');

  // UI состояния
  const [isLoading, setIsLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info'>('success');

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

  // Загрузка данных при монтировании
  useEffect(() => {
    const loadData = async () => {
      try {
        // Загружаем wallets отдельно
        const w = await window.electronAPI.getWallets();
        setWallets(w || []);

        // Загружаем settings для walletsSet и RPC
        const settings = await window.electronAPI.getSettings();
        setWalletSets(Object.keys(settings.walletsSet || {}));
        setRpcUrl(settings.mainRpc || '');
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadData();
  }, []);

  // Обработка изменения amount
  const handleAmountChange = useCallback((value: string) => {
    // Разрешаем только числа и точку
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  }, []);

  // Показать уведомление
  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);

  // Закрыть уведомление
  const closeSnackbar = useCallback(() => {
    setSnackbarOpen(false);
  }, []);

  // Основная логика отправки транзакции
  const handleSendTransaction = useCallback(async () => {
    // Валидация amount
    if (!validateSolAmount(amount).isValid) {
      validation.setFieldError('amount', validateSolAmount(amount).error || null);
      showSnackbar('Please enter a valid amount', 'error');
      return;
    }

    // Валидация manual полей
    if (fromMethod === 'manual' && !validatePrivateKey(fromManualPrivateKey).isValid) {
      validation.setFieldError(
        'fromManualPrivateKey',
        validatePrivateKey(fromManualPrivateKey).error || null
      );
      showSnackbar('Invalid private key', 'error');
      return;
    }

    if (toMethod === 'manual' && !validatePublicKey(toManualPubKey).isValid) {
      validation.setFieldError('toManualPubKey', validatePublicKey(toManualPubKey).error || null);
      showSnackbar('Invalid recipient address', 'error');
      return;
    }

    // Проверка что все поля заполнены
    if (fromMethod === 'existing' && !fromSelectedPrivateKey) {
      showSnackbar('Please select a wallet to send from', 'error');
      return;
    }

    if (toMethod === 'existing' && !toSelectedPubKey) {
      showSnackbar('Please select a recipient wallet', 'error');
      return;
    }

    if (toMethod === 'set' && !toSelectedSetName) {
      showSnackbar('Please select a wallet set', 'error');
      return;
    }

    setIsLoading(true);

    try {
      // Получаем отправителя
      const fromPrivKey = fromMethod === 'existing' ? fromSelectedPrivateKey : fromManualPrivateKey;
      const sender = Keypair.fromSecretKey(bs58.decode(fromPrivKey));

      // Получаем получателей
      let receivers: PublicKey[] = [];
      if (toMethod === 'existing') {
        receivers = [new PublicKey(toSelectedPubKey)];
      } else if (toMethod === 'manual') {
        receivers = [new PublicKey(toManualPubKey)];
      } else if (toMethod === 'set') {
        const settings = (await window.electronAPI.getSettings()) as AppSettings;
        if (settings.walletsSet && settings.walletsSet[toSelectedSetName]) {
          const walletList = settings.walletsSet[toSelectedSetName];
          receivers = walletList.map(
            (w) => Keypair.fromSecretKey(bs58.decode(w.privateKey)).publicKey
          );
        } else {
          throw new Error(`Wallet set "${toSelectedSetName}" not found`);
        }
      }

      if (receivers.length === 0) {
        throw new Error('No receivers found');
      }

      // Создаём connection и параметры транзакции
      const connection = new Connection(rpcUrl);
      const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const lamports = Math.floor(parseFloat(amount) * 1e9);
      const cuLimit = receivers.length * 600;

      // Отправляем транзакцию на каждого получателя
      for (const receiver of receivers) {
        const transaction = new Transaction({
          recentBlockhash,
          feePayer: sender.publicKey,
        });

        transaction.add(
          SystemProgram.transfer({
            fromPubkey: sender.publicKey,
            toPubkey: receiver,
            lamports,
          })
        );

        // Исправленный вызов sendTransactionWithRetries
        const result = await sendTransactionWithRetries(
          transaction,
          sender,
          rpcUrl,
          5, // maxRetries
          30000, // timeout
          cuLimit,
          20000 // fee
        );

        if (!result.success) {
          throw new Error(result.error || 'Transaction failed');
        }
      }

      showSnackbar(`Successfully sent ${amount} SOL to ${receivers.length} wallet(s)`, 'success');
    } catch (error) {
      console.error('Transaction failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      showSnackbar(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [
    amount,
    fromMethod,
    fromSelectedPrivateKey,
    fromManualPrivateKey,
    toMethod,
    toSelectedPubKey,
    toManualPubKey,
    toSelectedSetName,
    rpcUrl,
    validation,
    showSnackbar,
  ]);

  return {
    // Данные
    wallets,
    walletSets,
    rpcUrl,

    // From состояния
    fromMethod,
    fromSelectedPrivateKey,
    fromManualPrivateKey,
    setFromMethod,
    setFromSelectedPrivateKey,
    setFromManualPrivateKey,

    // To состояния
    toMethod,
    toSelectedPubKey,
    toManualPubKey,
    toSelectedSetName,
    setToMethod,
    setToSelectedPubKey,
    setToManualPubKey,
    setToSelectedSetName,

    // Amount
    amount,
    handleAmountChange,

    // UI
    isLoading,
    snackbarOpen,
    snackbarMessage,
    snackbarSeverity,
    closeSnackbar,
    showSnackbar,

    // Валидация
    validation,

    // Действия
    handleSendTransaction,
  };
}
