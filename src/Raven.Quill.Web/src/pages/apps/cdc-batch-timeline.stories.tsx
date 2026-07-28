import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import type { CdcLiveBatch } from "@/pages/apps/use-cdc-live-performance";
import { CdcBatchTimeline } from "./cdc-batch-timeline";
import { makeBatches } from "./cdc-batch-timeline.fixtures";

const NOW = Date.parse("2026-07-28T08:30:00Z");

const meta = {
    title: "Apps/CDC batch timeline",
    component: CdcBatchTimeline,
} satisfies Meta<typeof CdcBatchTimeline>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Healthy: Story = { args: { batches: makeBatches(), nowMs: NOW } };

export const WithError: Story = {
    args: { batches: makeBatches({ withError: true }), nowMs: NOW },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const failed = canvas.getByRole("button", { name: /read error/i });
        await userEvent.click(failed);
        await expect(await canvas.findByText(/reported/i)).toBeVisible();
    },
};

export const Empty: Story = { args: { batches: [], nowMs: NOW } };

// A live showcase: the feed advances on a timer so the in-progress bar grows, its counts
// tick up, and each batch completes as success or error before the next one starts. All
// variation is derived from the batch sequence number so the animation is deterministic.
const DEMO_START_MS = Date.parse("2026-07-28T08:30:00.000Z");
const TICK_INTERVAL_MS = 200;
const STEP_MS = 180;
const SEED_BATCH_COUNT = 5;
const MAX_BATCHES = 18;

type DemoState = { batches: CdcLiveBatch[]; nowMs: number };

// Cycles 1.8s, 2.3s, 2.8s, 3.3s so successive bars differ in width.
function targetDurationFor(seq: number): number {
    return 1800 + (seq % 4) * 500;
}

// Every fifth batch fails so the story exercises both the success and error paths.
function isErrorSeq(seq: number): boolean {
    return seq % 5 === 4;
}

function seqFromKey(key: string): number {
    return Number(key.slice(key.lastIndexOf("/") + 1));
}

function completedBatch(seq: number, startedMs: number, durationInMs: number): CdcLiveBatch {
    const base = {
        key: `task/0/${seq}`,
        started: new Date(startedMs).toISOString(),
        ended: new Date(startedMs + durationInMs).toISOString(),
        durationInMs,
    };
    if (isErrorSeq(seq)) {
        const read = 210 + (seq % 4) * 18;
        return {
            ...base,
            read,
            processed: Math.round(read * 0.55),
            errors: 1,
            allocatedBytes: 2_600_000,
            stopReason: "Read error",
            phases: [{ name: "Read", durationInMs: Math.round(durationInMs * 0.9) }],
        };
    }
    const read = 360 + (seq % 6) * 24;
    const readMs = Math.round(durationInMs * 0.24);
    const scriptMs = Math.round(durationInMs * 0.54);
    return {
        ...base,
        read,
        processed: read,
        errors: 0,
        allocatedBytes: 2_000_000 + (seq % 5) * 220_000,
        stopReason: "Batch size reached",
        phases: [
            { name: "Read", durationInMs: readMs },
            { name: "Script", durationInMs: scriptMs },
            { name: "Write", durationInMs: durationInMs - readMs - scriptMs },
        ],
    };
}

function inProgressBatch(seq: number, startedMs: number): CdcLiveBatch {
    return {
        key: `task/0/${seq}`,
        started: new Date(startedMs).toISOString(),
        ended: null,
        durationInMs: 0,
        processed: 4,
        read: 6,
        errors: 0,
        allocatedBytes: 1_400_000,
        stopReason: null,
        phases: [],
    };
}

function initialDemoState(): DemoState {
    const batches: CdcLiveBatch[] = [];
    let cursor = DEMO_START_MS;
    for (let seq = 0; seq < SEED_BATCH_COUNT; seq++) {
        const duration = targetDurationFor(seq);
        batches.push(completedBatch(seq, cursor, duration));
        cursor += duration;
    }
    batches.push(inProgressBatch(SEED_BATCH_COUNT, cursor));
    return { batches, nowMs: cursor + 400 };
}

// One timer tick: advance the clock, grow the in-progress batch, and complete it when it
// reaches its target duration (starting the next one contiguously right after).
function advanceDemo(prev: DemoState): DemoState {
    const nowMs = prev.nowMs + STEP_MS;
    const batches = prev.batches.slice();
    const lastIndex = batches.length - 1;
    const current = batches[lastIndex];
    const startedMs = Date.parse(current.started);
    const seq = seqFromKey(current.key);
    const target = targetDurationFor(seq);

    if (nowMs - startedMs >= target) {
        batches[lastIndex] = completedBatch(seq, startedMs, target);
        batches.push(inProgressBatch(seq + 1, startedMs + target));
    } else {
        batches[lastIndex] = {
            ...current,
            read: current.read + 8 + (seq % 3),
            processed: current.processed + 6 + (seq % 3),
        };
    }

    const bounded = batches.length > MAX_BATCHES ? batches.slice(batches.length - MAX_BATCHES) : batches;
    return { batches: bounded, nowMs };
}

function LiveProgressDemo() {
    const [state, setState] = useState<DemoState>(initialDemoState);

    useEffect(() => {
        const id = window.setInterval(() => setState(advanceDemo), TICK_INTERVAL_MS);
        return () => window.clearInterval(id);
    }, []);

    return <CdcBatchTimeline batches={state.batches} nowMs={state.nowMs} />;
}

// The demo component owns its own state, so these args are only here to satisfy the story
// type; the render function ignores them.
export const LiveProgress: Story = {
    args: { batches: [], nowMs: NOW },
    render: () => <LiveProgressDemo />,
};
