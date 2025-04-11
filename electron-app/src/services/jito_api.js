const axios = require("axios");

async function sendJitoTransaction(transaction) {
    await axios.post(
        `http://localhost:8082/forward`,  // Используем эндпоинт /forward
        {
            url: "https://slc.mainnet.block-engine.jito.wtf/api/v1/transactions",
            method: "POST",
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: "sendTransaction",
                params: [
                    transaction,
                    {"encoding": "base64"}
                ],
            })
        }
    );
    console.log("Отправлено успешно");
}

module.exports = {sendJitoTransaction}