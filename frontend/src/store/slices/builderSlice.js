import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api.js";

export const fetchPages = createAsyncThunk("builder/fetchPages", async (websiteId, { rejectWithValue }) => {
    try {
        const res = await api.get(`/builder/websites/${websiteId}/pages`);
        return res.data.pages;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

export const fetchPage = createAsyncThunk("builder/fetchPage", async ({ websiteId, pageId }, { rejectWithValue }) => {
    try {
        const res = await api.get(`/builder/websites/${websiteId}/pages/${pageId}`);
        return res.data.page;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

export const createPage = createAsyncThunk("builder/createPage", async ({ websiteId, data }, { rejectWithValue }) => {
    try {
        const res = await api.post(`/builder/websites/${websiteId}/pages`, data);
        return res.data.page;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

export const deletePage = createAsyncThunk("builder/deletePage", async ({ websiteId, pageId }, { rejectWithValue }) => {
    try {
        await api.delete(`/builder/websites/${websiteId}/pages/${pageId}`);
        return pageId;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

export const updateSections = createAsyncThunk("builder/updateSections", async ({ websiteId, pageId, sections }, { rejectWithValue }) => {
    try {
        const res = await api.put(`/builder/websites/${websiteId}/pages/${pageId}/sections`, { sections });
        return res.data.page;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

export const saveDraft = createAsyncThunk("builder/saveDraft", async ({ websiteId, pageId, layoutConfig }, { rejectWithValue }) => {
    try {
        const res = await api.post(`/builder/websites/${websiteId}/pages/${pageId}/save-draft`, { layoutConfig });
        return res.data.page;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

// ─── Version Control ────────────────────────────────────────────────
export const commitPage = createAsyncThunk("builder/commitPage", async ({ websiteId, pageId, message }, { rejectWithValue }) => {
    try {
        const res = await api.post(`/builder/websites/${websiteId}/pages/${pageId}/commit`, { message });
        return res.data.commit;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

export const fetchCommits = createAsyncThunk("builder/fetchCommits", async ({ websiteId, pageId }, { rejectWithValue }) => {
    try {
        const res = await api.get(`/builder/websites/${websiteId}/pages/${pageId}/commits`);
        return res.data.commits;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

export const rollbackToCommit = createAsyncThunk("builder/rollbackToCommit", async ({ websiteId, pageId, commitId }, { rejectWithValue }) => {
    try {
        const res = await api.post(`/builder/websites/${websiteId}/pages/${pageId}/rollback/${commitId}`);
        return res.data.page;
    } catch (err) {
        return rejectWithValue(err.response?.data?.message);
    }
});

const builderSlice = createSlice({
    name: "builder",
    initialState: {
        pages: [],
        currentPage: null,
        selectedSectionId: null,
        loading: false,
        saving: false,
        error: null,
        activeEditors: [],
        commits: [],
        commitsLoading: false,
    },
    reducers: {
        setCurrentPage: (state, action) => { state.currentPage = action.payload; },
        setSelectedSection: (state, action) => { state.selectedSectionId = action.payload; },
        updateLocalSections: (state, action) => {
            if (state.currentPage) {
                if (!state.currentPage.layoutConfig) state.currentPage.layoutConfig = { sections: [] };
                state.currentPage.layoutConfig.sections = action.payload;
            }
        },
        updateSectionProps: (state, action) => {
            const { sectionId, props } = action.payload;
            if (state.currentPage?.layoutConfig?.sections) {
                const section = state.currentPage.layoutConfig.sections.find((s) => s.id === sectionId);
                if (section) section.props = { ...section.props, ...props };
            }
        },
        setActiveEditors: (state, action) => { state.activeEditors = action.payload; },
        applyRemoteUpdate: (state, action) => {
            if (state.currentPage) {
                if (!state.currentPage.layoutConfig) state.currentPage.layoutConfig = { sections: [] };

                if (!state.selectedSectionId) {
                    state.currentPage.layoutConfig.sections = action.payload.sections;
                } else {
                    // We are currently editing a section. So we merge the remote sections
                    // but we keep our local version of the section we are currently editing.
                    const mySection = state.currentPage.layoutConfig.sections.find(s => s.id === state.selectedSectionId);

                    const mergedSections = action.payload.sections.map(s => {
                        return (s.id === state.selectedSectionId && mySection) ? mySection : s;
                    });

                    state.currentPage.layoutConfig.sections = mergedSections;
                }
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPages.pending, (state) => { state.loading = true; })
            .addCase(fetchPages.fulfilled, (state, action) => { state.loading = false; state.pages = action.payload; })
            .addCase(fetchPages.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
            .addCase(fetchPage.fulfilled, (state, action) => { state.currentPage = action.payload; })
            .addCase(createPage.fulfilled, (state, action) => { state.pages.push(action.payload); })
            .addCase(deletePage.fulfilled, (state, action) => {
                state.pages = state.pages.filter((p) => p._id !== action.payload);
            })
            .addCase(updateSections.pending, (state) => { state.saving = true; })
            .addCase(updateSections.fulfilled, (state, action) => { state.saving = false; state.currentPage = action.payload; })
            .addCase(updateSections.rejected, (state) => { state.saving = false; })
            .addCase(saveDraft.pending, (state) => { state.saving = true; })
            .addCase(saveDraft.fulfilled, (state, action) => { state.saving = false; state.currentPage = action.payload; })
            .addCase(saveDraft.rejected, (state) => { state.saving = false; })
            // Version control
            .addCase(commitPage.fulfilled, (state, action) => { state.commits.unshift(action.payload); })
            .addCase(fetchCommits.pending, (state) => { state.commitsLoading = true; })
            .addCase(fetchCommits.fulfilled, (state, action) => { state.commitsLoading = false; state.commits = action.payload; })
            .addCase(fetchCommits.rejected, (state) => { state.commitsLoading = false; })
            .addCase(rollbackToCommit.fulfilled, (state, action) => { state.currentPage = action.payload; });
    },
});

export const {
    setCurrentPage,
    setSelectedSection,
    updateLocalSections,
    updateSectionProps,
    setActiveEditors,
    applyRemoteUpdate,
} = builderSlice.actions;
export default builderSlice.reducer;
