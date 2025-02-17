import { configureStore } from "@reduxjs/toolkit";
import tasksReducer from "./tasksSlice";
import {electronMiddleware} from "./middleware/electronMiddleware";

export const store = configureStore({
    reducer: {
        tasks: tasksReducer,

    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(electronMiddleware),

});

export type RootState  = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
