import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistance } from "date-fns";
import { api } from "@/api/api";
import type { AppResponse } from "@/api/generated/server-api";
import { ApiState } from "@/components/data/api-state";
import { PagePanel } from "@/components/data/page-panel";
import { SectionCard } from "@/pages/apps/section-card";
import { CollectionsSection } from "@/pages/apps/collections-section";
import { CdcHealthHeader } from "@/pages/apps/cdc-health-header";
import { CdcErrorsPanel } from "@/pages/apps/cdc-errors-panel";
import { CdcBatchTimeline } from "@/pages/apps/cdc-batch-timeline";
import { useCdcLivePerformance, type CdcLiveBatch } from "@/pages/apps/use-cdc-live-performance";
import { formatDate } from "@/lib/format";

export function AppDataSource() {
    const { slug = "" } = useParams();
    const live = useCdcLivePerformance(slug);
    const errorsQuery = useQuery(api.queries.apps.cdcErrors(slug));
    const appQuery = useQuery(api.queries.apps.detail(slug));
    const storedErrors = errorsQuery.data ?? [];
    const nowMs = useNow();

    return (
        <PagePanel>
            <div className="space-y-8">
                <ApiState
                    isLoading={live.connection === "connecting"}
                    isError={live.connection === "error"}
                    errorTitle="Could not connect to the live data sync"
                    onRetry={live.retry}
                    loadingLabel="Connecting to the live data sync..."
                >
                    {live.performance && (
                        <div className="space-y-4">
                            <CdcHealthHeader
                                status={live.performance.status}
                                recentWrites={live.performance.recentWrites}
                                errorCount={storedErrors.length}
                                lastWriteLabel={lastWriteLabel(live.performance.recentBatches, nowMs)}
                                batchCount={live.performance.totalBatches}
                            />
                            <CdcErrorsPanel slug={slug} errors={storedErrors} />
                            <SectionCard title="Live CDC performance">
                                <CdcBatchTimeline batches={live.performance.recentBatches} nowMs={nowMs} />
                            </SectionCard>
                        </div>
                    )}
                </ApiState>
                <CollectionsSection slug={slug} />
                <ApiState
                    isLoading={appQuery.isPending}
                    isError={appQuery.isError}
                    errorTitle="Could not load data source"
                    onRetry={appQuery.refetch}
                >
                    {appQuery.data && <ConnectionStrip app={appQuery.data} />}
                </ApiState>
            </div>
        </PagePanel>
    );
}

function lastWriteLabel(batches: CdcLiveBatch[], nowMs: number): string {
    const lastEndedMs = batches.reduce((latest, b) => (b.ended ? Math.max(latest, Date.parse(b.ended)) : latest), 0);
    return lastEndedMs > 0 ? formatDistance(lastEndedMs, nowMs, { addSuffix: true }) : "no writes yet";
}

// The in-progress batch's width is measured against "now", so the timeline needs a clock that
// advances between the live feed's heartbeats. Reading the clock in an interval keeps render pure.
function useNow(intervalMs = 1000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
}

function ConnectionStrip({ app }: { app: AppResponse }) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            <span>
                Application <span className="font-medium text-foreground">{app.name}</span>
            </span>
            <span className="h-3 w-px bg-border" aria-hidden="true" />
            <span>
                Source <span className="font-mono text-foreground">{app.database}</span>
            </span>
            <span className="h-3 w-px bg-border" aria-hidden="true" />
            <span>
                Connected <span className="text-foreground">{formatDate(app.createdAt)}</span>
            </span>
            <span className="h-3 w-px bg-border" aria-hidden="true" />
            <span className="font-mono">{app.cdcTaskName}</span>
        </div>
    );
}
