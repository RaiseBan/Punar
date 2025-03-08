const axios = require("axios");
const {getSettings} = require("./fsHelper");

async function retrieveDASAssetFields(mint) {
    let attempts = 0;
    const helius_url = "https://mainnet.helius-rpc.com/?api-key=6809eb27-d499-4284-9d03-775699a69949"
    // const helius_url = getSettings().heliusRpcs[0];
    while (attempts < 5) {

        try {
            const assetRes = await axios.post(helius_url, {
                jsonrpc: '2.0',
                id: '0',
                method: 'getAsset',
                params: { id: mint }
            });

            return assetRes.data.result; // ✅ Если запрос успешный, возвращаем результат
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 429) {
                console.warn(`[retrieveDASAssetFields] Rate limit exceeded. Retrying with next key...`);
                continue;
            } else {
                console.error(`[retrieveDASAssetFields] Error on attempt ${attempts + 1}:`, error);
            }

            // ✅ Переключаем RPC-ключ
            console.log(` [retrieveDASAssetFields] Switching RPC to next...`);

            // ⏳ Если ошибка не 429, ждем 1 секунду перед следующей попыткой
            if (!(axios.isAxiosError(error) && error.response?.status === 429)) {
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


// (async ()=>{
//     const res = await retrieveDASAssetFields("GGc8j744twRwakBXVKJuhhUSKrR6z5o8bnXERivz8Es5");
//     console.log(JSON.stringify(res, null, 2))
// })()

module.exports = {retrieveDASAssetFields}