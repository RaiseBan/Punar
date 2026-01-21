import {
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Drawer,
    Toolbar,
    Typography,
    ListItemIcon
} from "@mui/material";
import { Link, useLocation } from "react-router-dom";

// Иконки из MUI
import AssignmentIcon from "@mui/icons-material/Assignment";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import SettingsInputAntennaIcon from "@mui/icons-material/SettingsInputAntenna";
import BuildIcon from "@mui/icons-material/Build";
import SettingsIcon from "@mui/icons-material/Settings";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ManageHistoryIcon from '@mui/icons-material/ManageHistory';

const menuItems = [
    { text: "Tasks", path: "/tasks", icon: <AssignmentIcon /> },
    { text: "Wallets", path: "/wallets", icon: <AccountBalanceWalletIcon /> },
    { text: "Config", path: "/scriptConfigs", icon: <SettingsInputAntennaIcon /> },
    { text: "Tools", path: "/tools", icon: <BuildIcon /> },
    { text: "Settings", path: "/settings", icon: <SettingsIcon /> },
    { text: "Settings-telegram", path: "/telegram", icon: <SettingsIcon /> },
    { text: "Statistic", path: "/statistic", icon: <TrendingUpIcon /> },
    { text: "TxHistory", path: "/lag", icon: <ManageHistoryIcon /> },
];

export default function Sidebar() {
    const location = useLocation();

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: 250,
                flexShrink: 0,
                "& .MuiDrawer-paper": {
                    width: 250,
                    backgroundColor: "#0e0e0e",
                    color: "#fff",
                    borderRight: "1px solid #1c1c1c",
                    padding: "10px",
                },
            }}
        >
            <Toolbar>
                <Typography
                    variant="h6"
                    sx={{
                        color: "#fff",
                        margin: "auto",
                        fontWeight: "bold",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase"
                    }}
                >
                    PUNAR V1.0
                </Typography>
            </Toolbar>

            <List sx={{ mt: 2 }}>
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <ListItem
                            key={item.text}
                            disablePadding
                            sx={{
                                mb: 0.5,
                                opacity: isActive ? 1 : 0.9,
                            }}
                        >
                            <ListItemButton
                                component={Link}
                                to={item.path}
                                sx={{
                                    backgroundColor: isActive ? "rgba(255,111,0,0.71)" : "transparent",
                                    color: isActive ? "#000" : "#fff",
                                    borderRadius: "8px",
                                    margin: "4px",
                                    fontWeight: isActive ? "bold" : "normal",
                                    transition: "all 0.2s ease-in-out",
                                    "&:hover": {
                                        backgroundColor: isActive
                                            ? "rgba(232,121,28,0.8)"
                                            : "rgba(255, 255, 255, 0.05)",
                                        transform: "translateX(4px)",
                                    },
                                    "& .MuiListItemIcon-root": {
                                        color: isActive ? "#000" : "#fff",
                                    },
                                }}
                            >
                                <ListItemIcon
                                    sx={{
                                        minWidth: "40px",
                                        color: "inherit", // Наследует цвет от родителя (кнопки)
                                        transition: "transform 0.2s",
                                    }}
                                >
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText primary={item.text} />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>
        </Drawer>
    );
}
