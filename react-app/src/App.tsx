import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme, Box } from "@mui/material";
import Sidebar from "./components/Sidebar";
import TasksPage from "./components/TasksPage";
import Wallets from "./components/Wallets/Wallets";
import Settings from "./components/Settings/Settings";
import { Provider, useSelector } from "react-redux";
import { store, RootState } from "./store/store";
import './styles/global.css'
import Header from "./components/Header";
import Tools from "./components/Tools";
import ConfigManager from "./components/ConfigManager";
import Statistic from "./components/Statistic";
import TxHistorySearch from "./components/TransactionHistory";
import TelegramBotSettings from "./components/TelegramBotSettings";
import { useEffect } from "react";

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

// Новый компонент для IPC-связи
function IpcHandler() {
    const tasks = useSelector((state: RootState) => state.tasks.tasks);

    useEffect(() => {
        // Слушатель для запроса задач из main процесса
        const handleGetTasks = () => {
            console.log('[IpcHandler] Received get-tasks-request, sending tasks:', tasks.length);
            window.electronAPI?.sendToMain('telegram-tasks-response', tasks);
        };

        window.electronAPI?.listenForTasks?.(handleGetTasks);

        return () => {
            window.electronAPI?.removeTasksListener?.();
        };
    }, [tasks]); // Перерегистрируем слушатель при изменении задач

    return null; // Компонент не рендерит UI
}

function Layout() {
    const location = useLocation();
    const isAuthPage = location.pathname === "/";

    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            {/* Главный контейнер с горизонтальным расположением */}
            <Box
                sx={{
                    display: "flex",
                    width: "100vw",
                    height: "100vh",
                    overflow: "hidden",
                }}
            >
                {/* Сайдбар (если не на "/") */}
                {!isAuthPage && <Sidebar />}

                {/* Правая часть (хедер и основной контент) */}
                <Box sx={{
                    display: "flex",
                    flexDirection: "column",
                    flexGrow: 1,
                    overflow: "hidden",
                }}>
                    {/* Хедер */}
                    <Header />

                    {/* Основная область с контентом */}
                    <Box sx={{
                        flexGrow: 1,
                        overflow: "auto",
                        p: 2,
                        position: 'relative',
                        height: 'calc(100vh - 64px)' // Учитываем высоту хедера
                    }}>
                        <Routes>
                            {/* На "/" перенаправляем сразу на /tasks */}
                            <Route path="/" element={<Navigate to="/tasks" replace />} />
                            <Route path="/tasks" element={<TasksPage />} />
                            <Route path="/wallets" element={<Wallets />} />
                            <Route path="/scriptConfigs" element={<ConfigManager />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/telegram" element={<TelegramBotSettings />} />
                            <Route path="/tools" element={<Tools />} />
                            <Route path="/statistic" element={<Statistic />} />
                            <Route path="/lag" element={<TxHistorySearch />} />
                        </Routes>
                    </Box>
                </Box>
            </Box>

            {/* Компонент для IPC-связи */}
            <IpcHandler />
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
