import type { Meta, StoryObj } from "@storybook/react-vite";
import { appsMocks } from "@/mocks/apps-mocks";
import { CdcSyncMini } from "./cdc-sync-mini";

const meta = {
    title: "Apps/CDC sync mini",
    component: CdcSyncMini,
    args: { slug: "demo" },
} satisfies Meta<typeof CdcSyncMini>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
    parameters: {
        msw: {
            handlers: {
                apps: [appsMocks.cdcProgress(), appsMocks.cdcErrors([])],
            },
        },
    },
};

// The default stored errors list is non-empty, so the inline error note and its "View"
// trigger for CdcErrorsSheet show beneath the health row.
export const WithErrors: Story = {
    parameters: {
        msw: {
            handlers: {
                apps: [appsMocks.cdcProgress(), appsMocks.cdcErrors()],
            },
        },
    },
};
