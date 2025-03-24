import React, {useEffect, useState} from "react";
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
} from "@mui/material";

import DeleteIcon from "@mui/icons-material/Delete";
import SettingsIcon from "@mui/icons-material/Settings";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import VisibilityIcon from "@mui/icons-material/Visibility";
import StopIcon from "@mui/icons-material/Stop";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

import {useDispatch, useSelector} from "react-redux";
import {removeTask, updateTask, addOrUpdateTask} from "../store/tasksSlice";
import {RootState} from "../store/store";
import {COLS_NAMES} from "../constants";
import {fetchImageUrl} from "../utils/tensorFunctions";

export interface TaskDataRow {
    cells: string[];
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
        dispatch(updateTask({id, status: "Stopped"}));
    };

    const handleResume = () => {
        // При возобновлении берём обновлённый config
        window.electronAPI?.resumeProcess(id, editConfig || {});
        dispatch(updateTask({id, status: "Running"}));
    };

    const handleDelete = () => {
        if (status !== "Stopped") {
            window.electronAPI?.stopProcess(id);
        }
        dispatch(removeTask(id));
    };

    // Функция для создания новой задачи с тем же конфигом
    const handleRunMEVTask = async (rowIndex: number, strategy: string) => {
        const taskId = Date.now();
        const token = data[rowIndex]?.cells[0] || "";
        const volume_change = data[rowIndex]?.cells[1] || "";

        // Добавляем стратегию в имя задачи
        const newTaskName = `${token}_${volume_change}_${strategy}_subTask_${name}`;

        const settings = await window.electronAPI?.getSettings();
        const newConfig = {
            ...config,
            module_name: "mev_subtask",
            task_name: newTaskName,
            strategy, // Добавляем выбранную стратегию
            rowData: data[rowIndex]?.cells,
            sourceTaskId: id,
            additionalRpc: settings?.additionalRpc,
        };

        dispatch(addOrUpdateTask({
            taskId,
            config: newConfig
        }));

        window.electronAPI?.startProcess(taskId, newConfig);
    };

    // Функция для удаления строки из данных задачи
    const handleDeleteMEVRow = (rowIndex: number) => {
        console.log(`Attempting to delete row ${rowIndex} from task ${id}`);

        // Create a copy of the data without the row to be deleted
        const newData = data.filter((_, idx) => idx !== rowIndex);

        console.log(`Original data length: ${data.length}, New data length: ${newData.length}`);

        // Dispatch the updateTask action with the data property
        dispatch(
            updateTask({
                id: id,
                data: newData
            })
        );

        console.log(`Deleted row ${rowIndex} from task ${id}`);
    };

    const toggleTable = () => setTableCollapsed(!tableCollapsed);
    const displayedData = tableCollapsed ? data.slice(0, 2) : data;

    const finalColumns = columns && columns.length > 0 ? columns : COLS_NAMES.get(moduleName) || [];
    const canEditConfig = status === "Stopped";

    // Проверяем, является ли модуль "MEV Module"
    const isMEVModule = moduleName === "MEV Module";

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
                <CardContent sx={{padding: "10px"}}>
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
                        <Box sx={{display: "flex", flexDirection: "column", gap: 0.5}}>
                            <Typography variant="subtitle1" sx={{fontWeight: "bold"}}>
                                {name}
                            </Typography>
                            <Typography variant="caption" sx={{color: "#999"}}>
                                Module: {moduleName}
                            </Typography>

                            {/* Если это Tensor sniper (SDK), покажем картинку и label коллекции */}
                            {moduleName === "Tensor sniper (SDK)" && config?.collection_id && (
                                <Box sx={{display: "flex", alignItems: "center", gap: 1, mt: 0.5}}>
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
                                    <Typography variant="caption" sx={{fontWeight: "bold", color: "#ccc"}}>
                                        {collectionLabel}
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        <Box sx={{display: "flex", alignItems: "center", gap: 2}}>
                            <Chip
                                label={status}
                                sx={{
                                    backgroundColor: chipColor,
                                    color: "#000",
                                    fontWeight: "bold",
                                }}
                            />
                            {/* Иконки действий */}
                            <Box sx={{display: "flex", gap: 1}}>
                                <IconButton sx={{color: "#fff"}} onClick={toggleTable}>
                                    {tableCollapsed ? <ExpandMoreIcon/> : <ExpandLessIcon/>}
                                </IconButton>

                                <IconButton sx={{color: "#fff"}} onClick={handleOpenFullView}>
                                    <OpenInFullIcon/>
                                </IconButton>

                                <IconButton sx={{color: "#ff9e44"}} onClick={handleOpenSettings}>
                                    <SettingsIcon/>
                                </IconButton>

                                <IconButton sx={{color: "#ccc"}} onClick={handleOpenLogs}>
                                    <VisibilityIcon/>
                                </IconButton>

                                <IconButton
                                    sx={{color: "#f44336"}}
                                    onClick={handleStop}
                                    disabled={status !== "Running"}
                                >
                                    <StopIcon/>
                                </IconButton>

                                <IconButton
                                    sx={{color: "#00c853"}}
                                    onClick={handleResume}
                                    disabled={status !== "Stopped"}
                                >
                                    <PlayArrowIcon/>
                                </IconButton>

                                <IconButton onClick={handleDelete} sx={{color: "red"}}>
                                    <DeleteIcon/>
                                </IconButton>
                            </Box>
                        </Box>
                    </Box>

                    {/* Таблица (2 строки если tableCollapsed=true) */}
                    <Box sx={{width: "100%", marginTop: "10px", overflowX: "auto"}}>
                        <Table sx={{minWidth: 500}}>
                            <TableHead>
                                <TableRow>
                                    {finalColumns.map((col, i) => (
                                        <TableCell
                                            key={i}
                                            sx={{color: "#ff9e44", borderBottom: "1px solid #2A2A2A"}}
                                        >
                                            {col}
                                        </TableCell>
                                    ))}
                                    {/* Добавляем столбец с кнопками только для MEV Module */}
                                    {isMEVModule && (
                                        <TableCell
                                            sx={{color: "#ff9e44", borderBottom: "1px solid #2A2A2A"}}
                                        >
                                            Actions
                                        </TableCell>
                                    )}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {displayedData.map((row, rowIndex) => (
                                    <TableRow key={rowIndex}>
                                        {row.cells.map((cell, cellIndex) => (
                                            <TableCell
                                                key={cellIndex}
                                                sx={{ color: "#fff", borderBottom: "1px solid #2A2A2A" }}
                                            >
                                                {cell}
                                            </TableCell>
                                        ))}
                                        {/* Добавляем кнопки Run и Delete только для MEV Module */}
                                        {isMEVModule && (
                                            <TableCell sx={{ borderBottom: "1px solid #2A2A2A" }}>
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
                                                            py: 0.5
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
                </CardContent>
            </Card>

            {/* Диалог Settings */}
            <Dialog open={settingsOpen} onClose={handleCloseSettings} maxWidth="sm" fullWidth>
                <DialogTitle>Task Settings</DialogTitle>
                <DialogContent sx={{display: "flex", flexDirection: "column", gap: 2, mt: 1}}>
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
                    <Box sx={{overflowX: "auto"}}>
                        <Table sx={{minWidth: 800}}>
                            <TableHead>
                                <TableRow sx={{backgroundColor: "#1E1E1E"}}>
                                    {columns.map((col, i) => (
                                        <TableCell
                                            key={i}
                                            sx={{color: "#ff9e44", borderBottom: "1px solid #2A2A2A"}}
                                        >
                                            {col}
                                        </TableCell>
                                    ))}
                                    {/* Добавляем столбец с кнопками только для MEV Module */}
                                    {isMEVModule && (
                                        <TableCell
                                            sx={{color: "#ff9e44", borderBottom: "1px solid #2A2A2A"}}
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
                                        {/* Добавляем кнопки Run и Delete только для MEV Module */}
                                        {isMEVModule && (
                                            <TableCell sx={{ borderBottom: "1px solid #2A2A2A" }}>
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
                                                            py: 0.5
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
                    <Box sx={{maxHeight: 400, overflowY: "auto"}}>
                        {logs.map((log, index) => (
                            <Typography key={index} variant="body2" sx={{color: "#fff"}}>
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
                            <MenuItem value="frontrun">Frontrun Strategy</MenuItem>
                            <MenuItem value="backrun">Backrun Strategy</MenuItem>
                            <MenuItem value="sandwich">Sandwich Attack</MenuItem>
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