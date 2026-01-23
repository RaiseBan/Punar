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

interface ToSectionProps {
  toMethod: 'existing' | 'manual' | 'set';
  onMethodChange: (method: 'existing' | 'manual' | 'set') => void;
  selectedPublicKey: string;
  onSelectPublicKey: (value: string) => void;
  manualPublicKey: string;
  onManualPublicKeyChange: (value: string) => void;
  selectedSetName: string;
  onSelectSetName: (value: string) => void;
  wallets: Wallet[];
  walletSets: string[];
  validation: {
    getFieldState: (field: string) => { touched: boolean; error: string | null };
    handleBlur: (field: string, value: unknown) => void;
  };
}

export const ToSection: React.FC<ToSectionProps> = ({
  toMethod,
  onMethodChange,
  selectedPublicKey,
  onSelectPublicKey,
  manualPublicKey,
  onManualPublicKeyChange,
  selectedSetName,
  onSelectSetName,
  wallets,
  walletSets,
  validation,
}) => {
  const toPubKeyState = validation.getFieldState('toManualPubKey');

  return (
    <Box>
      <Typography variant="h6" sx={{ mt: 4 }}>
        To
      </Typography>

      <FormControl component="fieldset">
        <RadioGroup
          row
          value={toMethod}
          onChange={(e) => onMethodChange(e.target.value as 'existing' | 'manual' | 'set')}
        >
          <FormControlLabel value="existing" control={<Radio />} label="Existing wallet" />
          <FormControlLabel value="manual" control={<Radio />} label="Manual public key" />
          <FormControlLabel value="set" control={<Radio />} label="Wallet set" />
        </RadioGroup>
      </FormControl>

      {toMethod === 'existing' && (
        <Box mt={2}>
          <FormControl fullWidth>
            <InputLabel>Choose wallet (To)</InputLabel>
            <Select
              value={selectedPublicKey}
              onChange={(e) => onSelectPublicKey(e.target.value)}
              disabled={wallets.length === 0}
            >
              {wallets.length > 0 ? (
                wallets.map((wallet) => (
                  <MenuItem key={wallet.publicKey} value={wallet.publicKey}>
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

      {toMethod === 'manual' && (
        <Box mt={2}>
          <TextField
            fullWidth
            label="To: public key"
            value={manualPublicKey}
            onChange={(e) => onManualPublicKeyChange(e.target.value)}
            onBlur={() => validation.handleBlur('toManualPubKey', manualPublicKey)}
            error={toPubKeyState.touched && !!toPubKeyState.error}
            helperText={toPubKeyState.touched ? toPubKeyState.error : ''}
          />
        </Box>
      )}

      {toMethod === 'set' && (
        <Box mt={2}>
          <FormControl fullWidth>
            <InputLabel>Choose wallet set</InputLabel>
            <Select
              value={selectedSetName}
              onChange={(e) => onSelectSetName(e.target.value)}
              disabled={walletSets.length === 0}
            >
              {walletSets.length > 0 ? (
                walletSets.map((setName) => (
                  <MenuItem key={setName} value={setName}>
                    {setName}
                  </MenuItem>
                ))
              ) : (
                <MenuItem disabled>No wallet sets available</MenuItem>
              )}
            </Select>
          </FormControl>
        </Box>
      )}
    </Box>
  );
};
