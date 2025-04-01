import React, { useEffect, useState } from "react";
import {
    Card,
    CardContent,
    Typography,
    IconButton,
    Box,
    Chip,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    TableSortLabel,
} from "@mui/material";

import DeleteIcon from "@mui/icons-material/Delete";
import SettingsIcon from "@mui/icons-material/Settings";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import VisibilityIcon from "@mui/icons-material/Visibility";
import StopIcon from "@mui/icons-material/Stop";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

import { useDispatch, useSelector } from "react-redux";
import { removeTask, updateTask, addOrUpdateTask } from "../store/tasksSlice";
import { RootState } from "../store/store";
import { COLS_NAMES } from "../constants";
import { fetchImageUrl } from "../utils/tensorFunctions";

export interface TaskDataRow {
    cells: string[];
    originalIndex?: number;
    rowId?: string;
}

export interface TaskProps {
    id: number;
    name: string;
    moduleName: string;
    status: string;
    columns: string[];
    data: TaskDataRow[];
    config?: any;
}

const statusColorMap: Record<string, string> = {
    Running: "#00c853",
    Stopped: "#f44336",
};

// Создадим интерфейс для данных задачи Telegram
interface TelegramTaskData {
    taskId: number;
    rowIndex: number;
    rowId?: string;
    token: string;
    volumeChange: string;
    volumeValue: number;
    allCells?: string[]; // Добавляем опциональное поле для всех ячеек
}

