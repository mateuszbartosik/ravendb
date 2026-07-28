import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CdcError } from "@/api/generated/server-api";
import { CdcErrorsPanel } from "./cdc-errors-panel";

const meta = {
    title: "Apps/CDC errors panel",
    component: CdcErrorsPanel,
} satisfies Meta<typeof CdcErrorsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

// Mirrors `sampleCdcErrors` in `@/mocks/apps-mocks`.
const sampleErrors: CdcError[] = [
    {
        taskName: "cdc/demo-shop",
        createdAt: "2026-07-21T08:12:45Z",
        step: "Script processing",
        error: "TypeError: Cannot read properties of undefined (reading 'Price') at transform(orders) line 12",
        documentId: "orders/1042-A",
        affectedDocumentsCount: null,
    },
    {
        taskName: "cdc/demo-shop",
        createdAt: "2026-07-21T08:12:47Z",
        step: "Script processing",
        error: "Invalid date value '0000-00-00' in column ShippedAt; the value cannot be converted to a document property",
        documentId: "orders/1055-A",
        affectedDocumentsCount: null,
    },
    {
        taskName: "cdc/demo-shop",
        createdAt: "2026-07-21T08:14:02Z",
        step: "Read",
        error: "Connection to the source database was lost while reading the change stream; the batch will be retried",
        documentId: null,
        affectedDocumentsCount: 128,
    },
];

// This mounts `CdcErrorsSheet`, which only fetches once opened. No need to open it here.
export const WithErrors: Story = {
    args: { slug: "demo", errors: sampleErrors },
};

export const None: Story = {
    args: { slug: "demo", errors: [] },
};
