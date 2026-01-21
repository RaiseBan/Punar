import axios, { AxiosError } from "axios";
import logger from "../services/loggerService";

interface DASAssetResult {
    id: string;
    [key: string]: unknown;
}

interface HeliusResponse {
    jsonrpc: string;
    id: string;
    result: DASAssetResult;
}

export async function retrieveDASAssetFields(mint: string): Promise<DASAssetResult> {
    let attempts = 0;
    const helius_url = "https://mainnet.helius-rpc.com/?api-key=6809eb27-d499-4284-9d03-775699a69949";

    while (attempts < 5) {
        try {
            const assetRes = await axios.post<HeliusResponse>(helius_url, {
                jsonrpc: '2.0',
                id: '0',
                method: 'getAsset',
                params: { id: mint }
            });

            return assetRes.data.result;
        } catch (error) {
            const axiosError = error as AxiosError;

            if (axios.isAxiosError(error) && axiosError.response?.status === 429) {
                console.warn(`[retrieveDASAssetFields] Rate limit exceeded. Retrying with next key...`);
                continue;
            } else {
                console.error(`[retrieveDASAssetFields] Error on attempt ${attempts + 1}:`, error);
            }

            logger.info(logger.LOG_MODULES.API, ` [retrieveDASAssetFields] Switching RPC to next...`);

            if (!(axios.isAxiosError(error) && axiosError.response?.status === 429)) {
                if (attempts === 0 || attempts === 1){
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
        }

        attempts++;
    }

    console.error(`[retrieveDASAssetFields] Failed`);
    throw new Error("Failed to fetch asset fields after multiple retries");
}