const {getGlobalConfigDirectory} = require("./wallet");
const path = require("path");
const fs = require("fs");
const fs_prom = require("fs").promises;

function getSettings(){ // можно будет потом отрефакторить код и сделать какой-то Type (кароче удобно)
    const settingsDir = getGlobalConfigDirectory();
    const settingsFilePath = path.join(settingsDir, 'userSettings.json');

    if (!fs.existsSync(settingsFilePath)) {
        return {};
    }

    try {
        const data = fs.readFileSync(settingsFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading settings:', error);
        return {};
    }
}
function getLookupTablesFilePath(){
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

module.exports = {getSettings, getLookupTablesFilePath, saveLookupTables, getLookupTables}
