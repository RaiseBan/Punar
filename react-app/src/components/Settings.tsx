import React, { useState } from "react";
import { TextField, Button, Box } from "@mui/material";

export default function Settings() {
    const [scriptDirectory, setScriptDirectory] = useState<string>("");

    const handleSave = () => {
        if (scriptDirectory) {
            // Отправляем путь в Electron для сохранения
            window.electronAPI?.saveScriptDirectory(scriptDirectory);
        }
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
                    onChange={(e) => setScriptDirectory(e.target.value)}
                    fullWidth
                />
            </Box>
            <Button variant="contained" onClick={handleSave}>SAVE</Button>
        </div>
    );
}
