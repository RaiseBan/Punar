import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import { Visibility, VisibilityOff, Delete } from '@mui/icons-material';
import { styled } from '@mui/system';

interface Wallet {
  publicKey: string;
  privateKey: string;
}

interface Props {
  wallets: Wallet[];
  onCreateWallet: () => void;
  onImportWallet: () => void;
  onDeleteWallet: (publicKey: string) => void;
  isLoading?: boolean;
}

const StyledButton = styled(Button)({
  backgroundColor: '#FF5722',
  color: '#fff',
  padding: '10px 20px',
  '&:hover': {
    backgroundColor: '#E64A19',
    transform: 'scale(1.05)',
  },
});

export const SingleWalletsList: React.FC<Props> = ({
  wallets,
  onCreateWallet,
  onImportWallet,
  onDeleteWallet,
  isLoading,
}) => {
  const [showPrivateKey, setShowPrivateKey] = useState<number | null>(null);

  const toggleShowPrivateKey = (index: number) => {
    setShowPrivateKey((prev) => (prev === index ? null : index));
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Single Wallets
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Box display="flex" justifyContent="space-between" marginBottom={2}>
        <StyledButton onClick={onCreateWallet} disabled={isLoading}>
          Generate
        </StyledButton>
        <StyledButton onClick={onImportWallet} disabled={isLoading}>
          Import
        </StyledButton>
      </Box>

      <List>
        {wallets.length > 0 ? (
          wallets.map((wallet, index) => (
            <ListItem
              key={wallet.publicKey}
              sx={{
                border: '1px solid #ccc',
                borderRadius: '8px',
                marginBottom: '10px',
                padding: '10px',
              }}
            >
              <ListItemText
                primary={`Public Key: ${wallet.publicKey}`}
                secondary={
                  <Box display="flex" alignItems="center">
                    <span style={{ marginRight: '10px' }}>Private Key: </span>
                    {showPrivateKey === index ? (
                      <span>{wallet.privateKey}</span>
                    ) : (
                      <span>{'*'.repeat(44)}</span>
                    )}
                  </Box>
                }
              />
              <IconButton onClick={() => toggleShowPrivateKey(index)}>
                {showPrivateKey === index ? <VisibilityOff /> : <Visibility />}
              </IconButton>
              <IconButton
                edge="end"
                aria-label="delete"
                onClick={() => onDeleteWallet(wallet.publicKey)}
              >
                <Delete />
              </IconButton>
            </ListItem>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            No wallets available
          </Typography>
        )}
      </List>
    </Box>
  );
};