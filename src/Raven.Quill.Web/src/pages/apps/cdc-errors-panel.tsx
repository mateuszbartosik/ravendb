import type { ReactNode } from "react";
import type { CdcError } from "@/api/generated/server-api";
import { Button } from "@/components/shadcn/ui/button";
import { formatDateTime } from "@/lib/utils";
import { CdcErrorsSheet } from "@/pages/apps/cdc-errors-sheet";

const VISIBLE_ERROR_COUNT = 3;

export function CdcErrorsPanel({ slug, errors }: { slug: string; errors: CdcError[] }): ReactNode {
    if (errors.length === 0) {
        return null;
    }

    return (
        <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-destructive">Errors</h2>
                <CdcErrorsSheet
                    slug={slug}
                    trigger={
                        <Button variant="destructive-outline" size="sm">
                            View all {errors.length}
                        </Button>
                    }
                />
            </div>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-destructive/30 bg-destructive/10">
                {errors.slice(0, VISIBLE_ERROR_COUNT).map((error, index) => (
                    <CdcErrorRow key={index} error={error} />
                ))}
            </div>
        </section>
    );
}

function CdcErrorRow({ error }: { error: CdcError }): ReactNode {
    return (
        <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 p-3">
            <span className="mt-0.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground">
                {error.step}
            </span>
            <div className="min-w-0">
                <p className="font-mono text-sm break-words text-destructive">{error.error}</p>
                {error.documentId ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                        document <span className="font-mono">{error.documentId}</span>
                    </p>
                ) : (
                    error.affectedDocumentsCount !== null && (
                        <p className="mt-1 text-xs text-muted-foreground">
                            <span className="font-mono">{error.affectedDocumentsCount}</span> documents affected
                        </p>
                    )
                )}
            </div>
            <span className="mt-0.5 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                {formatDateTime(error.createdAt)}
            </span>
        </div>
    );
}
