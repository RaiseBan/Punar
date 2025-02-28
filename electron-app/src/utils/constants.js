const {getSettings} = require("./fsHelper");
const {Connection, clusterApiUrl} = require("@solana/web3.js");
const {Metaplex} = require("@metaplex-foundation/js");



const TENSOR_ENDPOINTS = Object.freeze({
    SEARCH_COLLECTION: "https://api.mainnet.tensordev.io/api/v1/collections/search_collections",
    NFTS_BY_COLLECTION: "https://api.mainnet.tensordev.io/api/v1/mint/collection",
});

const connection = new Connection(getSettings().main_rpc || clusterApiUrl("mainnet-beta"));

const metaplex = Metaplex.make(connection);

module.exports = { TENSOR_ENDPOINTS, connection, metaplex };