import { WalletSet } from './wallet.types';

export interface AppSettings {
  walletsSet?: WalletSet;
  scriptDirectory?: string;
  mevBotDirectory?: string;

  // RPC - mainRpc и heliusRpcs обязательные для работы
  mainRpc: string;  // ✅ УБРАЛИ ? - теперь обязательный
  additionalRpc?: string;
  heliusRpcs: string[];  // ✅ УБРАЛИ ? - массив обязательный (может быть пустым)

  // API Tokens - обязательные
  tensor_api_token: string;  // ✅ УБРАЛИ ? - обязательный
  bloxroute_api_token?: string;

  // Thor Streamer
  thor_streamer_address?: string;
  thor_streamer_token?: string;

  // Solana addresses - ДОБАВИЛИ lookupOwner
  lookupOwner?: string;  // ✅ ДОБАВИЛИ
  migration_wallet?: string;

  // Jito settings - ДОБАВИЛИ недостающие
  jito_strategy?: string;  // ✅ ДОБАВИЛИ
  jito_lower_bound?: string;
  jito_upper_bound?: string;
  tx_count?: string;  // ✅ ДОБАВИЛИ
  compute_unit_limit?: string;

  // Network
  proxy_server_ip?: string;
  proxy_server_port?: number;
  primary_ip?: string;
  requests_per_second?: number;
  token_release_port?: number;

  // Timing
  delay_between_nodes?: string;
  min_process_age_for_cleanup?: string;
  processes_check_interval?: string;

  // Telegram settings
  telegramToken?: string;
  telegramEnabled?: boolean;
  telegramChatIds?: number[];
}

export type ConfigType = 'reprice_config' | 'snipe_config';

export interface ConfigFile {
  name: string;
  path: string;
  content?: unknown;
}