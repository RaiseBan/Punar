import React, { useEffect, useState } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import { Minimize, Close } from "@mui/icons-material";

const Header = () => {
    const [time, setTime] = useState<string>(new Date().toLocaleTimeString("ru-RU", { hour12: false }));

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date().toLocaleTimeString("ru-RU", { hour12: false }));
        }, 1000);

        window.electronAPI?.enableDrag();

        return () => clearInterval(timer);
    }, []);

    const handleClose = () => {
        window.electronAPI?.closeWindow();
    };

    const handleMinimize = () => {
        window.electronAPI?.minimizeWindow();
    };

    return (
        <Box sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#1e1e1e",
            p: 1,
            cursor: "move",
            position: "relative",
            zIndex: 999,
            width: "100%",
            boxSizing: "border-box",
            '-webkit-app-region': 'drag',
        }}>
            {/* Левая часть (текст "Welcome back, elite3000") */}
            <Typography variant="body2" sx={{ color: "#888", fontSize: "0.875rem" }}>
                Welcome back, <span style={{ fontWeight: "bold", color: "#fff" }}>elite3000</span>
            </Typography>

            {/* Правая часть с временем, точкой и кнопками */}
            <Box sx={{ display: "flex", alignItems: "center" }}>
                {/* Время в рамке */}
                <Box sx={{
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#000",
                    borderRadius: "16px",
                    px: 2,
                    py: 0.5,
                    border: "1px solid #333"
                }}>
                    <Typography variant="body2" sx={{ color: "#fff", fontSize: "0.875rem" }}>
                        {time}
                    </Typography>
                    {/* Синяя точка */}
                    <Box sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: "#1E90FF",
                        ml: 1
                    }} />
                </Box>

                {/* Разделительная черта */}
                <Box sx={{
                    width: "1px",
                    height: "16px",
                    backgroundColor: "#888",
                    mx: 1
                }} />

                {/* Кнопки управления */}
                <IconButton onClick={handleMinimize} sx={{ color: "#fff", '-webkit-app-region': 'no-drag' }}>
                    <Minimize />
                </IconButton>
                <IconButton onClick={handleClose} sx={{ color: "#fff", '-webkit-app-region': 'no-drag' }}>
                    <Close />
                </IconButton>
            </Box>
        </Box>
    );
};

export default Header;
