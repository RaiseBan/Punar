import {createSlice} from "@reduxjs/toolkit";

export const telegramBotSlice = createSlice({
    name: 'telegramBot',
    initialState: {
        botToken: '',
        chatIds: [],
        isConnected: false,
    },
    reducers: {
        setBotConfig: (state, action) => {
            state.botToken = action.payload.botToken;
            state.chatIds = action.payload.chatIds;
            state.isConnected = !!action.payload.botToken;
        },
        setConnected: (state, action) => {
            state.isConnected = action.payload;
        }
    }
});

export const { setBotConfig, setConnected } = telegramBotSlice.actions;
export default telegramBotSlice.reducer;