const fs = require("fs").promises;
const base_fs = require("fs");
const path = require("path");
const { ensureConfigDirectory, getGlobalConfigDirectory} = require("../utils/wallet");
const {getSettings} = require("../utils/fsHelper");

async function directoryExists(path) {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

function initializeConfigHandlers(ipcMain) {
    ipcMain.handle("save-config", async (_, configType, fileName, content) => {
        try {
            const baseDir = await ensureConfigDirectory();
            const configDir = path.join(baseDir, configType);

            // Создаем директорию конфига, если не существует
            await fs.mkdir(configDir, { recursive: true });

            const filePath = path.join(configDir, `${fileName}.json`);
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

            // Возвращаем пустой массив если директория не существует
            if (!(await directoryExists(configDir))) {
                return [];
            }

            const files = await fs.readdir(configDir);
            return files
                .filter(file => file.endsWith(".json"))
                .map(file => file.replace(/\.json$/, ""));
        } catch (error) {
            console.error("Error reading configs:", error);
            return [];
        }
    });

    ipcMain.handle('get-config', async (_, configType, fileName) => {
        try {
            const baseDir = await ensureConfigDirectory();
            const filePath = path.join(baseDir, configType, `${fileName}.json`);

            // Подавляем ошибку если файл не существует
            if (!(await directoryExists(path.dirname(filePath)))) return null;

            const data = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error reading config:', error);
            }
            return null;
        }
    });

    ipcMain.handle('delete-config', async (_, configType, fileName) => {
        try {
            const baseDir = await ensureConfigDirectory();
            const filePath = path.join(baseDir, configType, `${fileName}.json`);

            // Не пытаемся удалять несуществующие файлы
            if (!(await directoryExists(filePath))) return true;

            await fs.unlink(filePath);
            return true;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error deleting config:', error);
            }
            return false;
        }
    });

    ipcMain.handle('get-config-paths', async (_, configType) => {
        try {
            const baseDir = await ensureConfigDirectory();
            const configDir = path.join(baseDir, configType);

            // Возвращаем пустой массив если директория не существует
            if (!(await directoryExists(configDir))) {
                return [];
            }

            const files = await fs.readdir(configDir);
            return files
                .filter(file => file.endsWith('.json'))
                .map(file => ({
                    name: file.replace(/\.json$/, ''),
                    path: path.join(configDir, file),
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
