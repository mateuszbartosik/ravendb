import type { CdcLiveBatch, CdcPhase } from "@/pages/apps/use-cdc-live-performance";

// Deterministic sample data for the batch timeline stories. No Math.random: the same call
// always yields the same batches so the visual and play tests are stable. Timestamps are
// anchored to the stories' NOW so the trailing in-progress batch has a realistic width.
const ANCHOR_MS = Date.parse("2026-07-28T08:30:00.000Z");
const BATCH_COUNT = 30;
const FIRST_BATCH_ID = 26;

// Structural landmarks the layout and detail views should exercise.
const SLOW_INDEX = 22;
const ERROR_INDEX = 27;

// A varied, realistic spread of idle spans between batches, as a repeating pattern so the
// stories stay deterministic. Mixing sub-second-scale with multi-minute gaps means the idle
// toggle shows differing widths and labels instead of a uniform "1m idle" everywhere.
const IDLE_PATTERN_MS = [2_000, 45_000, 3_000, 120_000, 8_000, 30_000, 1_500, 75_000, 5_000, 200_000, 90_000, 20_000];
// The final batch is still running; it has been going for this long at ANCHOR_MS.
const IN_PROGRESS_ELAPSED_MS = 800;

function idleAfterFor(index: number): number {
    return IDLE_PATTERN_MS[index % IDLE_PATTERN_MS.length];
}

type BatchDescriptor = {
    read: number;
    processed: number;
    errors: number;
    durationInMs: number;
    allocatedBytes: number;
    stopReason: string | null;
    idleAfterMs: number;
    inProgress: boolean;
    isError: boolean;
};

// Stable 0..1 wobble so successive batches vary without any randomness.
function wobble(seed: number): number {
    return Math.abs(Math.sin(seed));
}

function describeBatch(index: number, withError: boolean): BatchDescriptor {
    const inProgress = index === BATCH_COUNT - 1;
    const isError = withError && index === ERROR_INDEX;

    if (inProgress) {
        return {
            read: 214,
            processed: 214,
            errors: 0,
            durationInMs: IN_PROGRESS_ELAPSED_MS,
            allocatedBytes: 2_100_000,
            stopReason: null,
            idleAfterMs: 0,
            inProgress: true,
            isError: false,
        };
    }

    if (isError) {
        return {
            read: 306,
            processed: 178,
            errors: 1,
            durationInMs: 2400,
            allocatedBytes: 2_900_000,
            stopReason: "Read error",
            idleAfterMs: idleAfterFor(index),
            inProgress: false,
            isError: true,
        };
    }

    const read = 486 + Math.round(Math.sin(index * 0.7) * 10);
    const durationInMs = index === SLOW_INDEX ? 2400 : Math.round(1000 + wobble(index * 1.1) * 1200);
    const allocatedBytes = index === SLOW_INDEX ? 3_400_000 : Math.round((2 + wobble(index)) * 1_000_000);
    const idleAfterMs = idleAfterFor(index);

    return {
        read,
        processed: read,
        errors: 0,
        durationInMs,
        allocatedBytes,
        stopReason: "Batch size reached",
        idleAfterMs,
        inProgress: false,
        isError: false,
    };
}

function phasesFor(descriptor: BatchDescriptor): CdcPhase[] {
    if (descriptor.isError) {
        return [{ name: "Read", durationInMs: Math.round(descriptor.durationInMs * 0.9) }];
    }
    if (descriptor.inProgress) {
        return [
            { name: "Read", durationInMs: 300 },
            { name: "Script", durationInMs: 500 },
        ];
    }
    const read = Math.round(descriptor.durationInMs * 0.22);
    const script = Math.round(descriptor.durationInMs * 0.58);
    return [
        { name: "Read", durationInMs: read },
        { name: "Script", durationInMs: script },
        { name: "Write", durationInMs: descriptor.durationInMs - read - script },
    ];
}

export function makeBatches(options: { withError?: boolean } = {}): CdcLiveBatch[] {
    const withError = options.withError ?? false;
    const descriptors = Array.from({ length: BATCH_COUNT }, (_, index) => describeBatch(index, withError));

    // Place batches on the clock by walking backwards from ANCHOR_MS: the last batch is
    // still running, and each earlier batch ends one idle span before the next one starts.
    const startedMs = new Array<number>(BATCH_COUNT);
    startedMs[BATCH_COUNT - 1] = ANCHOR_MS - IN_PROGRESS_ELAPSED_MS;
    for (let index = BATCH_COUNT - 2; index >= 0; index--) {
        startedMs[index] = startedMs[index + 1] - descriptors[index].idleAfterMs - descriptors[index].durationInMs;
    }

    return descriptors.map((descriptor, index) => ({
        key: `task/0/${FIRST_BATCH_ID + index}`,
        started: new Date(startedMs[index]).toISOString(),
        ended: descriptor.inProgress ? null : new Date(startedMs[index] + descriptor.durationInMs).toISOString(),
        durationInMs: descriptor.durationInMs,
        processed: descriptor.processed,
        errors: descriptor.errors,
        read: descriptor.read,
        allocatedBytes: descriptor.allocatedBytes,
        stopReason: descriptor.stopReason,
        phases: phasesFor(descriptor),
    }));
}
