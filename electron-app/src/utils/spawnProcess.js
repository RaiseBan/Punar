const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const {updateConfigCollectionId} = require("./updateService");  // Получаем доступ к Electron API

// Функция для получения директории конфигов, с учетом работы в dev и prod
function getConfigDirectory() {
    if (process.env.NODE_ENV === "production") {
        // В продакшн-режиме берем директорию из ресурсов приложения
        return path.join(app.getPath("userData"), "configs");
    } else {
        // В девелоперском режиме сохраняем в текущей рабочей директории
        return path.join(__dirname, "../configs");
    }
}

// Функция для замены проблемных символов в имени файла
function sanitizeFileName(name) {
    return name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "_");
}

// Функция запуска дочернего процесса с конфигом
function spawnProcess(taskConfig, scriptsDirectoryPath) {

    if (!taskConfig.module_name || !taskConfig.task_name) {
        console.error("Ошибка: taskConfig должен содержать module_name и task_name");
        return null;
    }

    // Получаем правильную директорию конфигов
    const configDir = getConfigDirectory();

    // Создаем папку, если её нет
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    // Формируем имя файла из module_name и task_name
    const moduleName = sanitizeFileName(taskConfig.module_name);
    const taskName = sanitizeFileName(taskConfig.task_name);
    const configFileName = `${moduleName}_${taskName}.json`;
    const configPath = path.join(configDir, configFileName);
    let updatedTaskConfig;
    if (taskConfig.module_name === "Tensor sniper (SDK)" || taskConfig.module_name === "Tensor reprice") {
        updatedTaskConfig = updateConfigCollectionId(taskConfig);
    }else{
        updatedTaskConfig = taskConfig;
    }


    // Записываем конфиг в файл
    fs.writeFileSync(configPath, JSON.stringify(updatedTaskConfig, null, 2), "utf-8");
    console.log(`Конфигурация сохранена: ${configPath}`);
    return;
    // Запускаем дочерний процесс с заданным рабочим каталогом (cwd) и переменными окружения
    console.log(`scriptsDirectoryPath: ${scriptsDirectoryPath}`)
    console.log(`start process: \nPath: ${path.join(scriptsDirectoryPath, "src", "index.ts")} \nConfigPath: ${configPath}`);
    let moduleDir = ""
    let fileToExecute = ""
    if (updatedTaskConfig.module_name === "Tensor sniper (SDK)"){
        moduleDir = "tensor-nft-sdk";
        fileToExecute = "index.ts"
    }else if(updatedTaskConfig.module_name === "Tensor reprice"){
        moduleDir = "tensor_reprice"
        fileToExecute = "index.ts"
    }else if(updatedTaskConfig.module_name === "LaunchMyNft"){
        moduleDir = "mint"
        fileToExecute = "starter.ts"
    }

    const child = spawn("npx", ["tsx", path.join(scriptsDirectoryPath, moduleDir, "src", fileToExecute)], {
        stdio: "pipe", // или 'inherit', если нужно выводить логи в терминал
        shell: true, // Используем shell для корректного выполнения
        detached: false,
        cwd: scriptsDirectoryPath, // Устанавливаем рабочую директорию для процесса
        env: { ...process.env, NODE_ENV: process.env.NODE_ENV, CONFIG_PATH: configPath } // Передаем CONFIG_PATH в переменные окружения
    });
    console.log(`after child`)
    // // Обработка стандартного вывода (stdout)
    // child.stdout.on("data", (data) => {
    //     console.log(`STDOUT: ${data}`);
    // });

    // // Обработка ошибок в stderr
    // child.stderr.on("data", (data) => {
    //     console.error(`STDERR: ${data}`);
    // });
    //
    // // Обработка завершения процесса
    // child.on("exit", (code) => {
    //     console.log(`Процесс завершен с кодом: ${code}`);
    // });

    return child;
}

// Экспортируем функцию
module.exports = { spawnProcess };
