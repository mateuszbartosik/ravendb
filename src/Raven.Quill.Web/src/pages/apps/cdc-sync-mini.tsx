import { useId, type ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, YAxis } from "recharts";
import { api } from "@/api/api";
import { Badge } from "@/components/shadcn/ui/badge";
import { Button } from "@/components/shadcn/ui/button";
import { ChartContainer, type ChartConfig } from "@/components/shadcn/ui/chart";
import { ZERO_SAFE_Y_DOMAIN } from "@/lib/chart-domain";
import { formatCompact } from "@/lib/format";
import { CdcErrorsSheet } from "@/pages/apps/cdc-errors-sheet";
import { useCdcLivePerformance, type CdcLiveStatus } from "@/pages/apps/use-cdc-live-performance";

// Badge styling and copy for this component's own lower-fidelity, first-look context; the
// active label reads "Syncing" rather than a more generic status word.
const SYNC_STATUS_BADGES: Record<CdcLiveStatus, { variant: ComponentProps<typeof Badge>["variant"]; label: string }> = {
    active: { variant: "success", label: "Syncing" },
    idle: { variant: "secondary", label: "Idle" },
    error: { variant: "destructive", label: "Error" },
};

// A light "did my sync start?" health check for the post-creation modal: a status pill, a
// throughput sparkline, the processed count, and an inline error note when something's wrong.
// Deliberately lower fidelity than the full CDC performance view, with no batch selector or
// full chart.
export function CdcSyncMini({ slug }: { slug: string }) {
    const live = useCdcLivePerformance(slug);
    const errorsQuery = useQuery(api.queries.apps.cdcErrors(slug));
    const errorCount = errorsQuery.data?.length ?? 0;

    if (!live.performance) {
        return <p className="text-sm text-muted-foreground">Connecting to the live data sync...</p>;
    }

    const { performance } = live;
    const badge = SYNC_STATUS_BADGES[performance.status];
    const throughput = performance.recentBatches.map((batch) => batch.processed);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 p-4">
                <div className="flex items-center gap-3">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    <div>
                        <div className="text-xl font-semibold tabular-nums">
                            {formatCompact(performance.recentWrites)}
                        </div>
                        <div className="text-xs text-muted-foreground">documents processed</div>
                    </div>
                </div>
                {throughput.length > 1 && <ThroughputSparkline series={throughput} />}
            </div>
            {errorCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                    <span>
                        {errorCount} mapping error{errorCount === 1 ? "" : "s"} so far
                    </span>
                    <CdcErrorsSheet
                        slug={slug}
                        trigger={
                            <Button variant="link" size="sm" className="h-auto p-0 text-xs text-destructive">
                                View
                            </Button>
                        }
                    />
                </div>
            )}
        </div>
    );
}

function ThroughputSparkline({ series }: { series: number[] }) {
    const gradientId = `cdc-sync-mini-${useId().replace(/:/g, "")}`;
    const config = { value: { label: "Processed", color: "var(--success)" } } satisfies ChartConfig;
    const data = series.map((value, index) => ({ index, value }));

    return (
        <ChartContainer config={config} className="aspect-auto h-[52px] w-[200px]">
            <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <YAxis hide domain={ZERO_SAFE_Y_DOMAIN} />
                <Area
                    dataKey="value"
                    type="monotone"
                    stroke="var(--color-value)"
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    isAnimationActive={false}
                />
            </AreaChart>
        </ChartContainer>
    );
}
