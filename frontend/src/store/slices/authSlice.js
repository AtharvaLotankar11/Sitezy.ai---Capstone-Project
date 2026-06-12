import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api.js";
import { connectSocket } from "../../services/socket.js";

// Load persisted auth state
const storedUser = localStorage.getItem("sp_user");
const storedTenant = localStorage.getItem("sp_tenant");
const storedToken = localStorage.getItem("sp_token");

export const register = createAsyncThunk("auth/register", async (data, { rejectWithValue }) => {
    try {
        const res = await api.post("/auth/register", data);
        return res.data;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message || "Registration failed");
    }
});

export const login = createAsyncThunk("auth/login", async (data, { rejectWithValue }) => {
    try {
        const res = await api.post("/auth/login", data);
        return res.data;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message || "Login failed");
    }
});

export const getMe = createAsyncThunk("auth/me", async (_, { rejectWithValue }) => {
    try {
        const res = await api.get("/auth/me");
        return res.data;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

const authSlice = createSlice({
    name: "auth",
    initialState: {
        user: storedUser ? JSON.parse(storedUser) : null,
        tenant: storedTenant ? JSON.parse(storedTenant) : null,
        token: storedToken || null,
        loading: false,
        error: null,
    },
    reducers: {
        logout: (state) => {
            state.user = null;
            state.tenant = null;
            state.token = null;
            localStorage.removeItem("sp_token");
            localStorage.removeItem("sp_user");
            localStorage.removeItem("sp_tenant");
        },
        clearError: (state) => { state.error = null; },
        updateTenantBranding: (state, action) => {
            if (state.tenant) {
                state.tenant.branding = { ...state.tenant.branding, ...action.payload };
                localStorage.setItem("sp_tenant", JSON.stringify(state.tenant));
            }
        },
    },
    extraReducers: (builder) => {
        const handleFulfilled = (state, action) => {
            state.loading = false;
            state.error = null;
            state.user = action.payload.user;
            state.tenant = action.payload.tenant;
            state.token = action.payload.token;
            localStorage.setItem("sp_token", action.payload.token);
            localStorage.setItem("sp_user", JSON.stringify(action.payload.user));
            localStorage.setItem("sp_tenant", JSON.stringify(action.payload.tenant));
            connectSocket(action.payload.token);
        };

        builder
            .addCase(register.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(register.fulfilled, handleFulfilled)
            .addCase(register.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
            .addCase(login.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(login.fulfilled, handleFulfilled)
            .addCase(login.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
            .addCase(getMe.fulfilled, (state, action) => {
                state.user = action.payload.user;
                state.tenant = action.payload.tenant;
                localStorage.setItem("sp_user", JSON.stringify(action.payload.user));
                localStorage.setItem("sp_tenant", JSON.stringify(action.payload.tenant));
            });
    },
});

export const { logout, clearError, updateTenantBranding } = authSlice.actions;
export default authSlice.reducer;
