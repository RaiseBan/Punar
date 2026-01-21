import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useToolsTransaction } from '../../hooks/useToolsTransaction';
import { FromSection } from './FromSection';
import { ToSection } from './ToSection';
import WithdrawBalances from '../WithdrawBalances';

export default function Tools() {
  const {
    wallets,
    walletSets,
    rpcUrl,
    fromMethod,
    fromSelectedPrivateKey,
    fromManualPrivateKey,
    setFromMethod,
    setFromSelectedPrivateKey,
    setFromManualPrivateKey,
    toMethod,
    toSelectedPubKey,
    toManualPubKey,
    toSelectedSetName,
    setToMethod,
    setToSelectedPubKey,
    setToManualPubKey,
    setToSelectedSetName,
    amount,
    handleAmountChange,
    isLoading,
    snackbarOpen,
    snackbarMessage,
    snackbarSeverity,
    closeSnackbar,
    showSnackbar,  // Добавлено!
    validation,
    handleSendTransaction,
  } = useToolsTransaction();

  const amountState = validation.getFieldState('amount');

  return (
    <Box sx={{ p: 3, maxWidth: 800, margin: '0 auto' }}>
      <Typography variant="h4" gutterBottom>
        Send SOL
      </Typography>

      <Box sx={{ mt: 3 }}>
        {/* From Section */}
        <FromSection
          fromMethod={fromMethod}
          onMethodChange={setFromMethod}
          selectedPrivateKey={fromSelectedPrivateKey}
          onSelectPrivateKey={setFromSelectedPrivateKey}
          manualPrivateKey={fromManualPrivateKey}
          onManualPrivateKeyChange={setFromManualPrivateKey}
          wallets={wallets}
          validation={validation}
        />

        {/* To Section */}
        <ToSection
          toMethod={toMethod}
          onMethodChange={setToMethod}
          selectedPublicKey={toSelectedPubKey}
          onSelectPublicKey={setToSelectedPubKey}
          manualPublicKey={toManualPubKey}
          onManualPublicKeyChange={setToManualPubKey}
          selectedSetName={toSelectedSetName}
          onSelectSetName={setToSelectedSetName}
          wallets={wallets}
          walletSets={walletSets}
          validation={validation}
        />

        {/* Amount */}
        <Box mt={4}>
          <TextField
            fullWidth
            label="Amount (SOL)"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            onBlur={() => validation.handleBlur('amount', amount)}
            error={amountState.touched && !!amountState.error}
            helperText={amountState.touched ? amountState.error : 'Amount per wallet in SOL'}
            type="text"
            inputProps={{ inputMode: 'decimal' }}
          />
        </Box>

        {/* Send Button */}
        <Box mt={4}>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleSendTransaction}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : 'Send Transaction'}
          </Button>
        </Box>
      </Box>

      {/* WithdrawBalances Component */}
      <Box sx={{ mt: 6 }}>
        <WithdrawBalances
          wallets={wallets}
          walletSets={walletSets}
          rpcUrl={rpcUrl}
          onStatusUpdate={(message, severity) => {
            showSnackbar(message, severity);
          }}
          onLoading={(loading) => {
            // isLoading управляется внутри хука useToolsTransaction
          }}
        />
      </Box>

      {/* Snackbar */}
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={closeSnackbar}>
        <Alert onClose={closeSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}