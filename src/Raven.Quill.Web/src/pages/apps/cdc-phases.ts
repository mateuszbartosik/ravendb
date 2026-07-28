import type { CdcPhase } from "@/pages/apps/use-cdc-live-performance";

export type PhaseSegment = { label: string; durationInMs: number; fraction: number };

export function toPhaseSegments(phases: CdcPhase[], totalDurationInMs: number): PhaseSegment[] {
    if (phases.length === 0) {
        return [];
    }
    const total = totalDurationInMs > 0 ? totalDurationInMs : phases.reduce((sum, p) => sum + p.durationInMs, 0) || 1;
    return phases.map((p) => ({ label: p.name, durationInMs: p.durationInMs, fraction: p.durationInMs / total }));
}
