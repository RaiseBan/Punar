export const TENSOR_ENDPOINTS = Object.freeze({
    SEARCH_COLLECTION: "https://api.mainnet.tensordev.io/api/v1/collections/search_collections",
    NFTS_BY_COLLECTION: "https://api.mainnet.tensordev.io/api/v1/mint/collection",
    TX_HISTORY: "https://api.mainnet.tensordev.io/api/v1/collections/tx_history"
});

export const TX_TYPES = Object.freeze({
    LIST: "LIST",
    DELIST: "DELIST",
    REPRICE: "ADJUST_PRICE",
    PLACE_BID: "PLACE_BID",
    CANCEL_BID: "CANCEL_BID",
    SALE_BUY_NOW: "SALE_BUY_NOW",
    SALE_ACCEPT_BID: "SALE_ACCEPT_BID",
});

export const JIT0_REGIONS = [
    "https://slc.mainnet.block-engine.jito.wtf",
    "https://amsterdam.mainnet.block-engine.jito.wtf",
    "https://frankfurt.mainnet.block-engine.jito.wtf",
    "https://london.mainnet.block-engine.jito.wtf",
];

export const PRIMARY_IP = "94.19.186.22/32";

export const RAYDIUM_AMM_OWNER = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
export const RAYDIUM_CPMM_OWNER = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
export const METEORA_OWNER = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";