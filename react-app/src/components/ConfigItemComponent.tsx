import React, { useState } from "react";
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Divider,
    Card,
    Button,
    TextField,
    Box,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";

interface ConfigData {
    intervals?: { name: string; max: string }[];
    nft?: Record<string, number>;
}

interface ConfigFile {
    fileName: string;
    configType: "reprice_config" | "snipe_config";
    data: ConfigData;
}

const ConfigItemComponent: React.FC<{ config: ConfigFile; onUpdate: () => void }> = ({
                                                                                         config,
                                                                                         onUpdate,
                                                                                     }) => {
    const [solValue, setSolValue] = useState("");
    const [lamportsValue, setLamportsValue] = useState("");

    const [isExpanded, setIsExpanded] = useState(false);
    const [configData, setConfigData] = useState(config.data);
    const [jsonText, setJsonText] = useState(JSON.stringify(configData, null, 2));
    const [jsonError, setJsonError] = useState(false);
    const [newItem, setNewItem] = useState<{ name: string; max?: string; price?: number }>({
        name: "",
        max: "",
        price: 0,
    });

    // **Сохранение данных**
    const saveChanges = async () => {
        try {
            const parsedData = JSON.parse(jsonText);
            setConfigData(parsedData);
            await window.electronAPI?.saveConfig(config.configType, config.fileName, parsedData);
            onUpdate();
            setJsonError(false);
        } catch (error) {
            setJsonError(true);
        }
    };

    // **Добавление нового элемента**
    const addNewItem = () => {
        if (!newItem.name || (config.configType === "reprice_config" && !newItem.max)) return;

        const updatedData =
            config.configType === "reprice_config"
                ? {
                    ...configData,
                    intervals: [...(configData.intervals || []), { name: newItem.name, max: newItem.max! }],
                }
                : {
                    ...configData,
                    nft: { ...(configData.nft || {}), [newItem.name]: newItem.price! },
                };

        setConfigData(updatedData);
        setJsonText(JSON.stringify(updatedData, null, 2));
        setNewItem({ name: "", max: "", price: 0 });
    };

    // **Редактирование JSON вручную**
    const handleJsonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setJsonText(e.target.value);
        try {
            JSON.parse(e.target.value);
            setJsonError(false);
        } catch {
            setJsonError(true);
        }
    };

    return (
        <Accordion
            expanded={isExpanded}
            onChange={() => setIsExpanded(!isExpanded)}
            sx={{
                backgroundColor: "#1e1e1e",
                borderRadius: "8px",
                boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.5)",
                mb: 2,
            }}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ padding: "12px 16px" }}>
                <Typography variant="h6" sx={{ color: "#00e5ff", fontWeight: "bold" }}>
                    {config.fileName}
                </Typography>
            </AccordionSummary>

            <AccordionDetails sx={{ backgroundColor: "#121212", padding: "20px", borderRadius: "8px" }}>
                <Box display="flex" gap={3}>
                    {/* Левая часть - редактирование */}
                    <Box flex={1}>
                        <Typography variant="subtitle1" sx={{ color: "#fff", mb: 1 }}>
                            Edit JSON Data
                        </Typography>
                        <Divider sx={{ mb: 2, borderColor: "#00e5ff" }} />

                        <TextField
                            label="Name"
                            fullWidth
                            variant="outlined"
                            value={newItem.name}
                            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                            sx={{ mb: 2, backgroundColor: "#222", borderRadius: "5px" }}
                            InputProps={{ style: { color: "#fff" } }}
                        />
                        {config.configType === "reprice_config" ? (
                            <TextField
                                label="Max"
                                fullWidth
                                variant="outlined"
                                value={newItem.max}
                                onChange={(e) => setNewItem({ ...newItem, max: e.target.value })}
                                sx={{ mb: 2, backgroundColor: "#222", borderRadius: "5px" }}
                                InputProps={{ style: { color: "#fff" } }}
                            />
                        ) : (
                            <TextField
                                label="Price"
                                fullWidth
                                type="number"
                                variant="outlined"
                                value={newItem.price}
                                onChange={(e) =>
                                    setNewItem({ ...newItem, price: parseInt(e.target.value) || 0 })
                                }
                                sx={{ mb: 2, backgroundColor: "#222", borderRadius: "5px" }}
                                InputProps={{ style: { color: "#fff" } }}
                            />
                        )}

                        <Box display="flex" gap={2} mt={2}>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={addNewItem}
                                sx={{
                                    backgroundColor: "#2196F3",
                                    color: "#fff",
                                    fontWeight: "bold",
                                    borderRadius: "8px",
                                    textTransform: "uppercase",
                                    transition: "0.3s",
                                    "&:hover": {
                                        backgroundColor: "#1976D2",
                                        transform: "scale(1.05)",
                                    },
                                }}
                            >
                                Add Item
                            </Button>

                            <Button
                                variant="contained"
                                startIcon={<SaveIcon />}
                                onClick={saveChanges}
                                sx={{
                                    backgroundColor: "#FF4081",
                                    color: "#fff",
                                    fontWeight: "bold",
                                    borderRadius: "8px",
                                    textTransform: "uppercase",
                                    transition: "0.3s",
                                    "&:hover": {
                                        backgroundColor: "#E91E63",
                                        transform: "scale(1.05)",
                                    },
                                }}
                            >
                                Save Changes
                            </Button>
                        </Box>

                        {/* Конвертер SOL <-> Lamports */}
                        <Box display="flex" alignItems="center" gap={2} mt={2}>
                            <TextField
                                label="SOL"
                                fullWidth
                                variant="outlined"
                                value={solValue}
                                onChange={(e) => {
                                    const sol = e.target.value.replace(/[^0-9.]/g, ""); // Оставляем только цифры и точку
                                    setSolValue(sol);
                                    setLamportsValue(sol ? Math.round(parseFloat(sol) * 1_000_000_000).toString() : "");
                                }}
                                sx={{ backgroundColor: "#222", borderRadius: "5px" }}
                                InputProps={{ style: { color: "#fff" } }}
                            />
                            <Typography variant="h6" sx={{ color: "#00e5ff" }}>↔</Typography>
                            <TextField
                                label="Lamports"
                                fullWidth
                                variant="outlined"
                                value={lamportsValue}
                                onChange={(e) => {
                                    const lamports = e.target.value.replace(/\D/g, ""); // Только цифры
                                    setLamportsValue(lamports);
                                    setSolValue(lamports ? (parseInt(lamports, 10) / 1_000_000_000).toString() : "");
                                }}
                                sx={{ backgroundColor: "#222", borderRadius: "5px" }}
                                InputProps={{ style: { color: "#fff" } }}
                            />
                        </Box>



                    </Box>

                    {/* Правая часть - редактируемый JSON */}
                    <Box flex={1}>
                        <Typography variant="subtitle1" sx={{ color: "#fff", mb: 1 }}>
                            Edit JSON Manually
                        </Typography>
                        <Divider sx={{ mb: 2, borderColor: "#00e5ff" }} />
                        <Card
                            variant="outlined"
                            sx={{
                                backgroundColor: "#181818",
                                padding: "12px",
                                borderRadius: "8px",
                                border: jsonError ? "1px solid red" : "1px solid rgba(0, 229, 255, 0.2)",
                            }}
                        >
                            <TextField
                                fullWidth
                                multiline
                                rows={10}
                                variant="outlined"
                                value={jsonText}
                                onChange={handleJsonChange}
                                sx={{ fontFamily: "monospace", color: "#00e5ff" }}
                                InputProps={{ style: { color: jsonError ? "red" : "#00e5ff" } }}
                            />
                        </Card>
                        {jsonError && (
                            <Typography color="error" sx={{ mt: 1 }}>
                                Invalid JSON format!
                            </Typography>
                        )}
                    </Box>
                </Box>
            </AccordionDetails>
        </Accordion>
    );
};

export default ConfigItemComponent;
