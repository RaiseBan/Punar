
const TensorAPI = require("../utils/TensorAPI");

function initializeApiHandlers(ipcMain) {
    ipcMain.handle("get-collectionInfo", async (_, slug) => {
        try {
            console.log(`Fetching collection ID for slug: ${slug}`);
            const tensorApi = TensorAPI.getInstance();
            return await tensorApi.fetchCollectionId(slug).send();
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
}

module.exports = { initializeApiHandlers };
