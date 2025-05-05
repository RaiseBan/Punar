import axios, { AxiosError } from "axios";
import { getSettings } from "./fsHelper";

/**
 * Интерфейс для результата запроса к DAS API
 */
interface DASAssetResult {
    id: string;
    [key: string]: any;
}

/**
 * Интерфейс для ответа Helius API
 */
interface HeliusResponse {
    jsonrpc: string;
    id: string;
    result: DASAssetResult;
}

/**
 * Получает информацию о токене (asset) через Helius API
 * @param mint Адрес минта токена
 * @returns Данные о токене
 */
export async function retrieveDASAssetFields(mint: string): Promise<DASAssetResult> {
    let attempts = 0;
    const helius_url = "https://mainnet.helius-rpc.com/?api-key=6809eb27-d499-4284-9d03-775699a69949";
    // const helius_url = getSettings().heliusRpcs[0];

    while (attempts < 5) {
        try {
            const assetRes = await axios.post<HeliusResponse>(helius_url, {
                jsonrpc: '2.0',
                id: '0',
                method: 'getAsset',
                params: { id: mint }
            });

            return assetRes.data.result; // ✅ Если запрос успешный, возвращаем результат
        } catch (error) {
            const axiosError = error as AxiosError;

            if (axios.isAxiosError(error) && axiosError.response?.status === 429) {
                console.warn(`[retrieveDASAssetFields] Rate limit exceeded. Retrying with next key...`);
                continue;
            } else {
                console.error(`[retrieveDASAssetFields] Error on attempt ${attempts + 1}:`, error);
            }

            // ✅ Переключаем RPC-ключ
            console.log(` [retrieveDASAssetFields] Switching RPC to next...`);

            // ⏳ Если ошибка не 429, ждем 1 секунду перед следующей попыткой
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

// Закомментированная тестовая функция
/*
(async () => {
    const res = await retrieveDASAssetFields("GGc8j744twRwakBXVKJuhhUSKrR6z5o8bnXERivz8Es5");
    console.log(JSON.stringify(res, null, 2))
})()
*/