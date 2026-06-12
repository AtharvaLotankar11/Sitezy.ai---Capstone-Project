import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api.js";

export const fetchWebsites = createAsyncThunk("website/fetchAll", async (_, { rejectWithValue }) => {
    try {
        const res = await api.get("/websites");
        return res.data.websites;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

export const fetchWebsite = createAsyncThunk("website/fetchOne", async (id, { rejectWithValue }) => {
    try {
        const res = await api.get(`/websites/${id}`);
        return res.data.website;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

export const createWebsite = createAsyncThunk("website/create", async (data, { rejectWithValue }) => {
    try {
        const res = await api.post("/websites", data);
        return res.data.website;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

export const deleteWebsite = createAsyncThunk("website/delete", async (id, { rejectWithValue }) => {
    try {
        await api.delete(`/websites/${id}`);
        return id;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

export const publishWebsite = createAsyncThunk("website/publish", async ({ id, domainId }, { rejectWithValue }) => {
    try {
        const res = await api.post(`/websites/${id}/publish`, { domainId: domainId || undefined });
        return res.data.website;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

export const fetchDomains = createAsyncThunk("website/fetchDomains", async (_, { rejectWithValue }) => {
    try {
        const res = await api.get("/domains");
        return res.data.domains;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

const websiteSlice = createSlice({
    name: "website",
    initialState: {
        websites: [],
        currentWebsite: null,
        domains: [],
        loading: false,
        error: null,
    },
    reducers: {
        setCurrentWebsite: (state, action) => { state.currentWebsite = action.payload; },
        clearWebsiteError: (state) => { state.error = null; },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchWebsites.pending, (state) => { state.loading = true; })
            .addCase(fetchWebsites.fulfilled, (state, action) => { state.loading = false; state.websites = action.payload; })
            .addCase(fetchWebsites.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
            .addCase(fetchWebsite.fulfilled, (state, action) => { state.currentWebsite = action.payload; })
            .addCase(createWebsite.fulfilled, (state, action) => { state.websites.unshift(action.payload); })
            .addCase(deleteWebsite.fulfilled, (state, action) => {
                state.websites = state.websites.filter((w) => w._id !== action.payload);
            })
            .addCase(publishWebsite.fulfilled, (state, action) => {
                const idx = state.websites.findIndex((w) => w._id === action.payload._id);
                if (idx !== -1) state.websites[idx] = action.payload;
                if (state.currentWebsite?._id === action.payload._id) state.currentWebsite = action.payload;
            })
            .addCase(fetchDomains.fulfilled, (state, action) => { state.domains = action.payload; });
    },
});

export const { setCurrentWebsite, clearWebsiteError } = websiteSlice.actions;
export default websiteSlice.reducer;
