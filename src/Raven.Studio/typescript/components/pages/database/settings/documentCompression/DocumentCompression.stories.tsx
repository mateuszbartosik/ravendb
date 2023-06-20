import React from "react";
import { ComponentMeta, ComponentStory } from "@storybook/react";
import { withStorybookContexts, withBootstrap5 } from "test/storybookTestUtils";
import DocumentCompression from "./DocumentCompression";

export default {
    title: "Pages/Database/Settings/DocumentCompression",
    component: DocumentCompression,
    decorators: [withStorybookContexts, withBootstrap5],
} as ComponentMeta<typeof DocumentCompression>;

function commonInit() {
    // const { accessManager } = mockStore;
    // const { manageServerService } = mockServices;
    // accessManager.with_securityClearance("ClusterAdmin");
    // manageServerService.withGetDatabaseClientConfiguration();
}

export const DocumentCompressionView: ComponentStory<typeof DocumentCompression> = () => {
    // commonInit();

    // const { manageServerService } = mockServices;
    // manageServerService.withGetGlobalClientConfiguration();

    return <DocumentCompression />;
};
