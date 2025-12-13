import { WalletSource } from './wallet.types';

export interface ModuleItem {
  id: string;
  label: string;
  icon?: string;
  isDisabled?: boolean;
}

// Tensor sniper (SDK) и Tensor reprice
export interface TensorSdkParams {
  collectionId: string;
  priceByName: boolean;
  priceConfig: string;
  thresholdPrice: number;
  useJito: boolean;
  jitoRegion: string;
  jitoTipLamports: number;
  useBloxroute: boolean;
  bloxrouteRegion: string;
  bloxrouteTipLamports: number;
  delta: number;
  txToSend: number;
  walletSource: WalletSource;
  privateKey: string;
}

// Launch My NFT
export interface LaunchMyNftParams {
  target_url: string;
  total_priority_fee: number;
  compute_unit_limit: number;
  useJito: boolean;
  jito_tip_amount: number;
  jito_region: string;
  delay_when_sending: number;
  delay_before_sending: number;
  nfts_to_buy_per_account: number;
  walletApproach: 'single' | 'set';
  singleWalletMethod: WalletSource;
  selectedWalletPublicKey: string;
  manualPrivateKey: string;
  chosenSetName: string;
}

// MEV
export interface MevParams {
  volumeThreshold: number;
  checkInterval: number;
  maxAttempts: number;
  threadWorkers: number;
  walletSource: WalletSource;
  privateKey: string;
  mode: 'manual' | 'automatic' | 'by_telegram_bot';
  default_bound: number;
  globalStrategy: string;
}

// Meteora
export interface MeteoraParams {
  accounts: string[];
  useJito: boolean;
  jitoRegion: string;
  jitoTipAmount: number;
  strategy: string;
  walletSource: WalletSource;
  privateKey: string;
  additionalParams: {
    CONFIRMATION_TIMEOUT: number;
    MAX_TX_ATTEMPTS: number;
    SLIPPAGE: number;
    ADDITIONAL_FEE_ON_FAILED: number;
    FEE_ADD_LIQUIDITY: number;
    FEE_CLAIM_FEE: number;
    FEE_REMOVE_LIQUIDITY: number;
    FEE_CREATE_POSITION: number;
  };
}

export type ModuleParams = TensorSdkParams | LaunchMyNftParams | MevParams | MeteoraParams;