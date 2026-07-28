import type { CdcLiveBatch } from "@/pages/apps/use-cdc-live-performance";

// Pure layout math for the CDC batch timeline. NOT a React hook despite the `use-` file
// name (kept for file-naming consistency); the timeline component consumes this to render.

export const PX_PER_SECOND = 42;
export const NORMAL_GAP_PX = 11;
// Left inset so the first bar and its start timestamp are not flush against the track edge.
export const TRACK_PAD_PX = 16;
// One very long (or long-running in-progress) batch would otherwise stretch the track far
// enough to make scrolling feel endless, so bar width is capped. The exact duration stays
// available in the batch detail on hover.
export const MAX_BLOCK_PX = 240;
// When idle time is shown, a long quiet stretch would blow the track width out, so the gap
// that represents it is capped too. Beyond this width the gap simply reads as "very idle".
export const MAX_IDLE_GAP_PX = 160;

export type TimelineBlock = {
    key: string;
    leftPx: number;
    widthPx: number;
    batch: CdcLiveBatch;
};

export type TimelineGap = {
    leftPx: number;
    widthPx: number;
    idleMs: number;
};

export type TimelineLayout = {
    blocks: TimelineBlock[];
    gaps: TimelineGap[];
    totalWidthPx: number;
    nowLeftPx: number;
};

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

// The moment a batch stops occupying the sink: its completion time, or (while still running)
// its start plus the duration observed so far.
function endMsOf(batch: CdcLiveBatch): number {
    return batch.ended === null ? Date.parse(batch.started) + batch.durationInMs : Date.parse(batch.ended);
}

// Bar width always encodes duration on the true PX_PER_SECOND scale. When `showIdle` is off
// batches sit contiguously with a uniform gap and idle time is not represented; when it is on
// the gap between batches grows with the idle span (capped) and is reported in `gaps`.
export function computeTimelineLayout(batches: CdcLiveBatch[], nowMs: number, showIdle: boolean): TimelineLayout {
    if (batches.length === 0) {
        return { blocks: [], gaps: [], totalWidthPx: 0, nowLeftPx: 0 };
    }

    const blocks: TimelineBlock[] = [];
    const gaps: TimelineGap[] = [];
    let x = TRACK_PAD_PX;

    batches.forEach((batch, index) => {
        const leftPx = x;
        const durMs = batch.ended === null ? Math.max(0, nowMs - Date.parse(batch.started)) : batch.durationInMs;
        const widthPx = Math.min(MAX_BLOCK_PX, Math.max(8, (durMs / 1000) * PX_PER_SECOND));
        blocks.push({ key: batch.key, leftPx, widthPx, batch });
        x += widthPx;

        if (index < batches.length - 1) {
            if (showIdle) {
                const idleMs = Math.max(0, Date.parse(batches[index + 1].started) - endMsOf(batch));
                const gapPx = clamp(Math.round((idleMs / 1000) * PX_PER_SECOND), NORMAL_GAP_PX, MAX_IDLE_GAP_PX);
                gaps.push({ leftPx: x, widthPx: gapPx, idleMs });
                x += gapPx;
            } else {
                x += NORMAL_GAP_PX;
            }
        }
    });

    const lastBlock = blocks[blocks.length - 1];
    const nowLeftPx = lastBlock.leftPx + lastBlock.widthPx + 6;
    const totalWidthPx = nowLeftPx + 70;

    return { blocks, gaps, totalWidthPx, nowLeftPx };
}
