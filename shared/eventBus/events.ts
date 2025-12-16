// shared/eventBus/events.ts
export const SYSTEM_EVENTS = {
    APP_READY: 'app:ready',
    APP_SHUTDOWN: 'app:shutdown',
    ERROR_OCCURRED: 'system:error',
    WARNING_OCCURRED: 'system:warning',
  } as const;
  
  export const PROCESS_EVENTS = {
    STARTED: 'process:started',
    STOPPED: 'process:stopped',
    PAUSED: 'process:paused',
    RESUMED: 'process:resumed',
    CRASHED: 'process:crashed',
    STATS_UPDATE: 'process:stats',
  } as const;
  
  export const MODULE_EVENTS = {
    TENSOR_NFT_DETECTED: 'tensor:nft_detected',
    TENSOR_BID_PLACED: 'tensor:bid_placed',
    TENSOR_BID_WON: 'tensor:bid_won',
    
    MEV_OPPORTUNITY_FOUND: 'mev:opportunity_found',
    MEV_TRADE_EXECUTED: 'mev:trade_executed',
    MEV_POOL_UPDATED: 'mev:pool_updated',
    
    METEORA_POSITION_OPENED: 'meteora:position_opened',
    METEORA_POSITION_CLOSED: 'meteora:position_closed',
    METEORA_REBALANCE: 'meteora:rebalance',
    
    TELEGRAM_COMMAND_RECEIVED: 'telegram:command_received',
    TELEGRAM_NOTIFICATION_SENT: 'telegram:notification_sent',
  } as const;
  
  export interface SystemErrorEvent {
    code: string;
    message: string;
    details?: unknown;
    timestamp: number;
  }
  
  export interface ProcessStartedEvent {
    processId: string;
    taskId: number;
    moduleName: string;
    config: unknown;
  }
  
  export interface ProcessStatsEvent {
    processId: string;
    taskId: number;
    cpu: number;
    memory: number;
    uptime: number;
  }
  
  export interface TensorNftEvent {
    taskId: number;
    collectionSlug: string;
    nftMint: string;
    price: number;
    timestamp: number;
  }
  
  export interface MevOpportunityEvent {
    taskId: number;
    token: string;
    pool: string;
    expectedProfit: number;
    timestamp: number;
  }
  
  export interface MeteoraPositionEvent {
    taskId: number;
    positionId: string;
    pool: string;
    amount: number;
    timestamp: number;
  }
  
  export interface TelegramCommandEvent {
    chatId: number;
    userId: number;
    command: string;
    args: string[];
    timestamp: number;
  }
  
  export type EventType = 
    | typeof SYSTEM_EVENTS[keyof typeof SYSTEM_EVENTS]
    | typeof PROCESS_EVENTS[keyof typeof PROCESS_EVENTS]
    | typeof MODULE_EVENTS[keyof typeof MODULE_EVENTS];
  
  export type EventData =
    | SystemErrorEvent
    | ProcessStartedEvent
    | ProcessStatsEvent
    | TensorNftEvent
    | MevOpportunityEvent
    | MeteoraPositionEvent
    | TelegramCommandEvent
    | Record<string, unknown>;