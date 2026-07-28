import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shadcn/ui/tooltip";
import { cn, formatDateTime } from "@/lib/utils";
import { BatchStats } from "@/pages/apps/cdc-batch-stats";
import { CdcBatchDetail } from "@/pages/apps/cdc-batch-detail";
import type { CdcLiveBatch } from "@/pages/apps/use-cdc-live-performance";
import { computeTimelineLayout } from "@/pages/apps/use-timeline-layout";

// A pointer must travel this far before a press on the track becomes a pan; below it, the
// press stays a click so blocks can still be selected.
const DRAG_THRESHOLD_PX = 4;
const THUMB_MIN_PX = 28;

const STRIPE_STYLE: CSSProperties = {
    backgroundImage:
        "repeating-linear-gradient(45deg, var(--color-muted-foreground) 0, var(--color-muted-foreground) 3px, transparent 3px, transparent 7px)",
};

function formatSeconds(durationInMs: number): string {
    return `${(durationInMs / 1000).toFixed(1)}s`;
}

// HH:MM:SS in the viewer's locale, used for the start anchor and errored-batch labels.
function formatClock(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour12: false });
}

function statusText(batch: CdcLiveBatch): string {
    if (batch.errors > 0) {
        return `failed, ${batch.stopReason ?? "read error"}`;
    }
    return batch.ended === null ? "in progress" : "processed";
}

function statusClass(batch: CdcLiveBatch): string {
    if (batch.errors > 0) {
        return "bg-destructive";
    }
    return batch.ended === null ? "bg-muted" : "bg-brand-500/80 hover:bg-brand-500";
}

