const {getGlobalConfigDirectory} = require("./wallet");
const path = require("path");
const fs = require("fs");

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

module.exports = {getSettings}
