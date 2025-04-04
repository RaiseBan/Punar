const { getGlobalConfigDirectory } = require("./wallet");
const path = require("path");
const fs = require("fs");
const fs_prom = require("fs").promises;
const { app } = require("electron");

function getSettings() {
    try {
        console.log("fsHelper.getSettings: Получение настроек пользователя");

        // Получаем путь к глобальной конфигурационной директории
        const settingsDir = getGlobalConfigDirectory();
        const settingsFilePath = path.join(settingsDir, 'userSettings.json');

        console.log(`fsHelper.getSettings: Путь к конфигурационному файлу: ${settingsFilePath}`);

        if (!fs.existsSync(settingsFilePath)) {
            console.error(`fsHelper.getSettings: Ошибка - конфигурационный файл не найден по пути ${settingsFilePath}`);

            // Если не удалось найти файл, пробуем альтернативный путь
            const altConfigPath = path.join(app.getPath('userData'), 'settings.json');
            console.log(`fsHelper.getSettings: Пробуем альтернативный путь: ${altConfigPath}`);

            if (!fs.existsSync(altConfigPath)) {
                console.error(`fsHelper.getSettings: Альтернативный конфигурационный файл тоже не найден`);
                return {};
            }

            const altSettings = JSON.parse(fs.readFileSync(altConfigPath, 'utf8'));
            console.log(`fsHelper.getSettings: Настройки успешно получены из альтернативного файла:`, JSON.stringify(altSettings, null, 2));
            return altSettings;
        }

        const settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
        console.log(`fsHelper.getSettings: Настройки успешно получены:`, JSON.stringify(settings, null, 2));

        return settings;
    } catch (error) {
        console.error(`fsHelper.getSettings: Ошибка при получении настроек:`, error);
        return {};
    }
}

function getLookupTablesFilePath() {
    const settingsDir = getGlobalConfigDirectory();
    return path.join(settingsDir, 'lookup_tables.json');
}

async function saveLookupTables(data) {
    try {
        await fs_prom.writeFile(getLookupTablesFilePath(), JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving lookup tables:', error);
        return false;
    }
}

// Получение массива из файла
async function getLookupTables() {
    try {
        const fileContent = await fs_prom.readFile(getLookupTablesFilePath(), 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Файл не существует, возвращаем пустой массив
            return [];
        }
        console.error('Error reading lookup tables:', error);
        return null;
    }
}

function convertWindowsPathToWSL(windowsPath) {
    // Заменяем обратные слэши на прямые
    let unixPath = windowsPath.replace(/\\/g, '/');

    // Преобразуем букву диска (например, C:) в /mnt/c
    if (unixPath.startsWith('C:')) {
        unixPath = unixPath.replace(/^C:/, '/mnt/c');
    } else if (unixPath.startsWith('D:')) {
        unixPath = unixPath.replace(/^D:/, '/mnt/d');
    }
    // Добавьте другие диски по аналогии, если нужно

    return unixPath;
}


module.exports = { getSettings, getLookupTablesFilePath, saveLookupTables, getLookupTables, convertWindowsPathToWSL }
