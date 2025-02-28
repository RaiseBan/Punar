const fs = require("fs");
const path = require("path");
const { getGlobalConfigDirectory } = require("../utils/wallet");

function initializeWalletHandlers(ipcMain) {
    ipcMain.handle("getWallets", async () => {
        try {
            const configDir = getGlobalConfigDirectory();
            const walletsFilePath = path.join(configDir, "wallets.json");

            if (!fs.existsSync(walletsFilePath)) {
                fs.writeFileSync(walletsFilePath, JSON.stringify([]));
                return [];
            }

            return JSON.parse(fs.readFileSync(walletsFilePath, "utf-8"));
        } catch (error) {
            console.error("Ошибка при загрузке кошельков:", error);
            return { message: "Error loading wallets." };
        }
    });

    ipcMain.handle("addWallet", async (_, wallet) => {
        try {
            const configDir = getGlobalConfigDirectory();
            const walletsFilePath = path.join(configDir, "wallets.json");

            let wallets = [];
            if (fs.existsSync(walletsFilePath)) {
                wallets = JSON.parse(fs.readFileSync(walletsFilePath, "utf-8"));
            }

            wallets.push(wallet);
            fs.writeFileSync(walletsFilePath, JSON.stringify(wallets, null, 2));
        } catch (error) {
            console.error("Ошибка при сохранении кошелька:", error);
        }
    });

    ipcMain.handle("deleteWallet", async (_, publicKey) => {
        try {
            const configDir = getGlobalConfigDirectory();
            const walletsFilePath = path.join(configDir, "wallets.json");

            if (!fs.existsSync(walletsFilePath)) return;

            let wallets = JSON.parse(fs.readFileSync(walletsFilePath, "utf-8"));
            wallets = wallets.filter((wallet) => wallet.publicKey !== publicKey);

            fs.writeFileSync(walletsFilePath, JSON.stringify(wallets, null, 2));
        } catch (error) {
            console.error("Ошибка при удалении кошелька:", error);
        }
    });
}

module.exports = { initializeWalletHandlers };
