export interface Wallet {
    publicKey: string;
    privateKey: string;
  }
  export interface EncryptedWallet {
    publicKey: string;
    encryptedPrivateKey: string;
  }

  export interface WalletSet {
    [setName: string]: Wallet[];
  }

  export type WalletSource = 'existing' | 'manual';

  export interface WalletSelection {
    source: WalletSource;
    publicKey?: string;
    privateKey?: string;
    setName?: string;
  }