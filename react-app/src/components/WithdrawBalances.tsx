// components/WithdrawBalances.tsx
import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Transaction,
  SystemProgram,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  Connection,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { sendTransactionWithRetries } from '../utils/transactionService';

interface WithdrawBalancesProps {
  wallets: Array<{ publicKey: string; privateKey: string }>;
  walletSets: string[];
  rpcUrl: string;
  onStatusUpdate: (message: string, severity: 'success' | 'error' | 'info') => void;
  onLoading: (isLoading: boolean) => void;
}

type FromMethod = 'existing' | 'manual' | 'set';
type ToMethod = 'existing' | 'manual';
type WalletSetEntry = { privateKey: string };
type SettingsWithWalletsSet = { walletsSet?: Record<string, WalletSetEntry[]> };

export default function WithdrawBalances({
  wallets,
  walletSets,
  rpcUrl,
  onStatusUpdate,
  onLoading,
}: WithdrawBalancesProps) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [fromMethod, setFromMethod] = useState<FromMethod>('existing');
  const [selectedKey, setSelectedKey] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [setName, setSetName] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [toMethod, setToMethod] = useState<ToMethod>('existing');

  useEffect(() => {
    if (rpcUrl) {
      setConnection(new Connection(rpcUrl));
    }
  }, [rpcUrl]);

  const handleWithdraw = async () => {
    if (!connection) {
      onStatusUpdate('RPC connection error', 'error');
      return;
    }

    // Resolve senders logic
    let senders: Keypair[] = [];
    try {
      if (fromMethod === 'existing') {
        if (!selectedKey) throw new Error('Select sender wallet');
        senders.push(Keypair.fromSecretKey(bs58.decode(selectedKey)));
      } else if (fromMethod === 'manual') {
        if (!manualKey) throw new Error('Enter private key');
        senders.push(Keypair.fromSecretKey(bs58.decode(manualKey)));
      } else if (fromMethod === 'set') {
        const response = (await window.electronAPI.getSettings()) as
          | SettingsWithWalletsSet
          | undefined;
        const set = response?.walletsSet?.[setName];
        if (!set) throw new Error('Set not found');
        senders = set.map((w) => Keypair.fromSecretKey(bs58.decode(w.privateKey)));
      }
    } catch (e) {
      onStatusUpdate(e instanceof Error ? e.message : 'Invalid sender data', 'error');
      return;
    }

    // Validate recipient
    let recipient: PublicKey;
    try {
      recipient = new PublicKey(toAddress);
      // console.log(recipient);
    } catch {
      onStatusUpdate('Invalid recipient address', 'error');
      return;
    }

    onLoading(true);
    onStatusUpdate('Starting withdrawal process...', 'info');

    try {
      for (const sender of senders) {
        try {
          const balance = await connection.getBalance(sender.publicKey);

          // 1. Получаем актуальный rent-exempt минимум
          const rentExemptMin = await connection.getMinimumBalanceForRentExemption(0);

          // 2. Создаем тестовую транзакцию для расчета комиссии

          const testTx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: sender.publicKey,
              toPubkey: recipient,
              lamports: 1, //balance - rentExemptMin, // Оставляем минимум
            })
          );
          testTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          testTx.feePayer = sender.publicKey;

          // 3. Рассчитываем комиссию для реальной транзакции
          const feeEstimate = await connection.getFeeForMessage(
            testTx.compileMessage(),
            'confirmed'
          );

          // 4. Проверяем доступный баланс
          const safeAmount = balance - feeEstimate.value! - rentExemptMin - 109120; // 109120 const IDK
          console.log(`sender: ${sender.publicKey.toString()}`);
          console.log(`receiver: ${recipient.toString()}`);
          console.log(`balance: ${balance}`);
          console.log(`fee: ${feeEstimate.value}`);
          console.log(`safe amount: ${safeAmount}`);
          console.log(`rent: ${rentExemptMin}`);
          console.log(
            `account size: ${(await connection.getAccountInfo(sender.publicKey))?.data.byteLength}`
          );

          if (safeAmount <= 0) {
            throw new Error(`
                        Insufficient funds for ${sender.publicKey.toString()}
                        Balance: ${balance / LAMPORTS_PER_SOL} SOL
                        Required: ${(feeEstimate.value! + rentExemptMin) / LAMPORTS_PER_SOL} SOL
                    `);
          }

          // 5. Создаем финальную транзакцию
          const finalTx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: sender.publicKey,
              toPubkey: recipient,
              lamports: safeAmount, //safeAmount,
            })
          );

          // 6. Добавляем обязательные параметры
          finalTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          finalTx.feePayer = sender.publicKey;

          // 7. Отправляем транзакцию
          await sendTransactionWithRetries(
            finalTx,
            sender,
            connection.rpcEndpoint,
            5,
            30000,
            600,
            feeEstimate.value!
          );
        } catch (e) {
          console.error(`Failed for ${sender.publicKey}:`, e);
          throw e;
        }
      }
    } catch (e) {
      onStatusUpdate('Withdrawal process failed...Not enough sol', 'error');
    } finally {
      onLoading(false);
    }
  };

  return (
    <Box
      sx={{
        border: '1px solid #ccc',
        borderRadius: '7px',
        p: 3,
        mt: 4,
        backgroundColor: 'background.paper',
      }}
    >
      <Typography
        variant="h5"
        sx={{
          fontWeight: 'bold',
          mb: 3,
          color: 'text.primary',
        }}
      >
        Withdraw Balances
      </Typography>

      {/* From Section */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h6"
          gutterBottom
          sx={{
            color: 'text.secondary',
            mb: 2,
          }}
        >
          From
        </Typography>

        <RadioGroup
          row
          value={fromMethod}
          onChange={(e) => setFromMethod(e.target.value as FromMethod)}
          sx={{ gap: 3, mb: 2 }}
        >
          <FormControlLabel
            value="existing"
            control={<Radio color="secondary" />}
            label="Existing Wallet"
            sx={{ marginRight: 4 }}
          />
          <FormControlLabel
            value="manual"
            control={<Radio color="secondary" />}
            label="Manual Private Key"
            sx={{ marginRight: 4 }}
          />
          <FormControlLabel value="set" control={<Radio color="secondary" />} label="Wallet Set" />
        </RadioGroup>

        {fromMethod === 'existing' && (
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel
              shrink
              sx={{
                backgroundColor: 'background.paper',
                px: 1,
                transform: 'translate(14px, -6px)',
              }}
            >
              Select Wallet
            </InputLabel>
            <Select
              fullWidth
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              sx={{ mt: 1 }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    maxHeight: 200,
                    mt: 1,
                  },
                },
              }}
              disabled={wallets.length === 0} // Блокируем, если нет кошельков
            >
              {wallets.length > 0 ? (
                wallets.map((wallet) => (
                  <MenuItem key={wallet.publicKey} value={wallet.privateKey} sx={{ py: 1 }}>
                    <Typography variant="body2">{wallet.publicKey}</Typography>
                  </MenuItem>
                ))
              ) : (
                <MenuItem disabled>No wallets available</MenuItem>
              )}
            </Select>
          </FormControl>
        )}

        {fromMethod === 'manual' && (
          <TextField
            fullWidth
            label="Private Key"
            value={manualKey}
            onChange={(e) => setManualKey(e.target.value)}
            sx={{ mt: 2 }}
            InputLabelProps={{
              shrink: true,
              sx: { backgroundColor: 'background.paper', px: 1 },
            }}
          />
        )}

        {fromMethod === 'set' && (
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel
              shrink
              sx={{
                backgroundColor: 'background.paper',
                px: 1,
                transform: 'translate(14px, -6px)',
              }}
            >
              Select Set
            </InputLabel>
            <Select value={setName} onChange={(e) => setSetName(e.target.value)} sx={{ mt: 1 }}>
              {walletSets.map((name) => (
                <MenuItem key={name} value={name} sx={{ py: 1 }}>
                  <Typography variant="body2">{name}</Typography>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* To Section */}
      <Box sx={{ mt: 4 }}>
        <Typography
          variant="h6"
          gutterBottom
          sx={{
            color: 'text.secondary',
            mb: 2,
          }}
        >
          To
        </Typography>

        <RadioGroup
          row
          value={toMethod}
          onChange={(e) => setToMethod(e.target.value as ToMethod)}
          sx={{ gap: 3, mb: 2 }}
        >
          <FormControlLabel
            value="existing"
            control={<Radio color="secondary" />}
            label="Existing Wallet"
            sx={{ marginRight: 4 }}
          />
          <FormControlLabel
            value="manual"
            control={<Radio color="secondary" />}
            label="Manual Address"
          />
        </RadioGroup>

        {toMethod === 'existing' ? (
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel
              shrink
              sx={{
                backgroundColor: 'background.paper',
                px: 1,
                transform: 'translate(14px, -6px)',
              }}
            >
              Select Recipient
            </InputLabel>
            <Select
              fullWidth
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              sx={{ mt: 1 }}
              disabled={wallets.length === 0} // Блокируем, если нет кошельков
            >
              {wallets.length > 0 ? (
                wallets.map((wallet) => (
                  <MenuItem key={wallet.publicKey} value={wallet.publicKey} sx={{ py: 1 }}>
                    <Typography variant="body2">{wallet.publicKey}</Typography>
                  </MenuItem>
                ))
              ) : (
                <MenuItem disabled>No wallets available</MenuItem>
              )}
            </Select>
          </FormControl>
        ) : (
          <TextField
            fullWidth
            label="Recipient Address"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            sx={{ mt: 1 }}
            InputLabelProps={{
              shrink: true,
              sx: { backgroundColor: 'background.paper', px: 1 },
            }}
          />
        )}
      </Box>

      <Button
        variant="contained"
        color="secondary"
        onClick={handleWithdraw}
        sx={{
          mt: 4,
          px: 4,
          py: 1.5,
          fontSize: '1rem',
          fontWeight: 600,
        }}
        fullWidth
      >
        Withdraw All
      </Button>
    </Box>
  );
}
