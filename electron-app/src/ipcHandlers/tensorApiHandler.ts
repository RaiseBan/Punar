import TensorAPI from '../utils/TensorAPI';
import { getCollIdBySlug } from '../utils/updateService';
import { IpcMain, IpcMainInvokeEvent } from 'electron';
import logger from "../services/loggerService";

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

export function initializeApiHandlers(ipcMain: IpcMain): void {

    ipcMain.handle(
        'get-collectionInfo',
        async (_event: IpcMainInvokeEvent, slug: string): Promise<unknown | null> => {
            try {
                logger.info(logger.LOG_MODULES.SYSTEM, `Fetching collection ID for slug: ${slug}`);
                const tensorApi = TensorAPI.getInstance();
                return await tensorApi.fetchCollections(slug).send();
            } catch (error) {
                console.error('Ошибка при получении collectionId:', error);
                return null;
            }
        }
    );

    ipcMain.handle(
        'get-collIdByUrl',
        async (_event: IpcMainInvokeEvent, url: string): Promise<string | null> => {
            try {
                const slug = url.split('/').pop() || '';
                logger.info(logger.LOG_MODULES.SYSTEM, `Fetching collection ID for URL slug: ${slug}`);
                const result = await getCollIdBySlug(slug);

                return result ?? null;
            } catch (error) {
                console.error('Ошибка при получении collectionId:', error);
                return null;
            }
        }
    );

    ipcMain.handle(
        'get-nftsForCollection',
        async (
            _event: IpcMainInvokeEvent,
            collId: string,
            limit: number = 1,
            onlyListings: boolean = false
        ): Promise<unknown | null> => {
            try {
                logger.info(logger.LOG_MODULES.SYSTEM, `Fetching NFTs for collection: ${collId}`);
                const tensorApi = TensorAPI.getInstance();
                return await tensorApi.fetchCollectionNfts(collId, limit, onlyListings).send();
            } catch (error) {
                console.error('Ошибка при получении NFT:', error);
                return null;
            }
        }
    );

    ipcMain.handle(
        'get-txHistory',
        async (_event: IpcMainInvokeEvent, params: TxHistoryParams): Promise<unknown | null> => {
            try {
                logger.info(logger.LOG_MODULES.SYSTEM, `Fetching TX history for: ${params.collId}`);
                const tensorApi = TensorAPI.getInstance();

                return await tensorApi
                    .fetchTxHistory({
                        collId: params.collId || 'a2e9e503-b8d5-4024-8837-538c5b879ec4',
                        limit: params.limit,
                        txTypes: params.txTypes,
                        minPrice: params.minPrice,
                        maxPrice: params.maxPrice,
                        traits: params.traits,
                        wallet: params.wallet,
                        cursor: params.cursor,
                    })
                    .send();
            } catch (error) {
                console.error('Ошибка при получении истории транзакций:', error);
                return null;
            }
        }
    );
}