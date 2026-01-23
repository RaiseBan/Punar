export interface WalletInfo {
    name: string;
    publicKey: string;
    privateKey: string;
  }
  
  export interface AppSettings {
    // RPC настройки
    mainRpc: string;
    heliusRpcs: string[];
    
    // API токены
    tensor_api_token: string;
    thor_streamer_address?: string;
    thor_streamer_token?: string;
    
    // Telegram
    telegramBotToken?: string;
    telegramChatIds?: number[];
    
    // Wallets
    walletsSet: Record<string, WalletInfo[]>;
    
  }