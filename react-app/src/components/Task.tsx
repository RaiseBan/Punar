import React, { useState } from "react";
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

import { useDispatch } from "react-redux";
import { removeTask, updateTask } from "../store/tasksSlice";

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
    logs: string[];
    config?: any; // <-- теперь храним конфиг
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
                                 logs,
                                 config,
                             }: TaskProps) {
    const dispatch = useDispatch();

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [fullViewOpen, setFullViewOpen] = useState(false);
    const [logsOpen, setLogsOpen] = useState(false);

    // Для сворачивания таблицы
    const [tableCollapsed, setTableCollapsed] = useState(true);

    // Локальная копия config для редактирования
    // (Если модуль "tensor_sdk", тогда там есть task_name, threshold_price и т.д.)
    const [editConfig, setEditConfig] = useState<any>(config || {});

    // Можно отдельно хранить новое имя, или брать из editConfig
    const [editName, setEditName] = useState(name);
    const [editModuleName, setEditModuleName] = useState(moduleName);

    const chipColor = statusColorMap[status] || "#ff9e44";

    // -----------------------
    //  Логика кнопок
    // -----------------------
    const handleOpenSettings = () => {
        // Обновляем локальные стейты из актуальных значений
        setEditName(name);
        setEditModuleName(moduleName);
        setEditConfig(config || {});
        setSettingsOpen(true);
    };
    const handleCloseSettings = () => setSettingsOpen(false);

    const handleSaveSettings = () => {
        // Сохраняем изменения в Redux
        dispatch(
            updateTask({
                id,
                name: editName,
                moduleName: editModuleName,
                config: editConfig, // <-- сохраняем новый config
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

    // Переключение свёрнуто/развёрнуто
    const toggleTable = () => {
        setTableCollapsed(!tableCollapsed);
    };

    // Определяем, сколько строк показывать
    const displayedData = tableCollapsed ? data.slice(0, 2) : data;

    // Разрешаем ли редактировать поля конфигурации? Только если Stopped
    const canEditConfig = status === "Stopped";

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
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                                    {name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "#999" }}>
                                    Module: {moduleName}
                                </Typography>
                            </Box>
                            <Chip
                                label={status}
                                sx={{
                                    backgroundColor: chipColor,
                                    color: "#000",
                                    fontWeight: "bold",
                                }}
                            />
                        </Box>

                        {/* Правая часть: иконки */}
                        <Box sx={{ display: "flex", gap: 1 }}>
                            {/* Кнопка развернуть/свернуть таблицу */}
                            <IconButton sx={{ color: "#fff" }} onClick={toggleTable}>
                                {tableCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                            </IconButton>

                            {/* FullView */}
                            <IconButton sx={{ color: "#fff" }} onClick={handleOpenFullView}>
                                <OpenInFullIcon />
                            </IconButton>

                            {/* Settings */}
                            <IconButton sx={{ color: "#ff9e44" }} onClick={handleOpenSettings}>
                                <SettingsIcon />
                            </IconButton>

                            {/* Logs */}
                            <IconButton sx={{ color: "#ccc" }} onClick={handleOpenLogs}>
                                <VisibilityIcon />
                            </IconButton>

                            {/* Stop */}
                            <IconButton
                                sx={{ color: "#f44336" }}
                                onClick={handleStop}
                                disabled={status !== "Running"}
                            >
                                <StopIcon />
                            </IconButton>

                            {/* Resume */}
                            <IconButton
                                sx={{ color: "#00c853" }}
                                onClick={handleResume}
                                disabled={status !== "Stopped"}
                            >
                                <PlayArrowIcon />
                            </IconButton>

                            {/* Delete */}
                            <IconButton onClick={handleDelete} sx={{ color: "red" }}>
                                <DeleteIcon />
                            </IconButton>
                        </Box>
                    </Box>

                    {/* Таблица (2 строки если tableCollapsed=true) */}
                    <Box sx={{ width: "100%", marginTop: "10px", overflowX: "auto" }}>
                        <Table sx={{ minWidth: 500 }}>
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
                    {/* Пример: имя таска */}
                    <TextField
                        label="Task Name"
                        variant="outlined"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={!canEditConfig} // Только если Stopped
                    />

                    {/* Module Name */}
                    <TextField
                        label="Module Name"
                        variant="outlined"
                        value={editModuleName}
                        onChange={(e) => setEditModuleName(e.target.value)}
                        disabled={!canEditConfig}
                    />

                    {/* Пример: если модуль "Tensor sniper (SDK)", тогда редактируем threshold_price */}
                    {editConfig?.module_name === "Tensor sniper (SDK)" && (
                        <TextField
                            label="Threshold Price"
                            type="number"
                            value={editConfig.threshold_price ?? 0}
                            disabled={!canEditConfig}
                            onChange={(e) =>
                                setEditConfig({
                                    ...editConfig,
                                    threshold_price: parseFloat(e.target.value),
                                })
                            }
                        />
                    )}

                    {/* Можете добавить и другие поля из config, если нужно */}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseSettings} color="inherit">
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSaveSettings}
                        disabled={!canEditConfig} // Сохранить только если Stopped
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог FullView (показывает всю таблицу и т.д.) */}
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
        </>
    );
}
