import type { Meta, StoryObj } from "@storybook/react-vite";
import { CdcHealthHeader } from "./cdc-health-header";

const meta = {
    title: "Apps/CDC health header",
    component: CdcHealthHeader,
} satisfies Meta<typeof CdcHealthHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Syncing: Story = {
    args: {
        status: "active",
        recentWrites: 33_400,
        errorCount: 0,
        lastWriteLabel: "just now",
        batchCount: 51,
    },
};

export const Idle: Story = {
    args: {
        status: "idle",
        recentWrites: 33_400,
        errorCount: 0,
        lastWriteLabel: "just now",
        batchCount: 51,
    },
};

export const SyncError: Story = {
    args: {
        status: "error",
        recentWrites: 33_400,
        errorCount: 3,
        lastWriteLabel: "just now",
        batchCount: 51,
    },
};
