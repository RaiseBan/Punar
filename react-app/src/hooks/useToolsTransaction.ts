import { useState, useEffect, useCallback } from 'react';
import { Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { sendTransactionWithRetries } from '../utils/transactionService';
import { validatePrivateKey, validatePublicKey, validateSolAmount } from '../utils/validators';
import { useFormValidation } from './useFormValidation';

interface Wallet {
  publicKey: string;
  privateKey: string;
}

interface SettingsWithWalletsSet {
  walletsSet?: Record<string, Wallet[]>;
  mainRpc?: string;
}

export function useToolsTransaction() {
  // Данные кошельков
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletSets, setWalletSets] = useState<string[]>([]);
  const [rpcUrl, setRpcUrl] = useState('');

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      try {
        const w = await window.electronAPI?.getWallets();
        setWallets(w || []);

        const settings = (await window.electronAPI?.getSettings()) as
          | SettingsWithWalletsSet
          | undefined;
        if (settings?.walletsSet) {
          setRpcUrl(settings?.mainRpc || '');
          const setNames = Object.keys(settings.walletsSet);
          setWalletSets(setNames);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, []);

  // Состояния формы
  const [fromMethod, setFromMethod] = useState<'existing' | 'manual'>('existing');
  const [fromSelectedPrivateKey, setFromSelectedPrivateKey] = useState('');
  const [fromManualPrivateKey, setFromManualPrivateKey] = useState('');

  const [toMethod, setToMethod] = useState<'existing' | 'manual' | 'set'>('existing');
  const [toSelectedPubKey, setToSelectedPubKey] = useState('');
  const [toManualPubKey, setToManualPubKey] = useState('');
  const [toSelectedSetName, setToSelectedSetName] = useState('');

  const [amount, setAmount] = useState<string>('');

  // UI состояния
  const [isLoading, setIsLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

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

  // Обработчик изменения суммы
  const handleAmountChange = useCallback((value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  }, []);

  // Показать уведомление
  const showSnackbar = useCallback((message: string, severity: 'success' | 'error') => {
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
      const sender = Keypair.fromSecretKey(new Uint8Array(bs58.decode(fromPrivKey)));

      // Получаем получателей
      const receivers: PublicKey[] = [];

      if (toMethod === 'existing') {
        receivers.push(new PublicKey(toSelectedPubKey));
      } else if (toMethod === 'manual') {
        receivers.push(new PublicKey(toManualPubKey));
      } else if (toMethod === 'set') {
        const settings = (await window.electronAPI?.getSettings()) as
          | SettingsWithWalletsSet
          | undefined;
        if (settings?.walletsSet && settings.walletsSet[toSelectedSetName]) {
          const walletList = settings.walletsSet[toSelectedSetName];
          walletList.forEach((wallet: Wallet) => {
            receivers.push(new PublicKey(wallet.publicKey));
          });
        } else {
          throw new Error(`Wallet set "${toSelectedSetName}" not found`);
        }
      }

      // Создаем транзакцию
      const transaction = new Transaction();
      const instructions = receivers.map((receiver) =>
        SystemProgram.transfer({
          fromPubkey: sender.publicKey,
          toPubkey: receiver,
          lamports: Number(amount) * LAMPORTS_PER_SOL,
        })
      );

      transaction.add(...instructions);

      const cuLimit = receivers.length * 600;
      const settings = (await window.electronAPI?.getSettings()) as
        | SettingsWithWalletsSet
        | undefined;

      if (!settings || !settings.mainRpc) {
        throw new Error('RPC not configured');
      }

      // Отправляем транзакцию
      const result = await sendTransactionWithRetries(
        transaction,
        sender,
        settings.mainRpc,
        5, // maxRetries
        30000, // timeout
        cuLimit, // cuLimit
        20000 // fee
      );

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }

      showSnackbar(`Successfully sent ${amount} SOL to ${receivers.length} wallet(s)`, 'success');

      // Сброс формы
      setAmount('');
      if (fromMethod === 'manual') setFromManualPrivateKey('');
      if (toMethod === 'manual') setToManualPubKey('');
    } catch (error: unknown) {
      console.error('Transaction error:', error);
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
    showSnackbar, // Добавлено!

    // Валидация
    validation,

    // Действия
    handleSendTransaction,
  };
}
