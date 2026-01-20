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
  Collapse,
} from '@mui/material';
import { Visibility, VisibilityOff, Delete, Add, ExpandMore, ExpandLess } from '@mui/icons-material';

interface Wallet {
  publicKey: string;
  privateKey: string;
}

interface WalletSet {
  [setName: string]: Wallet[];
}

interface Props {
  walletSets: WalletSet;
  onCreateSet: () => void;
  onGenerateSet: () => void;
  onDeleteSet: (setName: string) => void;
  onGenerateWallet: (setName: string) => void;
  onImportWallet: (setName: string) => void;
  onDeleteWallet: (setName: string, publicKey: string) => void;
  isLoading?: boolean;
}

export const WalletSetsList: React.FC<Props> = ({
  walletSets,
  onCreateSet,
  onGenerateSet,
  onDeleteSet,
  onGenerateWallet,
  onImportWallet,
  onDeleteWallet,
  isLoading,
}) => {
  const [expandedSets, setExpandedSets] = useState<{ [key: string]: boolean }>({});
  const [showPrivateKey, setShowPrivateKey] = useState<{
    [setName: string]: number | null;
  }>({});

  const toggleExpand = (setName: string) => {
    setExpandedSets((prev) => ({
      ...prev,
      [setName]: !prev[setName],
    }));
  };

  const toggleShowPrivateKey = (setName: string, index: number) => {
    setShowPrivateKey((prev) => ({
      ...prev,
      [setName]: prev[setName] === index ? null : index,
    }));
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Wallets Set (LMNFT)
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Box display="flex" gap={2} mb={2}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onCreateSet}
          disabled={isLoading}
        >
          Create Set (manually)
        </Button>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onGenerateSet}
          disabled={isLoading}
        >
          Generate Set (auto)
        </Button>
      </Box>

      <List>
        {Object.keys(walletSets).map((setName) => {
          const wset = walletSets[setName] || [];
          const isExpanded = expandedSets[setName] || false;

          return (
            <Box key={setName} mb={2}>
              <ListItem
                sx={{
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
                onClick={() => toggleExpand(setName)}
              >
                <ListItemText
                  primary={`${setName} (${wset.length} wallets)`}
                />
                <IconButton
                  edge="end"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSet(setName);
                  }}
                >
                  <Delete />
                </IconButton>
                {isExpanded ? <ExpandLess /> : <ExpandMore />}
              </ListItem>

              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Box sx={{ pl: 4, pr: 2, pt: 2 }}>
                  <Box display="flex" gap={1} mb={2}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onGenerateWallet(setName)}
                    >
                      Generate Wallet
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onImportWallet(setName)}
                    >
                      Import Wallet
                    </Button>
                  </Box>

                  <List>
                    {wset.length > 0 ? (
                      wset.map((wallet, index) => (
                        <ListItem
                          key={wallet.publicKey}
                          sx={{
                            border: '1px solid #e0e0e0',
                            borderRadius: '4px',
                            mb: 1,
                            p: 1,
                          }}
                        >
                          <ListItemText
                            primary={`PubKey: ${wallet.publicKey}`}
                            secondary={
                              <Box display="flex" alignItems="center">
                                <span style={{ marginRight: '10px' }}>
                                  PrivKey:{' '}
                                </span>
                                {showPrivateKey[setName] === index ? (
                                  <span>{wallet.privateKey}</span>
                                ) : (
                                  <span>{'*'.repeat(44)}</span>
                                )}
                              </Box>
                            }
                          />
                          <IconButton
                            size="small"
                            onClick={() => toggleShowPrivateKey(setName, index)}
                          >
                            {showPrivateKey[setName] === index ? (
                              <VisibilityOff />
                            ) : (
                              <Visibility />
                            )}
                          </IconButton>
                          <IconButton
                            size="small"
                            edge="end"
                            onClick={() => onDeleteWallet(setName, wallet.publicKey)}
                          >
                            <Delete />
                          </IconButton>
                        </ListItem>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No wallets in this set
                      </Typography>
                    )}
                  </List>
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </List>
    </Box>
  );
};