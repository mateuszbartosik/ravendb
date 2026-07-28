import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CdcLiveBatch } from "@/pages/apps/use-cdc-live-performance";
import { CdcBatchDetail } from "./cdc-batch-detail";

const healthyBatch: CdcLiveBatch = {
    key: "task/0/26",
    started: "2026-07-28T16:22:00.000Z",
    ended: "2026-07-28T16:22:01.400Z",
    durationInMs: 1400,
    read: 486,
    processed: 486,
    errors: 0,
    allocatedBytes: 2_950_000,
    stopReason: "Batch size reached",
    phases: [
        { name: "Read", durationInMs: 308 },
        { name: "Script", durationInMs: 812 },
        { name: "Write", durationInMs: 280 },
    ],
};

const failedBatch: CdcLiveBatch = {
    key: "task/0/31",
    started: "2026-07-28T16:23:10.000Z",
    ended: "2026-07-28T16:23:12.400Z",
    durationInMs: 2400,
    read: 306,
    processed: 178,
    errors: 1,
    allocatedBytes: 2_900_000,
    stopReason: "Read error",
    phases: [{ name: "Read", durationInMs: 2400 }],
};

const meta = {
    title: "Apps/CDC batch detail",
    component: CdcBatchDetail,
    decorators: [
        (Story) => (
            <div className="max-w-xl">
                <Story />
            </div>
        ),
    ],
    args: {
        onClose: () => {},
    },
} satisfies Meta<typeof CdcBatchDetail>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
    args: { batch: healthyBatch },
};

export const Failed: Story = {
    args: { batch: failedBatch },
};
