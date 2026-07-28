import { expect, it } from "vitest";
import { shapeForTest } from "./use-cdc-live-performance";

const raw = {
    Id: 1,
    Started: "2026-07-28T08:00:00.000Z",
    Completed: "2026-07-28T08:00:01.400Z",
    DurationInMs: 1400,
    NumberOfReadMessages: 306,
    NumberOfProcessedMessages: 178,
    ScriptProcessingErrorCount: 0,
    ReadErrorCount: 1,
    CurrentlyAllocated: { SizeInBytes: 3_040_870 },
    BatchPullStopReason: "Read error",
    Details: {
        Name: "Batch",
        DurationInMs: 1400,
        Operations: [
            { Name: "Read", DurationInMs: 1288 },
            { Name: "Script", DurationInMs: 90 },
            { Name: "Write", DurationInMs: 22 },
        ],
    },
};

it("carries read count, allocated bytes, stop reason and phases", () => {
    const perf = shapeForTest([raw]);
    const b = perf.recentBatches[0];
    expect(b.read).toBe(306);
    expect(b.processed).toBe(178);
    expect(b.allocatedBytes).toBe(3_040_870);
    expect(b.stopReason).toBe("Read error");
    expect(b.phases).toEqual([
        { name: "Read", durationInMs: 1288 },
        { name: "Script", durationInMs: 90 },
        { name: "Write", durationInMs: 22 },
    ]);
});
