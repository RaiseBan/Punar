const fs = require("fs").promises;
const base_fs = require("fs");
const path = require("path");
const { ensureConfigDirectory, getGlobalConfigDirectory} = require("../utils/wallet");
const {getSettings} = require("../utils/fsHelper");

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
    ipcMain.handle('get-config', async (_, configType, fileName) => {
        try {
            const baseDir = await ensureConfigDirectory();
            const filePath = path.join(baseDir, configType, `${fileName}.json`);

            const data = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading config:', error);
            return null;
        }
    });
    ipcMain.handle('delete-config', async (_, configType, fileName) => {
        try {
            const baseDir = await ensureConfigDirectory();
            const filePath = path.join(baseDir, configType, `${fileName}.json`);

            await fs.unlink(filePath);
            return true;
        } catch (error) {
            console.error('Error deleting config:', error);
            return false;
        }
    });

    ipcMain.handle('get-config-paths', async (_, configType) => {
        try {
            const baseDir = await ensureConfigDirectory();
            const configDir = path.join(baseDir, configType);

            if (!base_fs.existsSync(configDir)) {
                return [];
            }

            const files = await fs.readdir(configDir);
            return files
                .filter(file => file.endsWith('.json'))
                .map(file => ({
                    name: file.replace(/\.json$/, ''), // Оставляем только имя без `.json`
                    path: path.join(configDir, file),  // Абсолютный путь к файлу
                }));
        } catch (error) {
            console.error('Error getting config paths:', error);
            return [];
        }
    });






    ipcMain.handle("get-settings", async () => {
        return getSettings();
    });
    ipcMain.handle("save-settings", (_, settings) => {
        const settingsDir = getGlobalConfigDirectory();
        const settingsFilePath = path.join(settingsDir, 'userSettings.json');

        try {
            base_fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    });

}

module.exports = { initializeConfigHandlers };
