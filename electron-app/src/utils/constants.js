
const TENSOR_ENDPOINTS = Object.freeze({
    SEARCH_COLLECTION: "https://api.mainnet.tensordev.io/api/v1/collections/search_collections",
    NFTS_BY_COLLECTION: "https://api.mainnet.tensordev.io/api/v1/mint/collection",
    TX_HISTORY: "https://api.mainnet.tensordev.io/api/v1/collections/tx_history"
});

const TX_TYPES = Object.freeze({
    LIST: "LIST",
    DELIST: "DELIST",
    REPRICE: "ADJUST_PRICE",
    PLACE_BID: "PLACE_BID",
    CANCEL_BID: "CANCEL_BID",
    SALE_BUY_NOW: "SALE_BUY_NOW",
    SALE_ACCEPT_BID: "SALE_ACCEPT_BID",



})

module.exports = { TENSOR_ENDPOINTS };