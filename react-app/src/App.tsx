import {HashRouter, Routes, Route, Navigate, useLocation} from "react-router-dom";
import {CssBaseline, ThemeProvider, createTheme, Box} from "@mui/material";
import Sidebar from "./components/Sidebar";
import TasksPage from "./components/TasksPage";
import Wallets from "./components/Wallets";
import Settings from "./components/Settings";
import {Provider} from "react-redux";
import {store} from "./store/store";
import './styles/global.css'
import Header from "./components/Header";
import Tools from "./components/Tools";
import ConfigManager from "./components/ConfigManager";
import Statistic from "./components/Statistic";

const darkTheme = createTheme({
    palette: {
        mode: "dark",
        background: {default: "#0e0e0e"},
        text: {primary: "#fff"},
    },
    typography: {
        fontFamily: "'Tensor', sans-serif", // Добавь сюда шрифт
    },
});

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
                            <Route path="/tools" element={<Tools />} />
                            <Route path="/statistic" element={<Statistic />} />
                        </Routes>
                    </Box>
                </Box>
            </Box>
        </ThemeProvider>
    );
}

export default function App() {
    return (
        <Provider store={store}>
            <HashRouter>
                <Layout/>
            </HashRouter>
        </Provider>

    );
}
