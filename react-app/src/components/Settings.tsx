import React, { useState, useEffect } from "react";
import { TextField, Button, Box, Typography } from "@mui/material";
import { CheckCircle } from "@mui/icons-material"; // Для зеленой галочки

export default function Settings() {
    const [scriptDirectory, setScriptDirectory] = useState<string>("");
    const [savedPath, setSavedPath] = useState<string | null>(null);
    const [isSaved, setIsSaved] = useState<boolean>(false);
    const [isInputChanged, setIsInputChanged] = useState<boolean>(false);

    useEffect(() => {
        // Получаем сохраненный путь при монтировании компонента
        window.electronAPI?.getScriptDirectory().then((directory: string | null) => {
            if (directory) {
                setScriptDirectory(directory);
                setSavedPath(directory); // Устанавливаем сохраненный путь при монтировании
            }
        });
    }, []);

    const handleSave = () => {
        if (scriptDirectory) {
            // Сохраняем путь через Electron API
            window.electronAPI?.saveScriptDirectory(scriptDirectory);

            // Меняем состояние на "сохранено"
            setIsSaved(true);
            setSavedPath(scriptDirectory);

            // Сброс состояния через 2 секунды
            setTimeout(() => setIsSaved(false), 2000);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setScriptDirectory(e.target.value);
        setIsInputChanged(true); // Пользователь изменил поле ввода
    };

    return (
        <div>
            <h1>Settings</h1>
            <p>Configure your application settings here.</p>

            <Box sx={{ mb: 2 }}>
                <TextField
                    label="Scripts Directory"
                    variant="outlined"
                    value={scriptDirectory}
                    onChange={handleInputChange}
                    fullWidth
                />
            </Box>

            {/* Если путь не сохранен, отображается кнопка SAVE */}
            {!isSaved ? (
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={!isInputChanged} // Кнопка доступна только после изменения поля
                    sx={{
                        backgroundColor: "#1976d2", // Синий цвет до сохранения
                        color: "white",
                        "&:hover": {
                            backgroundColor: "#1565c0",
                        },
                    }}
                >
                    SAVE
                </Button>
            ) : (
                <Button
                    variant="contained"
                    disabled
                    sx={{
                        backgroundColor: "green", // Зеленая кнопка после сохранения
                        color: "white",
                        "&:hover": {
                            backgroundColor: "green", // Без изменения цвета при наведении
                        },
                    }}
                >
                    <CheckCircle sx={{ color: "white", fontSize: 24 }} />
                </Button>
            )}

            {/* Отображение пути, если он был сохранен */}
            {isSaved && savedPath && (
                <Typography variant="body1" color="success.main" sx={{ mt: 2 }}>
                    Script directory saved: {savedPath}
                </Typography>
            )}
        </div>
    );
}
