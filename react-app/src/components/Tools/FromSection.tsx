import React from 'react';
import {
  Box,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  TextField,
  Select,
  MenuItem,
  InputLabel,
} from '@mui/material';

interface Wallet {
  publicKey: string;
  privateKey: string;
}

interface FromSectionProps {
  fromMethod: 'existing' | 'manual';
  onMethodChange: (method: 'existing' | 'manual') => void;
  selectedPrivateKey: string;
  onSelectPrivateKey: (value: string) => void;
  manualPrivateKey: string;
  onManualPrivateKeyChange: (value: string) => void;
  wallets: Wallet[];
  validation: any;
}

export const FromSection: React.FC<FromSectionProps> = ({
  fromMethod,
  onMethodChange,
  selectedPrivateKey,
  onSelectPrivateKey,
  manualPrivateKey,
  onManualPrivateKeyChange,
  wallets,
  validation,
}) => {
  const fromPrivKeyState = validation.getFieldState('fromManualPrivateKey');

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
        From
      </Typography>
      
      <FormControl component="fieldset">
        <RadioGroup
          row
          value={fromMethod}
          onChange={(e) => onMethodChange(e.target.value as 'existing' | 'manual')}
        >
          <FormControlLabel value="existing" control={<Radio />} label="Existing wallet" />
          <FormControlLabel value="manual" control={<Radio />} label="Manual private key" />
        </RadioGroup>
      </FormControl>

      {fromMethod === 'existing' && (
        <Box mt={2}>
          <FormControl fullWidth>
            <InputLabel>Choose wallet (From)</InputLabel>
            <Select
              value={selectedPrivateKey}
              onChange={(e) => onSelectPrivateKey(e.target.value)}
              disabled={wallets.length === 0}
            >
              {wallets.length > 0 ? (
                wallets.map((wallet) => (
                  <MenuItem key={wallet.publicKey} value={wallet.privateKey}>
                    {wallet.publicKey}
                  </MenuItem>
                ))
              ) : (
                <MenuItem disabled>No wallets available</MenuItem>
              )}
            </Select>
          </FormControl>
        </Box>
      )}

      {fromMethod === 'manual' && (
        <Box mt={2}>
          <TextField
            fullWidth
            label="From: private key"
            value={manualPrivateKey}
            onChange={(e) => onManualPrivateKeyChange(e.target.value)}
            onBlur={() => validation.handleBlur('fromManualPrivateKey', manualPrivateKey)}
            error={fromPrivKeyState.touched && !!fromPrivKeyState.error}
            helperText={fromPrivKeyState.touched ? fromPrivKeyState.error : ''}
          />
        </Box>
      )}
    </Box>
  );
};