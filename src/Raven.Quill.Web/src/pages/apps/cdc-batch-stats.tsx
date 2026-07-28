import type { ReactNode } from "react";
import { formatBytes, formatCompact } from "@/lib/format";
import { cn, formatDateTime } from "@/lib/utils";
import type { CdcLiveBatch } from "@/pages/apps/use-cdc-live-performance";

function StatRow({
    label,
    value,
    valueClassName,
}: {
    label: string;
    value: ReactNode;
    valueClassName?: string;
}): ReactNode {
    return (
        <div className="flex items-baseline justify-between gap-6 py-1 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className={cn("font-mono text-foreground tabular-nums", valueClassName)}>{value}</span>
        </div>
    );
}

// Title-less key/value list shared by the hover tooltip and the pinned detail so both read
// the same way. Renders on a normal surface via semantic tokens.
export function BatchStats({ batch }: { batch: CdcLiveBatch }): ReactNode {
    const hasErrors = batch.errors > 0;

    return (
        <div>
            <StatRow label="Duration" value={`${(batch.durationInMs / 1000).toFixed(1)} s`} />
            <StatRow label="Started" value={formatDateTime(batch.started)} />
            <StatRow label="Ended" value={batch.ended === null ? "Running" : formatDateTime(batch.ended)} />
            {batch.phases.map((phase, index) => (
                <StatRow
                    key={`${phase.name}-${index}`}
                    label={phase.name}
                    value={`${Math.round(phase.durationInMs)} ms`}
                />
            ))}
            <StatRow label="Documents read" value={formatCompact(batch.read)} />
            <StatRow label="Processed" value={formatCompact(batch.processed)} />
            <StatRow
                label="Errors"
                value={batch.errors}
                valueClassName={hasErrors ? "text-destructive font-medium" : undefined}
            />
            <StatRow label="Allocated" value={formatBytes(batch.allocatedBytes)} />
            <StatRow label="Stop reason" value={batch.stopReason ?? "n/a"} />
        </div>
    );
}
