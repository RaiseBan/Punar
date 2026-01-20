import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { store } from "./store/store";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Делаем store доступным глобально для IPC взаимодействия
declare global {
    interface Window {
        getReduxState: () => any;
    }
}

// Создаем функцию для получения состояния
window.getReduxState = () => {
    return store.getState();
};

ReactDOM.createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
);
