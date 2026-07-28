import type { ReactNode } from "react";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CdcLiveStatus } from "@/pages/apps/use-cdc-live-performance";

const STATUS_DOT_CLASS: Record<CdcLiveStatus, string> = {
    active: "bg-success",
    idle: "bg-muted-foreground",
    error: "bg-destructive",
};

const STATUS_HEADLINE: Record<CdcLiveStatus, string> = {
    active: "Syncing",
    idle: "Idle",
    error: "Sync error",
};

export function CdcHealthHeader({
    status,
    recentWrites,
    errorCount,
    lastWriteLabel,
    batchCount,
}: {
    status: CdcLiveStatus;
    recentWrites: number;
    errorCount: number;
    lastWriteLabel: string;
    batchCount: number;
}): ReactNode {
    const hasErrors = errorCount > 0;
    // The dot and headline must agree with the stored error count (the source of truth), not
    // the live status alone: a live "error" with no stored errors reads as active, while any
    // stored error always renders as an error regardless of the live status.
    const effectiveStatus: CdcLiveStatus = hasErrors ? "error" : status === "error" ? "active" : status;
    const subline = [
        hasErrors ? `${errorCount} ${errorCount === 1 ? "error" : "errors"}` : null,
        `last write ${lastWriteLabel}`,
        `${batchCount} batches`,
    ]
        .filter((part): part is string => part !== null)
        .join(" · ");

    return (
        <div
            className={cn(
                "flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4",
                effectiveStatus === "error" && "border-destructive/30 bg-destructive/10",
            )}
        >
            <span className={cn("size-2.5 rounded-full", STATUS_DOT_CLASS[effectiveStatus])} />
            <div className="min-w-0">
                <div className="text-base font-semibold">{STATUS_HEADLINE[effectiveStatus]}</div>
                <div className="truncate text-xs text-muted-foreground">{subline}</div>
            </div>
            <div className="flex-1" />
            <div className="flex gap-6">
                <div className="text-right">
                    <div className="text-xl font-semibold tabular-nums">{formatCompact(recentWrites)}</div>
                    <div className="text-[11px] text-muted-foreground">Recent writes</div>
                </div>
                <div className="text-right">
                    <div className={cn("text-xl font-semibold tabular-nums", hasErrors && "text-destructive")}>
                        {errorCount}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Errors</div>
                </div>
            </div>
        </div>
    );
}
