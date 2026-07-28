import { expect, it } from "vitest";
import {
    computeTimelineLayout,
    PX_PER_SECOND,
    NORMAL_GAP_PX,
    MAX_BLOCK_PX,
    MAX_IDLE_GAP_PX,
    TRACK_PAD_PX,
} from "./use-timeline-layout";

const b = (started: string, durMs: number) => ({
    key: started,
    started,
    ended: new Date(Date.parse(started) + durMs).toISOString(),
    durationInMs: durMs,
    processed: 100,
    read: 100,
    errors: 0,
    phases: [],
    allocatedBytes: null,
    stopReason: null,
});

it("scales block width by duration", () => {
    const { blocks } = computeTimelineLayout(
        [b("2026-07-28T08:00:00Z", 1000), b("2026-07-28T08:00:03Z", 2000)],
        Date.parse("2026-07-28T08:00:06Z"),
        false,
    );
    expect(blocks[0].widthPx).toBeCloseTo(1 * PX_PER_SECOND, 1);
    expect(blocks[1].widthPx).toBeCloseTo(2 * PX_PER_SECOND, 1);
});

it("lays batches contiguously and ignores idle time between them", () => {
    // The two batches are five minutes apart in real time, but the layout places the second
    // directly after the first plus one uniform gap. Idle time is not represented.
    const { blocks } = computeTimelineLayout(
        [b("2026-07-28T08:00:00Z", 1000), b("2026-07-28T08:05:00Z", 1000)],
        Date.parse("2026-07-28T08:05:02Z"),
        false,
    );
    expect(blocks[1].leftPx).toBeCloseTo(blocks[0].leftPx + blocks[0].widthPx + NORMAL_GAP_PX, 1);
});

it("caps a very long batch at MAX_BLOCK_PX so the track cannot grow without bound", () => {
    // A ten-minute batch would be 600s * PX_PER_SECOND px wide without the cap.
    const { blocks } = computeTimelineLayout(
        [b("2026-07-28T08:00:00Z", 600_000)],
        Date.parse("2026-07-28T08:11:00Z"),
        false,
    );
    expect(blocks[0].widthPx).toBe(MAX_BLOCK_PX);
});

it("insets the first block from the left edge", () => {
    const { blocks } = computeTimelineLayout(
        [b("2026-07-28T08:00:00Z", 1000)],
        Date.parse("2026-07-28T08:00:02Z"),
        false,
    );
    expect(blocks[0].leftPx).toBe(TRACK_PAD_PX);
});

it("represents idle time as a capped gap only when showIdle is on", () => {
    const batches = [b("2026-07-28T08:00:00Z", 1000), b("2026-07-28T08:05:00Z", 1000)];
    const nowMs = Date.parse("2026-07-28T08:05:02Z");

    // Five minutes apart: the idle span (~299s) far exceeds the cap, so the single gap is
    // clamped to MAX_IDLE_GAP_PX and still reports the true idle duration.
    const withIdle = computeTimelineLayout(batches, nowMs, true);
    expect(withIdle.gaps).toHaveLength(1);
    expect(withIdle.gaps[0].widthPx).toBe(MAX_IDLE_GAP_PX);
    expect(withIdle.gaps[0].idleMs).toBeGreaterThan(200_000);

    // The same input produces no gaps when idle time is not shown.
    const contiguous = computeTimelineLayout(batches, nowMs, false);
    expect(contiguous.gaps).toHaveLength(0);
});
