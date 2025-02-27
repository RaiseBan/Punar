const { getSettings } = require("../index");
const {getCollectionAddress} = require("./solanaUtils");

const SEARCH_COLLECTION_URL = "https://api.mainnet.tensordev.io/api/v1/collections/search_collections";
const COLL_NFTS_URL = "https://api.mainnet.tensordev.io/api/v1/mint/collection";

/**
 * Выполняет GET-запрос к указанному URL с заголовками.
 */
async function fetchFromApi(url, token) {
    const options = {
        method: "GET",
        headers: {
            accept: "application/json",
            "x-tensor-api-key": token,
        },
    };

    const response = await fetch(url, options);
    if (!response.ok) {
        console.error(`Ошибка запроса: ${response.status} ${response.statusText}`);
        return null;
    }

    return response.json();
}

/**
 * Получает идентификатор коллекции по slug.
 */
async function getCollectionId(slug, token) {
    const params = new URLSearchParams({ query: slug });
    const url = `${SEARCH_COLLECTION_URL}?${params.toString()}`;

    const result = await fetchFromApi(url, token);
    if (!result || !result.collections) {
        console.error("No such collection!");
        return null;
    }

    const collection = result.collections.find(col => col.slugDisplay === slug);
    return collection ? collection.collId : null;
}

/**
 * Получает информацию о NFT в коллекции.
 */
async function getCollectionNfts(collId, token) {
    const params = new URLSearchParams({
        collId,
        sortBy: "ListingPriceAsc",
        limit: "1",
        onlyListings: "false",
    });

    const url = `${COLL_NFTS_URL}?${params.toString()}`;
    return fetchFromApi(url, token);
}

/**
 * Обновляет collection_id в конфиге.
 */
async function updateConfigCollectionId(config) {
    const collectionUrl = config.collection_id;
    const lastPart = collectionUrl.split("/").pop() || "";

    const { tensor_api_token: TOKEN } = getSettings();

    const collId = await getCollectionId(lastPart, TOKEN);
    if (!collId) {
        console.error("Collection ID not found!");
        return config;
    }

    const nftData = await getCollectionNfts(collId, TOKEN);
    if (!nftData) {
        console.error("Error fetching NFT data.");
        return config;
    }

    const mint = nftData.mints[0].mint;
    const collectionAddress = getCollectionAddress(mint);

    console.log(collectionAddress);

    // Обновляем collection_id в конфиге
    return { ...config, collection_id: collectionAddress };
}

module.exports = { updateConfigCollectionId };
