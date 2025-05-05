import TensorAPI from "../utils/TensorAPI.js";
import { getCollIdBySlug } from "../utils/updateService.js";
import { IpcMain } from "electron";

interface TxHistoryParams {
    collId?: string;
    limit?: number;
    txTypes?: string[];
    minPrice?: number;
    maxPrice?: number;
    traits?: string[];
    wallet?: string;
    cursor?: string;
}

function initializeApiHandlers(ipcMain: IpcMain): void {
    ipcMain.handle("get-collectionInfo", async (_, slug: string) => {
        try {
            console.log(`Fetching collection ID for slug: ${slug}`);
            const tensorApi = TensorAPI.getInstance();
            return await tensorApi.fetchCollections(slug).send();
        } catch (error) {
            console.error("Ошибка при получении collectionId:", error);
            return null;
        }
    });

    ipcMain.handle("get-collIdByUrl", async (_, url: string) => {
        try {
            const slug = url.split("/").pop() || "";
            console.log(slug);
            return await getCollIdBySlug(slug);
        } catch (error) {
            console.error("Ошибка при получении collectionId:", error);
            return null;
        }
    });

    ipcMain.handle(
        "get-nftsForCollection",
        async (_, collId: string, limit: number = 1, onlyListings: boolean = false) => {
            try {
                console.log(`Fetching NFTs for collection: ${collId}`);
                const tensorApi = TensorAPI.getInstance();
                return await tensorApi.fetchCollectionNfts(collId, limit, onlyListings).send();
            } catch (error) {
                console.error("Ошибка при получении NFT:", error);
                return null;
            }
        }
    );

    ipcMain.handle("get-txHistory", async (_, params: TxHistoryParams) => {
        try {
            console.log(`Fetching TX history for: ${params.collId}`);
            const tensorApi = TensorAPI.getInstance();
            return await tensorApi
                .fetchTxHistory({
                    collId: "a2e9e503-b8d5-4024-8837-538c5b879ec4", // params.collId,
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

export { initializeApiHandlers };