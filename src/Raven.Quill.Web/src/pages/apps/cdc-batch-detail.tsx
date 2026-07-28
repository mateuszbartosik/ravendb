import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/shadcn/ui/button";
import { formatBytes, formatCompact } from "@/lib/format";
import { cn, formatDateTime } from "@/lib/utils";
import { toPhaseSegments } from "@/pages/apps/cdc-phases";
import type { CdcLiveBatch } from "@/pages/apps/use-cdc-live-performance";

const PHASE_COLOR_BY_LABEL: Record<string, string> = {
    read: "bg-info",
    script: "bg-brand-500",
    write: "bg-chart-2",
};

function phaseColorClass(label: string): string {
    return PHASE_COLOR_BY_LABEL[label.toLowerCase()] ?? "bg-muted-foreground";
}

// Seconds with one decimal once a duration crosses a second, milliseconds below that, so
// short phases (tens of ms) don't all read as "0.0s".
function formatPhaseDuration(durationInMs: number): string {
    return durationInMs >= 1000 ? `${(durationInMs / 1000).toFixed(1)}s` : `${Math.round(durationInMs)}ms`;
}

export function CdcBatchDetail({ batch, onClose }: { batch: CdcLiveBatch; onClose: () => void }): ReactNode {
    const hasErrors = batch.errors > 0;
    const segments = toPhaseSegments(batch.phases, batch.durationInMs);

    const stats: { label: string; value: ReactNode; valueClassName?: string }[] = [
        { label: "Documents read", value: formatCompact(batch.read) },
        { label: "Processed", value: formatCompact(batch.processed) },
        {
            label: "Errors",
            value: batch.errors,
            valueClassName: hasErrors ? "text-destructive font-medium" : undefined,
        },
        { label: "Allocated", value: formatBytes(batch.allocatedBytes) },
        { label: "Stop reason", value: batch.stopReason ?? "n/a" },
    ];

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-muted/40">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-baseline gap-1.5">
                    <span className="font-medium">Batch</span>
                    <span className="text-muted-foreground">{formatPhaseDuration(batch.durationInMs)}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">
                        {formatDateTime(batch.started)} to{" "}
                        {batch.ended === null ? "running" : formatDateTime(batch.ended)}
                    </span>
                    <Button variant="ghost" size="icon" aria-label="Clear selection" onClick={onClose}>
                        <X aria-hidden="true" />
                    </Button>
                </div>
            </div>
            <div className="space-y-4 p-4">
                <div>
                    {segments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No phase breakdown.</p>
                    ) : (
                        <>
                            <div className="flex h-6 gap-[2px] overflow-hidden rounded-md">
                                {hasErrors ? (
                                    <div className="bg-destructive" style={{ flexGrow: 1 }} />
                                ) : (
                                    segments.map((segment) => (
                                        <div
                                            key={segment.label}
                                            className={phaseColorClass(segment.label)}
                                            style={{ flexGrow: segment.fraction }}
                                        />
                                    ))
                                )}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                {segments.map((segment) => (
                                    <span key={segment.label}>
                                        {segment.label}: {formatPhaseDuration(segment.durationInMs)}
                                    </span>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    {stats.map((stat) => (
                        <div
                            key={stat.label}
                            className="flex items-center justify-between gap-3 border-b border-border py-1"
                        >
                            <span className="text-muted-foreground">{stat.label}</span>
                            <span className={cn("font-mono tabular-nums", stat.valueClassName)}>{stat.value}</span>
                        </div>
                    ))}
                </div>

                {hasErrors && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                        This batch reported {batch.errors} {batch.errors === 1 ? "error" : "errors"} while syncing.
                        {batch.stopReason && ` Stop reason: ${batch.stopReason}.`}
                    </div>
                )}
            </div>
        </div>
    );
}
