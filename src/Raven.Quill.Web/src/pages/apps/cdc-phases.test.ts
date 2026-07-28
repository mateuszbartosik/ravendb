import { expect, it } from "vitest";
import { toPhaseSegments } from "./cdc-phases";

it("returns fractions proportional to phase durations", () => {
    const segs = toPhaseSegments(
        [
            { name: "Read", durationInMs: 1288 },
            { name: "Script", durationInMs: 90 },
            { name: "Write", durationInMs: 22 },
        ],
        1400,
    );
    expect(segs.map((s) => s.label)).toEqual(["Read", "Script", "Write"]);
    expect(segs[0].fraction).toBeCloseTo(1288 / 1400, 3);
});

it("returns empty for no phases", () => {
    expect(toPhaseSegments([], 1000)).toEqual([]);
});

it("falls back to the sum of durations when total is not positive", () => {
    const segs = toPhaseSegments(
        [
            { name: "Read", durationInMs: 30 },
            { name: "Write", durationInMs: 10 },
        ],
        0,
    );
    expect(segs[0].fraction).toBeCloseTo(30 / 40, 3);
    expect(segs[1].fraction).toBeCloseTo(10 / 40, 3);
});
