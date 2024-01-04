import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { services } from "components/hooks/useServices";
import { loadStatus } from "components/models/common";
import { RootState } from "components/store";
import database from "models/resources/database";
import moment from "moment";

export interface ConflictResolutionCollectionConfig {
    id: string;
    name: string;
    script: string;
    lastModifiedTime: string;
    isEdited: boolean;
    isInEditMode: boolean;
}

interface ConflictResolutionConfig {
    isResolveToLatest: boolean;
    collectionsConfigs: ConflictResolutionCollectionConfig[];
}

interface ConflictResolutionState {
    loadStatus: loadStatus;
    config: ConflictResolutionConfig;
}

const initialState: ConflictResolutionState = {
    loadStatus: "idle",
    config: null,
};

// TODO createEntityAdapter?

export const conflictResolutionSlice = createSlice({
    name: "conflictResolution",
    initialState,
    reducers: {
        toggleIsResolveToLatest: (state) => {
            state.config.isResolveToLatest = !state.config.isResolveToLatest;
        },
        add: (state) => {
            state.config.collectionsConfigs.push({
                id: _.uniqueId(),
                name: null,
                script: null,
                lastModifiedTime: moment().format(),
                isInEditMode: true,
                isEdited: true,
            });
        },
        edit: (state, { payload: collectionName }: { payload: string }) => {
            state.config.collectionsConfigs.find((c) => c.name === collectionName).isInEditMode = true;
        },
        discardEdit: (state, { payload: id }: { payload: string }) => {
            const collection = state.config.collectionsConfigs.find((c) => c.id === id);
            collection.isInEditMode = false;

            if (!collectionName) {
                state.config.collectionsConfigs = state.config.collectionsConfigs.filter((c) => c.name);
            }
        },
        saveEdit: (
            state,
            {
                payload,
            }: {
                payload: {
                    oldConfig: ConflictResolutionCollectionConfig;
                    newConfig: Pick<ConflictResolutionCollectionConfig, "name" | "script">;
                };
            }
        ) => {
            state.config.collectionsConfigs = state.config.collectionsConfigs.map((c) => {
                if (c.id === payload.oldConfig.id) {
                    return {
                        ...c,
                        isEdited: true,
                        isInEditMode: false,
                        lastModifiedTime: moment().format(),
                        name: payload.newConfig.name,
                        script: payload.newConfig.script,
                    };
                }
                return c;
            });
        },
        delete: (state, { payload: collectionName }: { payload: string }) => {
            state.config.collectionsConfigs = state.config.collectionsConfigs.filter((c) => c.name !== collectionName);
        },
        reset: () => initialState,
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchConfig.fulfilled, (state, { payload }) => {
                state.config = payload;
                state.loadStatus = "success";
            })
            .addCase(fetchConfig.pending, (state) => {
                state.loadStatus = "loading";
            })
            .addCase(fetchConfig.rejected, (state) => {
                state.loadStatus = "failure";
            });
    },
});

const fetchConfig = createAsyncThunk<ConflictResolutionConfig, database>(
    "conflictResolution/fetchConfig",
    async (db) => {
        const dto = await services.databasesService.getConflictSolverConfiguration(db);

        return {
            isResolveToLatest: dto.ResolveToLatest,
            collectionsConfigs: Object.keys(dto.ResolveByCollection).map((name) => ({
                id: _.uniqueId(),
                name,
                script: dto.ResolveByCollection[name].Script,
                lastModifiedTime: dto.ResolveByCollection[name].LastModifiedTime,
                isInEditMode: false,
                isEdited: false,
            })),
        };
    }
);

export const conflictResolutionActions = {
    ...conflictResolutionSlice.actions,
    fetchConfig,
};

export const conflictResolutionSelectors = {
    loadStatus: (store: RootState) => store.conflictResolution.loadStatus,
    config: (store: RootState) => store.conflictResolution.config,
};
