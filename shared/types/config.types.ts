import { WalletSet } from './wallet.types';

export interface AppSettings {
  walletsSet?: WalletSet;
  scriptDirectory?: string;
  mainRpc?: string;
  additionalRpc?: string;
  heliusRpcs?: string[];
  tensor_api_token?: string;
  bloxroute_api_token?: string;
  thor_streamer_address?: string;
  thor_streamer_token?: string;
  mevBotDirectory?: string;
}

export type ConfigType = 'reprice_config' | 'snipe_config';

export interface ConfigFile {
  name: string;
  path: string;
  content?: unknown;
}