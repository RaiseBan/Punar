import { ChildProcess } from "child_process";

export interface AppSettings {
    scriptDirectory?: string;
    mevBotDirectory?: string;
    mainRpc?: string;
    additionalRpc?: string;
    heliusRpcs?: string[];
    tensor_api_token?: string;
    bloxroute_api_token?: string;

    delay_between_nodes?: string;

    // mev
    migration_wallet?: string;
    jito_lower_bound?: string;
    jito_upper_bound?: string;
    compute_unit_limit?: string;


    proxy_server_ip?: string;
    proxy_server_port?: number;
    primary_ip?: string;
    requests_per_second?: number;
    token_release_port?: number;

    min_process_age_for_cleanup?: string;
    processes_check_interval?: string;



    thor_streamer_address?: string;
    thor_streamer_token?: string;
}



export interface Signal {
    tokenAddress: string;
    meteoraPool: string;
    pumpSwapPool?: string;
    raydiumPool?: string;
    meteoraDAMMPool?: string;
    type: string;

    timestamp: number;
}
export interface SignalWithMeta extends Signal{
    sourceProcessId: string;
    addedTime: number;
}

export type ProcessConfig = {
    tokenAddress: string;
    meteoraPool: string;
    pumpSwapPool?: string;
    raydiumPool?: string;
    dammMeteoraPool?: string;
    // Raydium pools:
    type: string;

    main_rpc: string;
    useJito: boolean;
    jito_lower_bound: number;
    jito_upper_bound: number;
    process_delay: number | null;
    task_name: string;
}

// В файле с определением типов:
export interface MevProcess {
    id?: string;
    pid: number;
    tokenAddress: string;
    meteoraPool: string;
    pumpSwapPool: string;
    process?: ChildProcess;
    startTime: number;
    initialCreationTime?: number;
    status: 'running' | 'stopped' | 'error' | 'completed';
    lastActivity: number;
    signals: any;
    config?: ProcessConfig;
    exitCode?: any;
    exitTime?: number;
    processTimer?: any;
    instanceNumber?: number;
    signalId?: string; // Новое поле для группировки процессов
}
export type CheckResult = {
    pool: string,
    verdict: boolean,
}

export enum RAYDIUM_TYPE {
    CLMM = 'CLMM',
    CPMM = 'CPMM',
    V4 = 'V4'
}

