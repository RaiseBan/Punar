import React from "react";

export interface ModuleItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    isDisabled?: boolean;
}

export interface Wallet {
    publicKey: string;
    privateKey: string;
}

// Параметры для "Tensor sniper (SDK)" и "Tensor reprice"
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
    walletSource: 'existing' | 'manual'; // уже было
    privateKey: string; // уже было
}

// ------------------------
// ПАРАМЕТРЫ НОВОГО МОДУЛЯ LAUNCH_MY_NFT
export interface LaunchMyNftParams {
    target_url: string;
    total_priority_fee: number;
    compute_unit_limit: number;
    useJito: boolean;
    // jito_tip_account: string;
    jito_tip_amount: number;
    jito_region: string;
    delay_when_sending: number;
    delay_before_sending: number;
    nfts_to_buy_per_account: number;

    // Логика выбора кошельков:
    // 1) "single"  или  "set"
    walletApproach: 'single' | 'set';

    // Если single → user может выбрать "existing" или "manual"
    singleWalletMethod: 'existing' | 'manual';

    // Если single + existing → privateKey берём из списка, а сюда сохраняем publicKey
    selectedWalletPublicKey: string;

    // Если single + manual → вводим вручную
    manualPrivateKey: string;

    // Если set → пользователь выбирает имя сета
    chosenSetName: string;
}
export interface MevParams {
    volumeThreshold: number;
    checkInterval: number;
    maxAttempts: number;
    threadWorkers: number;
    walletSource: "existing" | "manual";
    privateKey: string;
    mode: "manual" | "automatic";
    default_bound: number;
}
export interface MeteoraParams {
    accounts: string[];
    useJito: boolean;
    jitoRegion: string;
    jitoTipAmount: number;
    strategy: string;
    walletSource: "existing" | "manual";
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