const fs = require("fs").promises;
const path = require("path");
const { ensureConfigDirectory } = require("../utils/wallet");

function initializeConfigHandlers(ipcMain) {
    ipcMain.handle("save-config", async (_, configType, fileName, content) => {
        try {
            const baseDir = await ensureConfigDirectory();
            const filePath = path.join(baseDir, configType, `${fileName}.json`);
            await fs.writeFile(filePath, JSON.stringify(content, null, 2));
            return true;
        } catch (error) {
            console.error("Error saving config:", error);
            return false;
        }
    });

    ipcMain.handle("get-configs", async (_, configType) => {
        try {
            const baseDir = await ensureConfigDirectory();
            const configDir = path.join(baseDir, configType);

            const files = await fs.readdir(configDir);
            return files.filter((file) => file.endsWith(".json")).map((file) => file.replace(/\.json$/, ""));
        } catch (error) {
            console.error("Error reading configs:", error);
            return [];
        }
    });
}

module.exports = { initializeConfigHandlers };
