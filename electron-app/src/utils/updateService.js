const {getCollectionAddress} = require("./solanaUtils");
const TensorAPI = require("./TensorAPI");


/**
 * Обновляет collection_id в конфиге.
 */

async function updateConfigCollectionId(config) {
    const collectionUrl = config.collection_id;
    const slug = collectionUrl.split("/").pop() || "";

    const tensorApi = TensorAPI.getInstance();


    const collId = await getCollIdBySlug(slug);
    console.log(`collId: ${ collId }`);

    if (!collId) {
        console.error("Collection ID not found!");
        return config;
    }

    const nftData = await tensorApi.fetchCollectionNfts(collId).send();
    console.log(`nftData: ${nftData}`);
    if (!nftData) {
        console.error("Error fetching NFT data.");
        return config;
    }

    const mint = nftData.mints[0].mint;
    const collectionAddress = await getCollectionAddress(mint);

    console.log(`collectionAddress: ${collectionAddress}`);

    // Обновляем collection_id в конфиге
    return { ...config, collection_id: collectionAddress };
}

async function getCollIdBySlug(slug) {
    const tensorApi = TensorAPI.getInstance();
    console.log(tensorApi);
    const result = await tensorApi.fetchCollections(slug).send();
    // console.log(JSON.stringify(result, null, 2));
    const collection = result.collections.find(col => col.slugDisplay === slug);
    return collection.collId;
}

module.exports = { updateConfigCollectionId, getCollIdBySlug };
