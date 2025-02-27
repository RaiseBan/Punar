import React, { useState, useEffect } from "react";
import {
    Box,
    Button,
    TextField,
    Select,
    MenuItem,
    Typography,
    Card,
    Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ConfigItemComponent from "./ConfigItemComponent";

interface ConfigData {
    intervals?: { name: string; max: string }[];
    nft?: Record<string, number>;
}

interface ConfigFile {
    fileName: string;
    configType: "reprice_config" | "snipe_config";
    data: ConfigData;
}

const ConfigManager: React.FC = () => {
    const [configs, setConfigs] = useState<ConfigFile[]>([]);
    const [newConfig, setNewConfig] = useState<{ name: string; type: "reprice_config" | "snipe_config" }>({
        name: "",
        type: "reprice_config",
    });
    const [showCreateForm, setShowCreateForm] = useState(false);

    // **Загрузка конфигураций**
    useEffect(() => {
        const loadConfigs = async () => {
            const types: ("reprice_config" | "snipe_config")[] = ["reprice_config", "snipe_config"];
            const loadedConfigs: ConfigFile[] = [];

            for (const type of types) {
                const files = (await window.electronAPI?.getConfigs(type)) || [];
                for (const file of files) {
                    const data = await window.electronAPI?.getConfig(type, file);
                    loadedConfigs.push({
                        fileName: file,
                        configType: type,
                        data: data || (type === "reprice_config" ? { intervals: [] } : { nft: {} }),
                    });
                }
            }
            setConfigs(loadedConfigs);
        };

        loadConfigs();
    }, []);

    // **Создание нового конфига**
    const handleCreateConfig = async () => {
        if (!newConfig.name.trim()) return;

        const newConfigData: ConfigFile = {
            fileName: newConfig.name,
            configType: newConfig.type,
            data: newConfig.type === "reprice_config" ? { intervals: [] } : { nft: {} },
        };

        await window.electronAPI?.saveConfig(newConfig.type, newConfig.name, newConfigData.data);

        setConfigs([...configs, newConfigData]);
        setShowCreateForm(false);
        setNewConfig({ name: "", type: "reprice_config" });
    };

    return (
        <Box p={2}>
            <Typography variant="h5" gutterBottom sx={{ color: "#00e5ff" }}>
                Config Manager
            </Typography>

            {/* Кнопка создания нового конфига */}
            <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowCreateForm(true)}
                sx={{
                    mb: 2,
                    backgroundColor: "#2196F3",
                    color: "#fff",
                    fontWeight: "bold",
                    borderRadius: "8px",
                    transition: "0.3s",
                    textTransform: "uppercase",
                    "&:hover": { backgroundColor: "#1976D2", transform: "scale(1.05)" },
                }}
            >
                Create New Config
            </Button>

            {/* Форма создания нового конфига */}
            {showCreateForm && (
                <Card sx={{ p: 2, mb: 2, backgroundColor: "#1e1e1e", borderRadius: "8px" }}>
                    <Typography variant="h6" sx={{ color: "#fff" }}>New Config</Typography>
                    <TextField
                        label="Config Name"
                        fullWidth
                        value={newConfig.name}
                        onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                        sx={{
                            mt: 2,
                            backgroundColor: "#222",
                            borderRadius: "5px",
                            input: { color: "#fff" },
                        }}
                    />
                    <Select
                        fullWidth
                        value={newConfig.type}
                        onChange={(e) =>
                            setNewConfig({
                                ...newConfig,
                                type: e.target.value as "reprice_config" | "snipe_config",
                            })
                        }
                        sx={{
                            mt: 2,
                            backgroundColor: "#222",
                            color: "#fff",
                            borderRadius: "5px",
                        }}
                    >
                        <MenuItem value="reprice_config">Reprice Config</MenuItem>
                        <MenuItem value="snipe_config">Snipe Config</MenuItem>
                    </Select>

                    <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
                        <Button
                            variant="contained"
                            onClick={handleCreateConfig}
                            sx={{
                                backgroundColor: "#00e5ff",
                                color: "#000",
                                fontWeight: "bold",
                                borderRadius: "8px",
                                textTransform: "uppercase",
                                "&:hover": { backgroundColor: "#00c4cc" },
                            }}
                        >
                            Create
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => setShowCreateForm(false)}
                            sx={{
                                color: "#fff",
                                borderColor: "#00e5ff",
                                borderRadius: "8px",
                                "&:hover": { borderColor: "#00c4cc" },
                            }}
                        >
                            Cancel
                        </Button>
                    </Box>
                </Card>
            )}

            {/* Отображение списка конфигов */}
            <Box>
                {configs.map((config) => (
                    <ConfigItemComponent key={`${config.configType}-${config.fileName}`} config={config} onUpdate={() => {}} />
                ))}
            </Box>
        </Box>
    );
};

export default ConfigManager;
