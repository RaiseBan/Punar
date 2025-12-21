import { WalletSet } from './wallet.types';

export interface AppSettings {

  walletsSet?: WalletSet;
  scriptDirectory?: string;
  mevBotDirectory?: string;

  mainRpc?: string;
  additionalRpc?: string;
  heliusRpcs?: string[];

  tensor_api_token?: string;
  bloxroute_api_token?: string;

  thor_streamer_address?: string;
  thor_streamer_token?: string;

  migration_wallet?: string;
  jito_lower_bound?: string;
  jito_upper_bound?: string;
  compute_unit_limit?: string;

  proxy_server_ip?: string;
  proxy_server_port?: number;
  primary_ip?: string;
  requests_per_second?: number;
  token_release_port?: number;

  delay_between_nodes?: string;
  min_process_age_for_cleanup?: string;
  processes_check_interval?: string;
}

export type ConfigType = 'reprice_config' | 'snipe_config';

export interface ConfigFile {
  name: string;
  path: string;
  content?: unknown;
}
