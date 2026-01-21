import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { MODULES } from "../../constants"; // путь подкорректируйте под свой проект

interface StepChooseModuleProps {
    selectedModule: string | null;
    setSelectedModule: React.Dispatch<React.SetStateAction<string | null>>;
    handleNext: () => void;
}

export default function StepChooseModule({
                                             setSelectedModule,
                                             handleNext,
                                         }: StepChooseModuleProps) {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 400 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
                Choose a module to run
            </Typography>
            {MODULES.map((mod) => (
                <Button
                    key={mod.id}
                    variant="contained"
                    onClick={() => {
                        if (!mod.isDisabled) {
                            setSelectedModule(mod.id);
                            handleNext();
                        }
                    }}
                    startIcon={mod.icon}
                    disabled={!!mod.isDisabled}
                    sx={{
                        justifyContent: "flex-start",
                        backgroundColor: mod.isDisabled ? "#555" : "#ff9e44",
                        color: "#000",
                        "&:hover": {
                            backgroundColor: mod.isDisabled ? "#444" : "#ff9800",
                        },
                    }}
                >
                    {mod.label}
                </Button>
            ))}
        </Box>
    );
}