export default function Task({
    id,
    name,
    moduleName,
    status,
    columns,
    data,
    config,
}: TaskProps) {
    const dispatch = useDispatch();
    console.log(`data-TASK: ${JSON.stringify(data, null, 2)}`);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [fullViewOpen, setFullViewOpen] = useState(false);
    const [logsOpen, setLogsOpen] = useState(false);

    // Для сворачивания таблицы
    const [tableCollapsed, setTableCollapsed] = useState(true);

    // Локальная копия config для редактирования
    const [editConfig, setEditConfig] = useState<any>(config || {});
    // Локальные «имя» и «moduleName»
    const [editName, setEditName] = useState(name);
    const [editModuleName, setEditModuleName] = useState(moduleName);
    const [showRunDialog, setShowRunDialog] = useState(false);
    const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
    const [selectedOption, setSelectedOption] = useState("");

    const chipColor = statusColorMap[status] || "#ff9e44";

    // =======================
    //  ИЗОБРАЖЕНИЕ ДЛЯ TENSOR SDK
    // =======================
    const [imageUrl, setImageUrl] = useState<string>("");

    // Если модуль = "Tensor sniper (SDK)" и есть config.collectionId => грузим картинку
    useEffect(() => {
        let isMounted = true;
        console.log(`moduleName: ${moduleName}`)
        console.log(moduleName === "Tensor sniper (SDK)")
        console.log(config?.collection_id)
        if (moduleName === "Tensor sniper (SDK)" && config?.collection_id) {
            console.log("yep")
            console.log(JSON.stringify(config, null, 2))
            fetchImageUrl(config.collection_id).then((url) => {
                if (isMounted) {
                    console.log(`url: ${url}`);
                    setImageUrl(url!)
                }
                console.log(url)
            });
        } else {
            console.log("no")
            setImageUrl("");
        }
        return () => {
            isMounted = false;
        };
    }, [moduleName, config?.collection_id]);

    // Сформируем label для коллекции (последняя часть пути + toUpperCase)
    let collectionLabel = "";
    if (moduleName === "Tensor sniper (SDK)" && config?.collection_id) {
        const parts = config.collection_id.split("/");
        const lastPart = parts[parts.length - 1] || "";
        collectionLabel = lastPart.toUpperCase();
    }

    // Получаем логи из Redux
    const logs = useSelector((state: RootState) =>
        state.tasks.tasks.find((task) => task.id === id)?.logs || []
    );

    useEffect(() => {
        console.log("Logs updated for Task", id, logs);
    }, [logs]);

    // Добавьте это на верхний уровень компонента
    const processingRowRef = React.useRef(false);

    // В начале компонента Task сохраняем референс на актуальные данные
    const dataRef = React.useRef(data);
    // Обновляем референс при изменении данных
    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    // Получаем processedRows ПЕРЕД созданием ref для него
    const processedRows = useSelector((state: RootState) =>
        state.tasks.tasks.find(t => t.id === id)?.processedTelegramRows || []
    );

    // Добавьте этот ref на верхнем уровне компонента (рядом с dataRef)
    const processedRowsRef = React.useRef<string[]>([]);

    // Обновляйте ref при изменении processedRows
    useEffect(() => {
        processedRowsRef.current = processedRows;
    }, [processedRows]);

    // В начале компонента добавим ID для строк если их нет
    useEffect(() => {
        // Добавляем уникальный ID к каждой строке, если его еще нет
        if (data && data.length > 0 && !data[0].rowId) {
            const dataWithIds = data.map((row, index) => ({
                ...row,
                rowId: `row-${id}-${Date.now()}-${index}` // Создаем уникальный ID
            }));

            dispatch(updateTask({
                id: id,
                data: dataWithIds
            }));
        }
    }, [data]);

    // -----------------------
    // Кнопки
    // -----------------------
    const handleOpenSettings = () => {
        setEditName(name);
        setEditModuleName(moduleName);
        setEditConfig(config || {});
        setSettingsOpen(true);
    };
    const handleCloseSettings = () => setSettingsOpen(false);

    const handleSaveSettings = () => {
        dispatch(
            updateTask({
                id,
                name: editName,
                moduleName: editModuleName,
                config: editConfig,
            })
        );
        setSettingsOpen(false);
    };

    const handleOpenFullView = () => setFullViewOpen(true);
    const handleCloseFullView = () => setFullViewOpen(false);

    const handleOpenLogs = () => setLogsOpen(true);
    const handleCloseLogs = () => setLogsOpen(false);

    const handleStop = () => {
        window.electronAPI?.stopProcess(id);
        dispatch(updateTask({ id, status: "Stopped" }));
    };

    const handleResume = () => {
        // При возобновлении берём обновлённый config
        window.electronAPI?.resumeProcess(id, editConfig || {});
        dispatch(updateTask({ id, status: "Running" }));
    };

    const handleDelete = () => {
        if (status !== "Stopped") {
            window.electronAPI?.stopProcess(id);
        }
        dispatch(removeTask(id));
    };

    // Функция для создания новой задачи с тем же конфигом
    const handleRunMEVTask = async (rowIndex: number, strategy: string) => {

        const token = data[rowIndex]?.cells[0] || "";
        const volume_change = data[rowIndex]?.cells[1] || "";
        const volume_value = parseFloat(data[rowIndex]?.cells[2] || "0");

        if (config.globalStrategy === "jito_only") {
            const settings = await window.electronAPI?.getSettings();
            const taskCount = 5;

            // Структура с параметрами для каждой подзадачи
            const jitoRanges = [
                { lower: 10_000, upper: 100_000 },
                { lower: 100_000, upper: 200_000 },
                { lower: 200_000, upper: 350_000 },
                { lower: 350_000, upper: 550_000 },
                { lower: 550_000, upper: 750_000 } // Изменил последний диапазон, так как он дублировался с предыдущим
            ];

            // Создаем и запускаем задачи в цикле
            for (let i = 0; i < taskCount; i++) {
                const taskId = Date.now() + i;
                const taskName = `${token}_${volume_change}_${strategy}_jito_subTask_${name}_${i}`;

                const taskConfig = {
                    ...config,
                    module_name: "mev_subtask",
                    task_name: taskName,
                    strategy,
                    rowData: data[rowIndex]?.cells,
                    sourceTaskId: taskId,
                    additionalRpc: settings?.additionalRpc,
                    useJito: true,
                    jito_lower_bound: jitoRanges[i].lower,
                    jito_upper_bound: jitoRanges[i].upper
                };

                dispatch(addOrUpdateTask({
                    taskId,
                    config: taskConfig
                }));

                window.electronAPI?.startProcess(taskId, taskConfig);
            }
        } else {
            console.log("APPROVED")
        }


    };

    // Исправьте функцию handleDeleteMEVRow
    const handleDeleteMEVRow = (rowIndexOrId: number | string) => {
        console.log(`Attempting to delete row ${rowIndexOrId} from task ${id}`);

        // Получаем актуальные данные
        const currentData = dataRef.current;

        if (!currentData || currentData.length === 0) {
            console.error(`No data to delete from: data is empty`);
            return;
        }

        let rowIndex: number;

        if (typeof rowIndexOrId === 'string') {
            // Если передан ID, находим индекс по нему
            const foundIndex = currentData.findIndex(row => row.rowId === rowIndexOrId);
            if (foundIndex === -1) {
                console.error(`Row with ID ${rowIndexOrId} not found`);
                return;
            }
            rowIndex = foundIndex;
        } else {
            // Если таблица отсортирована, нужно найти правильный индекс
            if (orderBy) {
                // Получаем строку из отсортированных данных
                const sortedRow = sortedData[rowIndexOrId];
                if (!sortedRow || sortedRow.originalIndex === undefined) {
                    console.error(`Invalid row index in sorted data: ${rowIndexOrId}`);
                    return;
                }
                // Используем оригинальный индекс из отсортированных данных
                rowIndex = sortedRow.originalIndex;
            } else {
                // Если таблица не отсортирована, используем переданный индекс
                rowIndex = rowIndexOrId;
            }
        }

        // Проверяем валидность индекса
        if (rowIndex < 0 || rowIndex >= currentData.length) {
            console.error(`Row index out of bounds: ${rowIndex}, data length: ${currentData.length}`);
            return;
        }

        // Создаем новый массив без удаляемой строки
        const newData = [...currentData.slice(0, rowIndex), ...currentData.slice(rowIndex + 1)];
        console.log(`Original data length: ${currentData.length}, New data length: ${newData.length}`);

        // Обновляем processedRows, учитывая уникальные ID
        const currentProcessedRows = processedRowsRef.current;

        // Используем ID строк для отслеживания обработанных строк вместо индексов
        const rowToDelete = currentData[rowIndex];
        // Исправляем проблему с типизацией - rowIdToDelete может быть undefined
        const rowIdToDelete = rowToDelete.rowId || ''; // Пустая строка как fallback

        const newProcessedRows = currentProcessedRows.filter(item => {
            // Исправляем проверку строк с учетом undefined
            if (!item) return true; // Пропускаем пустые значения
            // Если processedRows содержит индексы, конвертируем их в строковый формат
            // Если содержит ID, проверяем, не совпадает ли с удаляемым ID
            return item !== rowIndex.toString() && (rowIdToDelete ? item !== rowIdToDelete : true);
        });

        // Отправляем обновление в Redux
        dispatch(
            updateTask({
                id: id,
                data: newData,
                processedTelegramRows: newProcessedRows
            })
        );

        console.log(`Deleted row ${rowIndex} from task ${id}`);
    };

    const toggleTable = () => setTableCollapsed(!tableCollapsed);
    const displayedData = tableCollapsed ? data.slice(0, 2) : data;

    const finalColumns = columns && columns.length > 0 ? columns : COLS_NAMES.get(moduleName) || [];
    const canEditConfig = status === "Stopped";

    // Проверяем, является ли модуль "MEV Module" и его режим
    const isMEVModule = moduleName === "MEV Module";

    const isMEVTelegramMode = isMEVModule && config?.mode === "by_telegram_bot";
    console.log(`isMEVTelegramMode: ${isMEVTelegramMode}`);
    console.log(`config: ${JSON.stringify(config, null, 2)}`);

    const isMEVManualMode = isMEVModule && (!config?.mode || config?.mode === "manual");
    const isMEVAutomaticMode = isMEVModule && config?.mode === "automatic";

    // Модифицированный useEffect
    useEffect(() => {
        // Only for MEV module in Telegram bot mode
        if (isMEVTelegramMode && data.length > 0 && status === "Running") {
            const sendMessages = async () => {
                if (processingRowRef.current) return;
                processingRowRef.current = true;

                try {
                    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
                        const row = data[rowIndex];
                        // Проверяем наличие rowId и добавляем проверку на null/undefined
                        const rowId = row.rowId || rowIndex.toString();

                        if (!processedRows.includes(rowIndex.toString()) &&
                            !processedRows.includes(rowId)) {

                            const token = row.cells[0] || "";
                            const volumeChange = row.cells[1] || "";
                            const volumeValue = parseFloat(row.cells[2] || "0");

                            console.log(`Sending row ${rowIndex} to Telegram, token: ${token}`);

                            // Исправленное добавление в processedRows
                            const newProcessedRows = [...processedRows, rowId];
                            dispatch(
                                updateTask({
                                    id,
                                    processedTelegramRows: newProcessedRows,
                                })
                            );

                            // Исправленная передача параметров
                            await window.electronAPI?.sendTelegramTask({
                                taskId: id,
                                rowIndex: rowIndex,
                                rowId: rowId, // Гарантированно не undefined
                                token,
                                volumeChange,
                                volumeValue,
                                allCells: row.cells
                            } as TelegramTaskData);

                            dispatch(
                                updateTask({
                                    id,
                                    logs: [...logs, `Row ${rowIndex} sent to Telegram: ${token}`]
                                })
                            );
                        }
                    }
                } catch (err) {
                    console.error("Error sending task to Telegram:", err);
                    dispatch(
                        updateTask({
                            id,
                            logs: [...logs, `ERROR: Failed to send to Telegram: ${err}`]
                        })
                    );
                } finally {
                    processingRowRef.current = false;
                }
            };

            sendMessages();
        }
    }, [data, isMEVTelegramMode, status, processedRows.length]);

    useEffect(() => {
        if (isMEVTelegramMode && status === "Running") {
            // Check if we have a bot token configured
            window.electronAPI?.getTelegramBotConfig().then(config => {
                if (!config || !config.botToken) {
                    // No bot token configured, show a message or open settings
                    console.warn("Telegram bot is not configured. Please set up the bot token.");
                    dispatch(
                        updateTask({
                            id,
                            logs: [...logs, "WARNING: Telegram bot is not configured. Please set up the bot token."]
                        })
                    );
                }
            }).catch(err => {
                console.error("Error checking Telegram bot config:", err);
            });
        }
    }, [isMEVTelegramMode, status]);


    // Добавьте этот useEffect для обработки команд от Telegram бота
    useEffect(() => {
        if (!window.electronAPI) return;

        console.log(`Setting up Telegram handlers for task ${id}`);

        const runTaskHandler = (event: any, data: { taskId: number, rowIndex: number, strategy: string }) => {
            const { taskId: telegramTaskId, rowIndex, strategy } = data;
            console.log(`Received run task event: taskId=${telegramTaskId}, rowIndex=${rowIndex}, strategy=${strategy}`);

            if (parseInt(String(telegramTaskId)) === id) {
                console.log(`Running task ${id}, row ${rowIndex} with strategy ${strategy}`);
                handleRunMEVTask(parseInt(String(rowIndex)), strategy);
            }
        };

        const deleteTaskHandler = (event: any, data: { taskId: number, rowIndex: number, rowId?: string }) => {
            const { taskId: telegramTaskId, rowIndex, rowId } = data;
            console.log(`Received delete task event: taskId=${telegramTaskId}, rowIndex=${rowIndex}, rowId=${rowId || 'undefined'}`);

            if (parseInt(String(telegramTaskId)) === id) {
                // Используем rowId только если он определен, иначе используем rowIndex
                const identifierToUse = rowId !== undefined ? rowId : rowIndex;
                console.log(`Deleting row with ${typeof identifierToUse === 'string' ? `ID ${identifierToUse}` : `index ${identifierToUse}`} from task ${id}`);
                handleDeleteMEVRow(identifierToUse);
            }
        };

        // Добавляем проверку на undefined
        if (window.electronAPI) {
            window.electronAPI.onTelegramRunTask(runTaskHandler);
            window.electronAPI.onTelegramDeleteTask(deleteTaskHandler);
        }

        return () => {
            console.log(`Removing Telegram handlers for task ${id}`);
            // Добавляем проверку на undefined
            if (window.electronAPI) {
                window.electronAPI.removeListener('telegram-bot:run-task', runTaskHandler);
                window.electronAPI.removeListener('telegram-bot:delete-task', deleteTaskHandler);
            }
        };
    }, [id]); // Зависим только от id

    // Автоматически запускать задачи в автоматическом режиме
    useEffect(() => {
        if (isMEVAutomaticMode && data.length > 0) {
            // Проверяем, есть ли новые данные, которые нужно обработать
            // Можно добавить дополнительную логику здесь для отслеживания новых строк
            const lastRowIndex = data.length - 1;
            const strategy = "pumpswap"; // Используем pumpswap по умолчанию для автоматического режима

            // Запускаем задачу для последней строки
            handleRunMEVTask(lastRowIndex, strategy);
        }
    }, [data.length, isMEVAutomaticMode]);

    // Добавляем состояние для сортировки
    const [orderBy, setOrderBy] = useState<string>('');
    const [order, setOrder] = useState<'asc' | 'desc'>('asc');

    // Функция для обработки сортировки
    const handleRequestSort = (property: string) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    // Функция для сортировки данных
    const sortData = (data: TaskDataRow[]) => {
        if (!orderBy) return data;

        return [...data].map((row, index) => ({
            ...row,
            originalIndex: index // Добавляем оригинальный индекс
        })).sort((a, b) => {
            const aValue = a.cells[finalColumns.indexOf(orderBy)];
            const bValue = b.cells[finalColumns.indexOf(orderBy)];

            // Если значения числовые
            if (!isNaN(Number(aValue)) && !isNaN(Number(bValue))) {
                return order === 'asc'
                    ? Number(aValue) - Number(bValue)
                    : Number(bValue) - Number(aValue);
            }

            // Если значения строковые
            return order === 'asc'
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
        });
    };

    // Получаем отсортированные данные
    const sortedData = sortData(displayedData);

    return (
        <>
            <Card
                sx={{
                    backgroundColor: "#0e0e0e",
                    color: "#fff",
                    width: "100%",
                    borderRadius: "8px",
                    border: "1px solid #2A2A2A",
                    padding: "10px",
                }}
            >
                <CardContent sx={{ padding: "10px" }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 2,
                            justifyContent: "space-between",
                        }}
                    >
                        {/* Левая часть: Название, Модуль, Статус */}
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                                {name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#999" }}>
                                Module: {moduleName}
                            </Typography>

                            {/* Если это Tensor sniper (SDK), покажем картинку и label коллекции */}
                            {moduleName === "Tensor sniper (SDK)" && config?.collection_id && (
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                                    {imageUrl && (
                                        <img
                                            src={imageUrl}
                                            alt="Collection"
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 4,
                                                objectFit: "cover",
                                                border: "1px solid #333",
                                            }}
                                        />
                                    )}
                                    <Typography variant="caption" sx={{ fontWeight: "bold", color: "#ccc" }}>
                                        {collectionLabel}
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <Chip
                                label={status}
                                sx={{
                                    backgroundColor: chipColor,
                                    color: "#000",
                                    fontWeight: "bold",
                                }}
                            />
                            {isMEVTelegramMode && (
                                <Chip
                                    label="Telegram Bot"
                                    sx={{
                                        backgroundColor: "#2196f3",
                                        color: "#fff",
                                        fontWeight: "bold",
                                    }}
                                />
                            )}
                            {/* Иконки действий */}
                            <Box sx={{ display: "flex", gap: 1 }}>
                                <IconButton sx={{ color: "#fff" }} onClick={toggleTable}>
                                    {tableCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                                </IconButton>

                                <IconButton sx={{ color: "#fff" }} onClick={handleOpenFullView}>
                                    <OpenInFullIcon />
                                </IconButton>

                                <IconButton sx={{ color: "#ff9e44" }} onClick={handleOpenSettings}>
                                    <SettingsIcon />
                                </IconButton>

                                <IconButton sx={{ color: "#ccc" }} onClick={handleOpenLogs}>
                                    <VisibilityIcon />
                                </IconButton>

                                <IconButton
                                    sx={{ color: "#f44336" }}
                                    onClick={handleStop}
                                    disabled={status !== "Running"}
                                >
                                    <StopIcon />
                                </IconButton>

                                <IconButton
                                    sx={{ color: "#00c853" }}
                                    onClick={handleResume}
                                    disabled={status !== "Stopped"}
                                >
                                    <PlayArrowIcon />
                                </IconButton>

                                <IconButton onClick={handleDelete} sx={{ color: "red" }}>
                                    <DeleteIcon />
                                </IconButton>
                            </Box>
                        </Box>
                    </Box>

                    {/* Таблица (2 строки если tableCollapsed=true) */}
                    <Box sx={{
                        width: "100%",
                        marginTop: "10px",
                        overflowX: "auto",
                        '&::-webkit-scrollbar': {
                            height: '8px',
                        },
                        '&::-webkit-scrollbar-track': {
                            background: '#1E1E1E',
                            borderRadius: '4px',
                        },
                        '&::-webkit-scrollbar-thumb': {
                            background: '#666',
                            borderRadius: '4px',
                            '&:hover': {
                                background: '#888',
                            },
                        },
                    }}>
                        <Table
                            sx={{
                                minWidth: 500,
                                tableLayout: 'fixed',
                                '& .MuiTableCell-root': {
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '200px', // Максимальная ширина для обычных ячеек
                                },
                                '& .MuiTableCell-head': {
                                    backgroundColor: '#1E1E1E',
                                    color: '#ff9e44',
                                    fontWeight: 'bold',
                                    borderBottom: '1px solid #2A2A2A',
                                },
                                '& .MuiTableCell-body': {
                                    color: '#fff',
                                    borderBottom: '1px solid #2A2A2A',
                                },
                            }}
                        >
                            <TableHead>
                                <TableRow>
                                    {finalColumns.map((col, i) => (
                                        <TableCell
                                            key={i}
                                            sx={{
                                                // Специальные стили для определенных столбцов
                                                ...(col.toLowerCase().includes('address') && { minWidth: '300px' }),
                                                ...(col.toLowerCase().includes('name') && { minWidth: '150px' }),
                                                ...(col.toLowerCase().includes('volume') && { minWidth: '120px' }),
                                                ...(col.toLowerCase().includes('price') && { minWidth: '100px' }),
                                                ...(col.toLowerCase().includes('action') && { width: '120px' }),
                                            }}
                                        >
                                            <TableSortLabel
                                                active={orderBy === col}
                                                direction={orderBy === col ? order : 'asc'}
                                                onClick={() => handleRequestSort(col)}
                                                sx={{
                                                    color: '#ff9e44',
                                                    '&.MuiTableSortLabel-active': {
                                                        color: '#ff9e44',
                                                    },
                                                    '& .MuiTableSortLabel-icon': {
                                                        color: '#ff9e44',
                                                    },
                                                }}
                                            >
                                                {col}
                                            </TableSortLabel>
                                        </TableCell>
                                    ))}
                                    {isMEVManualMode && (
                                        <TableCell
                                            sx={{
                                                width: '120px',
                                                minWidth: '120px',
                                            }}
                                        >
                                            Actions
                                        </TableCell>
                                    )}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sortedData.map((row, rowIndex) => (
                                    <TableRow
                                        key={rowIndex}
                                        sx={{
                                            '&:hover': {
                                                backgroundColor: '#1A1A1A',
                                            },
                                        }}
                                    >
                                        {row.cells.map((cell, cellIndex) => (
                                            <TableCell
                                                key={cellIndex}
                                                sx={{
                                                    ...(finalColumns[cellIndex].toLowerCase().includes('address') && { minWidth: '300px' }),
                                                    ...(finalColumns[cellIndex].toLowerCase().includes('name') && { minWidth: '150px' }),
                                                    ...(finalColumns[cellIndex].toLowerCase().includes('volume') && { minWidth: '120px' }),
                                                    ...(finalColumns[cellIndex].toLowerCase().includes('price') && { minWidth: '100px' }),
                                                }}
                                            >
                                                {cell}
                                            </TableCell>
                                        ))}
                                        {isMEVManualMode && (
                                            <TableCell
                                                sx={{
                                                    width: '120px',
                                                    minWidth: '120px',
                                                }}
                                            >
                                                <Box sx={{ display: "flex", gap: 1 }}>
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        onClick={() => {
                                                            setSelectedRowIndex(rowIndex);
                                                            setShowRunDialog(true);
                                                        }}
                                                        sx={{
                                                            bgcolor: "#00c853",
                                                            "&:hover": { bgcolor: "#00e676" },
                                                            color: "white",
                                                            px: 1.5,
                                                            py: 0.5,
                                                            minWidth: '45px',
                                                        }}
                                                    >
                                                        Run
                                                    </Button>
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        onClick={() => handleDeleteMEVRow(rowIndex)}
                                                        sx={{
                                                            bgcolor: "#f44336",
                                                            "&:hover": { bgcolor: "#ff5252" },
                                                            color: "white",
                                                            px: 1.5,
                                                            py: 0.5,
                                                            minWidth: '45px',
                                                        }}
                                                    >
                                                        Del
                                                    </Button>
                                                </Box>
                                            </TableCell>
                                        )}


                                        {isMEVTelegramMode && (
                                            <TableCell
                                                sx={{
                                                    width: '120px',
                                                    minWidth: '120px',
                                                }}
                                            >
                                                <Typography variant="caption" sx={{ color: "#2196f3" }}>
                                                    В Telegram
                                                </Typography>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Box>
                </CardContent>
            </Card>

            {/* Диалог Settings */}
            <Dialog open={settingsOpen} onClose={handleCloseSettings} maxWidth="sm" fullWidth>
                <DialogTitle>Task Settings</DialogTitle>
                <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                    <TextField
                        label="Task Name"
                        variant="outlined"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={!canEditConfig}
                    />

                    <TextField
                        label="Module Name"
                        variant="outlined"
                        value={editModuleName}
                        onChange={(e) => setEditModuleName(e.target.value)}
                        disabled={!canEditConfig}
                    />

                    {/* Если модуль "Tensor sniper (SDK)", показываем threshold_price (пример) */}
                    {editConfig?.module_name === "Tensor sniper (SDK)" && (
                        <TextField
                            label="Threshold Price"
                            type="number"
                            value={editConfig.threshold_price ?? 0}
                            disabled={!canEditConfig}
                            onChange={(e) =>
                                setEditConfig((prev: any) => ({
                                    ...prev,
                                    threshold_price: parseFloat(e.target.value),
                                }))
                            }
                        />
                    )}

                    {/* Можно добавить другие поля для редактирования из config */}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseSettings} color="inherit">
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSaveSettings}
                        disabled={!canEditConfig}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог FullView */}
            <Dialog open={fullViewOpen} onClose={handleCloseFullView} fullWidth maxWidth="lg">
                <DialogTitle>Full View: {name}</DialogTitle>
                <DialogContent>
                    <Box sx={{ overflowX: "auto" }}>
                        <Table sx={{ minWidth: 800 }}>
                            <TableHead>
                                <TableRow sx={{ backgroundColor: "#1E1E1E" }}>
                                    {columns.map((col, i) => (
                                        <TableCell
                                            key={i}
                                            sx={{ color: "#ff9e44", borderBottom: "1px solid #2A2A2A" }}
                                        >
                                            {col}
                                        </TableCell>
                                    ))}
                                    {/* Добавляем столбец с кнопками только для MEV Module в ручном режиме */}
                                    {isMEVManualMode && (
                                        <TableCell
                                            sx={{ color: "#ff9e44", borderBottom: "1px solid #2A2A2A" }}
                                        >
                                            Actions
                                        </TableCell>
                                    )}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data.map((row, rowIndex) => (
                                    <TableRow key={rowIndex}>
                                        {row.cells.map((cell, cellIndex) => (
                                            <TableCell
                                                key={cellIndex}
                                                sx={{ color: "#fff", borderBottom: "1px solid #2A2A2A" }}
                                            >
                                                {cell}
                                            </TableCell>
                                        ))}
                                        {/* Добавляем кнопки Run и Delete только для MEV Module в ручном режиме */}
                                        {isMEVManualMode && (
                                            <TableCell sx={{ borderBottom: "1px solid #2A2A2A" }}>
                                                <Box sx={{ display: "flex", gap: 1 }}>
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        onClick={() => {
                                                            if (row.originalIndex !== undefined) {
                                                                setSelectedRowIndex(row.originalIndex);
                                                                setShowRunDialog(true);
                                                            }
                                                        }}
                                                        sx={{
                                                            bgcolor: "#00c853",
                                                            "&:hover": { bgcolor: "#00e676" },
                                                            color: "white",
                                                            px: 1.5,
                                                            py: 0.5
                                                        }}
                                                    >
                                                        Run
                                                    </Button>
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        onClick={() => {
                                                            if (row.originalIndex !== undefined) {
                                                                handleDeleteMEVRow(row.originalIndex);
                                                            }
                                                        }}
                                                        sx={{
                                                            bgcolor: "#f44336",
                                                            "&:hover": { bgcolor: "#ff5252" },
                                                            color: "white",
                                                            px: 1.5,
                                                            py: 0.5
                                                        }}
                                                    >
                                                        Delete
                                                    </Button>
                                                </Box>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseFullView} variant="outlined" color="inherit">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог Logs */}
            <Dialog open={logsOpen} onClose={handleCloseLogs} fullWidth maxWidth="md">
                <DialogTitle>Logs for {name}</DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ maxHeight: 400, overflowY: "auto" }}>
                        {logs.map((log, index) => (
                            <Typography key={index} variant="body2" sx={{ color: "#fff" }}>
                                {log}
                            </Typography>
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseLogs} variant="outlined" color="inherit">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={showRunDialog}
                onClose={() => setShowRunDialog(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Select Strategy</DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <FormControl fullWidth>
                        <InputLabel>Strategy</InputLabel>
                        <Select
                            value={selectedOption}
                            onChange={(e) => setSelectedOption(e.target.value)}
                            label="Strategy"
                            sx={{ mb: 2 }}
                        >
                            <MenuItem value="raydium">raydium</MenuItem>
                            <MenuItem value="pumpswap">pumpswap</MenuItem>
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            setShowRunDialog(false);
                            setSelectedOption("");
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            if (selectedRowIndex !== null && selectedOption) {
                                handleRunMEVTask(selectedRowIndex, selectedOption);
                                setShowRunDialog(false);
                                setSelectedOption("");
                            }
                        }}
                        disabled={!selectedOption}
                    >
                        Run
                    </Button>
                </DialogActions>
            </Dialog>

        </>
    );
}