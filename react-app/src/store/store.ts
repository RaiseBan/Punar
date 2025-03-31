import { configureStore } from "@reduxjs/toolkit";
import tasksReducer from "./tasksSlice";
import {electronMiddleware} from "./middleware/electronMiddleware";
import telegramBotReducer from './telegramBotSlice';

export const store = configureStore({
    reducer: {
        tasks: tasksReducer,
        telegramBot: telegramBotReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(electronMiddleware),

});

export type RootState  = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
