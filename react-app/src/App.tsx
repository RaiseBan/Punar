import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme, Box } from "@mui/material";
import Sidebar from "./components/Sidebar";
import TasksPage from "./components/TasksPage";
import Wallets from "./components/Wallets";
import Settings from "./components/Settings";
import { Provider } from "react-redux";
import { store } from "./store/store";
import './styles/global.css'

const darkTheme = createTheme({
    palette: {
        mode: "dark",
        background: { default: "#0e0e0e" },
        text: { primary: "#fff" },
    },
    typography: {
        fontFamily: "'Tensor', sans-serif", // Добавь сюда шрифт
    },
});

function Layout() {
    const location = useLocation();
    const isAuthPage = location.pathname === "/"; // Если на "/" — без Sidebar

    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            {/* Контейнер на всё окно с display:flex */}
            <Box
                sx={{
                    display: "flex",
                    width: "100vw",
                    height: "100vh",
                    overflow: "hidden", // чтобы основные скроллы шли в главном контенте
                }}
            >
                {/* Сайдбар (если не на "/" ) */}
                {!isAuthPage && <Sidebar />}

                {/* Основная часть экрана (справа) со скроллом */}
                <Box sx={{ flexGrow: 1, overflow: "auto", p: 2 }}>
                    <Routes>
                        {/* На "/" перенаправляем сразу на /tasks */}
                        <Route path="/" element={<Navigate to="/tasks" replace />} />
                        <Route path="/tasks" element={<TasksPage />} />
                        <Route path="/wallets" element={<Wallets />} />
                        <Route path="/settings" element={<Settings />} />
                    </Routes>
                </Box>
            </Box>
        </ThemeProvider>
    );
}

export default function App() {
    return (
        <Provider store={store}>
            <HashRouter>
                <Layout />
            </HashRouter>
        </Provider>

    );
}
