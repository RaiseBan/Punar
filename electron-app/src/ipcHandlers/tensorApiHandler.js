
const TensorAPI = require("../utils/TensorAPI");
const {getCollIdBySlug} = require("../utils/updateService");

function initializeApiHandlers(ipcMain) {
    ipcMain.handle("get-collectionInfo", async (_, slug) => {
        try {
            console.log(`Fetching collection ID for slug: ${slug}`);
            const tensorApi = TensorAPI.getInstance();
            return await tensorApi.fetchCollections(slug).send();
        } catch (error) {
            console.error("Ошибка при получении collectionId:", error);
            return null;
        }
    });

    ipcMain.handle("get-collIdByUrl", async (_, url) => {
        try {
            // console.log(`Fetching collection ID for slug: ${slug}`);
            const slug = url.split("/").pop() || "";
            console.log(slug)
            return await getCollIdBySlug(slug);
        } catch (error) {
            console.error("Ошибка при получении collectionId:", error);
            return null;
        }
    });

    ipcMain.handle("get-nftsForCollection", async (_, collId, limit = 1, onlyListings = false) => {
        try {
            console.log(`Fetching NFTs for collection: ${collId}`);
            const tensorApi = TensorAPI.getInstance();
            return await tensorApi.fetchCollectionNfts(collId, limit, onlyListings).send();
        } catch (error) {
            console.error("Ошибка при получении NFT:", error);
            return null;
        }
    });
    ipcMain.handle("get-txHistory", async (_, params) => {
        try {
            console.log(`Fetching TX history for: ${params.collId}`);
            const tensorApi = TensorAPI.getInstance();
            return await tensorApi
                .fetchTxHistory({
                    collId: "a2e9e503-b8d5-4024-8837-538c5b879ec4",//params.collId,
                    limit: params.limit,
                    txTypes: params.txTypes,
                    minPrice: params.minPrice,
                    maxPrice: params.maxPrice,
                    traits: params.traits,
                    wallet: params.wallet,
                    cursor: params.cursor
                })
                .send();
        } catch (error) {
            console.error("Ошибка при получении истории транзакций:", error);
            return null;
        }
    });

}

module.exports = { initializeApiHandlers };
