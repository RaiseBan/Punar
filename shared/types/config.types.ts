import { WalletSet } from './wallet.types';

/**
 * Настройки приложения
 */
export interface AppSettings {
  // Directories
  walletsSet?: WalletSet;
  scriptDirectory?: string;
  mevBotDirectory?: string;

  // RPC endpoints
  mainRpc?: string;
  additionalRpc?: string;
  heliusRpcs?: string[];

  // API tokens
  tensor_api_token?: string;
  bloxroute_api_token?: string;

  // Thor streamer
  thor_streamer_address?: string;
  thor_streamer_token?: string;

  // MEV settings
  migration_wallet?: string;
  jito_lower_bound?: string;
  jito_upper_bound?: string;
  compute_unit_limit?: string;

  // Network settings
  proxy_server_ip?: string;
  proxy_server_port?: number;
  primary_ip?: string;
  requests_per_second?: number;
  token_release_port?: number;

  // Process management
  delay_between_nodes?: string;
  min_process_age_for_cleanup?: string;
  processes_check_interval?: string;
}

/**
 * Тип конфигурации
 */
export type ConfigType = 'reprice_config' | 'snipe_config';

/**
 * Файл конфигурации
 */
export interface ConfigFile {
  name: string;
  path: string;
  content?: unknown;
}