function thumbGeometry(container: HTMLDivElement, rail: HTMLDivElement): { width: number; left: number } {
    const { clientWidth, scrollWidth, scrollLeft } = container;
    const railWidth = rail.clientWidth;
    const maxScroll = scrollWidth - clientWidth;
    const width = scrollWidth > 0 ? Math.max(THUMB_MIN_PX, (clientWidth / scrollWidth) * railWidth) : railWidth;
    const span = railWidth - width;
    const left = maxScroll > 0 ? (scrollLeft / maxScroll) * span : 0;
    return { width, left };
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

// Idle span shown above a gap marker: minutes once it crosses a minute, seconds below that.
function formatIdle(idleMs: number): string {
    return idleMs >= 60_000 ? `${Math.round(idleMs / 60_000)}m idle` : `${Math.round(idleMs / 1000)}s idle`;
}

export function CdcBatchTimeline({ batches, nowMs }: { batches: CdcLiveBatch[]; nowMs: number }): ReactNode {
    const scrollRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const railRef = useRef<HTMLDivElement>(null);
    const panRef = useRef<{ startX: number; startScroll: number; hasMoved: boolean; pointerId: number } | null>(null);
    const thumbDragRef = useRef<{ startLeft: number; startX: number; span: number; maxScroll: number } | null>(null);
    const suppressClickRef = useRef(false);

    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [isLive, setIsLive] = useState(true);
    const [showIdle, setShowIdle] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [thumb, setThumb] = useState({ width: 0, left: 0 });

    const layout = computeTimelineLayout(batches, nowMs, showIdle);
    const { blocks, gaps, totalWidthPx, nowLeftPx } = layout;

    // Auto-follow now: while Live is on, keep the now edge in view as batches arrive.
    useEffect(() => {
        if (!isLive) {
            return;
        }
        const container = scrollRef.current;
        if (!container) {
            return;
        }
        container.scrollLeft = Math.max(0, totalWidthPx - container.clientWidth);
    }, [isLive, nowMs, totalWidthPx]);

    // Keep the custom position bar in sync with the track's size and content width. The
    // scroll position itself is synced by the container's onScroll handler. Depending on
    // totalWidthPx (mirroring the auto-follow effect above) re-attaches this effect once the
    // empty-state early return below gives way to the real track, and again whenever the
    // track's width changes, so the thumb doesn't stay stuck at its initial zero geometry.
    useEffect(() => {
        const container = scrollRef.current;
        const inner = innerRef.current;
        const rail = railRef.current;
        if (!container || !inner || !rail) {
            return;
        }
        const sync = () => setThumb(thumbGeometry(container, rail));
        sync();
        const observer = new ResizeObserver(sync);
        observer.observe(container);
        observer.observe(inner);
        return () => observer.disconnect();
    }, [totalWidthPx]);

    if (batches.length === 0) {
        return <p className="text-sm text-muted-foreground">Waiting for the first batch.</p>;
    }

    const hasSelection = selectedKey !== null;
    const selectedBlock = hasSelection ? blocks.find((block) => block.key === selectedKey) : undefined;
    const playheadLeft = selectedBlock ? selectedBlock.leftPx + selectedBlock.widthPx / 2 : nowLeftPx;
    const firstBlock = blocks[0];

    function syncThumb() {
        const container = scrollRef.current;
        const rail = railRef.current;
        if (container && rail) {
            setThumb(thumbGeometry(container, rail));
        }
    }

    function selectBatch(key: string) {
        if (suppressClickRef.current) {
            return;
        }
        setSelectedKey(key);
        setIsLive(false);
    }

    function goLive() {
        setSelectedKey(null);
        setIsLive(true);
    }

    // Page the timeline left/right; like drag and wheel, this is manual navigation so it stops
    // the auto-follow from snapping back to now.
    function scrollByPage(direction: 1 | -1) {
        const container = scrollRef.current;
        if (!container) {
            return;
        }
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        container.scrollBy({
            left: direction * container.clientWidth * 0.8,
            behavior: reduceMotion ? "auto" : "smooth",
        });
        setIsLive(false);
    }

    function handleTrackPointerDown(event: React.PointerEvent<HTMLDivElement>) {
        // Touch and pen keep native scrolling; only mouse presses become a drag-to-pan.
        if (event.pointerType !== "mouse") {
            return;
        }
        panRef.current = {
            startX: event.clientX,
            startScroll: scrollRef.current?.scrollLeft ?? 0,
            hasMoved: false,
            pointerId: event.pointerId,
        };
        suppressClickRef.current = false;
    }

    function handleTrackPointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const pan = panRef.current;
        const container = scrollRef.current;
        if (!pan || !container) {
            return;
        }
        const dx = event.clientX - pan.startX;
        if (!pan.hasMoved && Math.abs(dx) > DRAG_THRESHOLD_PX) {
            // Capture only now, after the move threshold, so a plain click still reaches the
            // block button underneath.
            pan.hasMoved = true;
            suppressClickRef.current = true;
            container.setPointerCapture(pan.pointerId);
            setIsPanning(true);
            setIsLive(false);
        }
        if (pan.hasMoved) {
            container.scrollLeft = pan.startScroll - dx;
        }
    }

    function endTrackPan() {
        const pan = panRef.current;
        if (!pan) {
            return;
        }
        if (pan.hasMoved) {
            scrollRef.current?.releasePointerCapture(pan.pointerId);
            setIsPanning(false);
            // Keep the click after a drag suppressed, then clear on the next tick so the very
            // next real click selects normally.
            setTimeout(() => {
                suppressClickRef.current = false;
            }, 0);
        } else {
            suppressClickRef.current = false;
        }
        panRef.current = null;
    }

    function handleThumbPointerDown(event: React.PointerEvent<HTMLDivElement>) {
        event.stopPropagation();
        const container = scrollRef.current;
        const rail = railRef.current;
        if (!container || !rail) {
            return;
        }
        thumbDragRef.current = {
            startLeft: thumb.left,
            startX: event.clientX,
            span: rail.clientWidth - thumb.width,
            maxScroll: container.scrollWidth - container.clientWidth,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsLive(false);
    }

    function handleThumbPointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const drag = thumbDragRef.current;
        const container = scrollRef.current;
        if (!drag || !container) {
            return;
        }
        const nextLeft = clamp(drag.startLeft + (event.clientX - drag.startX), 0, drag.span);
        container.scrollLeft = drag.span > 0 ? (nextLeft / drag.span) * drag.maxScroll : 0;
    }

    function endThumbDrag(event: React.PointerEvent<HTMLDivElement>) {
        if (!thumbDragRef.current) {
            return;
        }
        event.currentTarget.releasePointerCapture(event.pointerId);
        thumbDragRef.current = null;
    }

    function handleRailPointerDown(event: React.PointerEvent<HTMLDivElement>) {
        // Presses on the thumb are handled by the thumb's own handler.
        if (event.target !== event.currentTarget) {
            return;
        }
        const container = scrollRef.current;
        const rail = railRef.current;
        if (!container || !rail) {
            return;
        }
        const span = rail.clientWidth - thumb.width;
        const maxScroll = container.scrollWidth - container.clientWidth;
        const nextLeft = clamp(event.clientX - rail.getBoundingClientRect().left - thumb.width / 2, 0, span);
        container.scrollLeft = span > 0 ? (nextLeft / span) * maxScroll : 0;
        setIsLive(false);
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                    Durations to scale, {showIdle ? "idle time shown" : "idle time not shown"}. Drag to pan.
                </span>
                <div className="flex items-center gap-1.5">
                    <Button
                        variant="outline"
                        size="sm"
                        aria-pressed={showIdle}
                        onClick={() => setShowIdle((value) => !value)}
                        className={cn(showIdle ? "text-foreground" : "text-muted-foreground")}
                    >
                        Idle
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label="Scroll timeline left"
                        onClick={() => scrollByPage(-1)}
                    >
                        <ChevronLeft aria-hidden="true" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label="Scroll timeline right"
                        onClick={() => scrollByPage(1)}
                    >
                        <ChevronRight aria-hidden="true" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        aria-pressed={isLive}
                        onClick={goLive}
                        className={cn("gap-1.5", isLive ? "text-foreground" : "text-muted-foreground")}
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                "size-1.5 rounded-full",
                                isLive ? "bg-success motion-safe:animate-pulse" : "bg-muted-foreground",
                            )}
                        />
                        Live
                    </Button>
                </div>
            </div>

            <div
                ref={scrollRef}
                className={cn(
                    "no-scrollbar overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-surface2 dark:bg-surface1",
                    isPanning ? "cursor-grabbing select-none" : "cursor-grab",
                )}
                onPointerDown={handleTrackPointerDown}
                onPointerMove={handleTrackPointerMove}
                onPointerUp={endTrackPan}
                onPointerCancel={endTrackPan}
                onScroll={syncThumb}
                onWheel={() => setIsLive(false)}
                onTouchStart={() => setIsLive(false)}
            >
                <div ref={innerRef} className="relative h-[98px]" style={{ width: totalWidthPx }}>
                    <div className="absolute inset-x-0 top-0 h-6 border-b border-border">
                        <span
                            className="absolute top-[5px] h-[19px] border-l border-input pl-1 font-mono text-[10px] whitespace-nowrap text-muted-foreground"
                            style={{ left: firstBlock.leftPx }}
                        >
                            {formatClock(firstBlock.batch.started)}
                        </span>
                        {blocks.map((block) =>
                            block.batch.errors > 0 ? (
                                <span
                                    key={`error-${block.key}`}
                                    className="absolute top-[5px] h-[19px] border-l border-destructive pl-1 font-mono text-[10px] whitespace-nowrap text-destructive"
                                    style={{ left: block.leftPx }}
                                >
                                    {formatClock(block.batch.started)}
                                </span>
                            ) : null,
                        )}
                        <span
                            className="absolute top-[5px] h-[19px] border-l border-info pl-1 font-mono text-[10px] whitespace-nowrap text-info"
                            style={{ left: nowLeftPx }}
                        >
                            now
                        </span>
                    </div>

                    {gaps.length > 0 && (
                        <div className="pointer-events-none absolute inset-x-0 top-[40px] h-[46px]">
                            {gaps.map((gap) => (
                                <div
                                    key={gap.leftPx}
                                    className="absolute top-0 h-[46px] rounded bg-muted-foreground/10"
                                    style={{ left: gap.leftPx, width: gap.widthPx }}
                                >
                                    {gap.idleMs >= 1000 && (
                                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap text-muted-foreground">
                                            {formatIdle(gap.idleMs)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="absolute inset-x-0 top-[40px] h-[46px]">
                        <TooltipProvider delayDuration={300}>
                            {blocks.map((block) => {
                                const isSelected = block.key === selectedKey;
                                const isInProgress = block.batch.ended === null && block.batch.errors === 0;
                                return (
                                    <Tooltip key={block.key}>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                aria-label={`Batch at ${formatDateTime(block.batch.started)}, ${formatSeconds(
                                                    block.batch.durationInMs,
                                                )}, ${statusText(block.batch)}`}
                                                onClick={() => selectBatch(block.key)}
                                                className={cn(
                                                    "absolute top-0 h-[46px] min-w-2 rounded outline-2 outline-offset-2 outline-transparent transition-opacity duration-200 focus-visible:outline-foreground motion-reduce:transition-none",
                                                    statusClass(block.batch),
                                                    hasSelection && !isSelected && "opacity-20",
                                                    isSelected && "opacity-100 outline-foreground",
                                                )}
                                                style={{
                                                    left: block.leftPx,
                                                    width: block.widthPx,
                                                    ...(isInProgress ? STRIPE_STYLE : null),
                                                }}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent
                                            side="top"
                                            className="max-w-none border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-md [&_svg]:bg-popover [&_svg]:fill-popover"
                                        >
                                            <BatchStats batch={block.batch} />
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </TooltipProvider>
                    </div>

                    <div
                        className="pointer-events-none absolute top-0 bottom-0 z-10 transition-[left] duration-200 ease-out motion-reduce:transition-none"
                        style={{ left: playheadLeft }}
                    >
                        <div className="absolute top-1 left-0 size-3.5 -translate-x-1/2 rounded-full bg-info ring-3 ring-background" />
                        <div className="absolute top-3 bottom-0 left-0 w-0.5 -translate-x-1/2 bg-info" />
                    </div>
                </div>
            </div>

            <div
                ref={railRef}
                className="relative h-1.5 touch-none rounded-full bg-muted"
                onPointerDown={handleRailPointerDown}
            >
                <div
                    className="absolute top-0 h-1.5 rounded-full bg-foreground/20 hover:bg-foreground/30"
                    style={{ width: thumb.width, left: thumb.left }}
                    onPointerDown={handleThumbPointerDown}
                    onPointerMove={handleThumbPointerMove}
                    onPointerUp={endThumbDrag}
                    onPointerCancel={endThumbDrag}
                />
            </div>

            {selectedBlock && (
                <div className="mt-1">
                    <CdcBatchDetail batch={selectedBlock.batch} onClose={goLive} />
                </div>
            )}
        </div>
    );
}
