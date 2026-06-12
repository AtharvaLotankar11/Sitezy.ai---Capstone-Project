import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice.js";
import websiteReducer from "./slices/websiteSlice.js";
import builderReducer from "./slices/builderSlice.js";

const store = configureStore({
    reducer: {
        auth: authReducer,
        website: websiteReducer,
        builder: builderReducer,
    },
    devTools: process.env.NODE_ENV !== "production",
});

export default store;
