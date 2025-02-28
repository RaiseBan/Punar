const {getCollectionAddress} = require("./solanaUtils");
const {TensorAPI} = require("./TensorAPI");


/**
 * Обновляет collection_id в конфиге.
 */

async function updateConfigCollectionId(config) {
    const collectionUrl = config.collection_id;
    const slug = collectionUrl.split("/").pop() || "";

    const tensorApi = TensorAPI.getInstance();

    const result = await tensorApi.fetchCollectionId(slug).send();
    console.log(JSON.stringify(result, null, 2));

    const collection = result.collections.find(col => col.slugDisplay === slug);
    const collId = collection.collId;

    if (!collId) {
        console.error("Collection ID not found!");
        return config;
    }

    const nftData = await tensorApi.fetchCollectionNfts(collId).send();
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
