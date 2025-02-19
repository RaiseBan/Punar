import { List, ListItem, ListItemButton, ListItemText, Drawer, Toolbar, Typography } from "@mui/material";
import { Link, useLocation } from "react-router-dom";

const menuItems = [
    { text: "Home", path: "/home", icon: "🏠" },
    { text: "TasksPage", path: "/tasks", icon: "📝" },
    { text: "Wallets", path: "/wallets", icon: "💰" },
    { text: "Proxies", path: "/proxies", icon: "📡" },
    { text: "Tools", path: "/tools", icon: "🛠" },
    { text: "Settings", path: "/settings", icon: "⚙️" },
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
                    backgroundColor: "#0e0e0e", // Sidebar ЧЕРНЫЙ
                    color: "#fff",
                    borderRight: "1px solid #1c1c1c",
                    padding: "10px",
                },
            }}
        >
            <Toolbar>
                <Typography variant="h6" sx={{ color: "#fff", margin: "auto" }}>
                    Lunar
                </Typography>
            </Toolbar>
            <List>
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <ListItem key={item.text} disablePadding>
                            <ListItemButton
                                component={Link}
                                to={item.path}
                                sx={{
                                    backgroundColor: isActive ? "rgba(255,136,0,0.52)" : "transparent", // Оранжевый, но прозрачный
                                    color: isActive ? "#000" : "#fff", // Черный текст в активной вкладке
                                    borderRadius: "8px",
                                    margin: "4px",
                                    fontWeight: isActive ? "bold" : "normal",
                                    transition: "background-color 0.2s ease-in-out",
                                    "&:hover": {
                                        backgroundColor: isActive ? "rgba(255, 158, 68, 0.8)" : "#292929", // Чуть ярче при наведении
                                    },
                                }}
                            >
                                <span style={{ marginRight: "10px" }}>{item.icon}</span>
                                <ListItemText primary={item.text} />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>
        </Drawer>
    );
}
