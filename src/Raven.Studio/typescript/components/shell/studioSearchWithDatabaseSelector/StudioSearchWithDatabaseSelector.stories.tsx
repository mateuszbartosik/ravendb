import React from "react";
import { Meta } from "@storybook/react";
import { withStorybookContexts, withBootstrap5 } from "test/storybookTestUtils";
import StudioSearchWithDatabaseSelector from "./StudioSearchWithDatabaseSelector";
import { mockStore } from "test/mocks/store/MockStore";
import { mockServices } from "test/mocks/services/MockServices";

export default {
    title: "Shell/StudioSearchWithDatabaseSelector",
    decorators: [withStorybookContexts, withBootstrap5],
} satisfies Meta;

export const Default = () => {
    const { databasesService, indexesService, tasksService } = mockServices;
    const { databases, collectionsTracker } = mockStore;

    databasesService.withDocumentsMetadataByIDPrefix();
    indexesService.withGetSampleStats();
    tasksService.withGetTasks();

    databases.with_Sharded();
    databases.withActiveDatabase_NonSharded_SingleNode();

    collectionsTracker.with_Collections();

    return <StudioSearchWithDatabaseSelector />;
};
