# Data source view redesign — CDC health, inline errors, batch timeline

- Date: 2026-07-28
- Status: Approved design, ready for implementation
- Scope: `src/Raven.Quill.Web` — the Apps → Data source view and the "app created" modal

## Problem

The Apps → Data source view (`AppDataSource`, route `/apps/:slug/data-source`) does not do its job when a sync is failing.

- **Errors are buried.** When the CDC sink errors, the failure is represented three weak ways, and none of them shows the error: the `Errors` stat card is styled identically to a healthy metric (no red, and "3" is a smaller figure than the "33.4K" writes beside it); the errored batch is a ~1px red sliver among dozens of bars; the only true state signal is a small `Error` badge in a section corner. The actual error text lives behind a drawer.
- **The chart does not explain itself.** The stacked bar chart has no legend, no y-axis, no title. Bar length (documents, relative to the window peak) carries no meaning a viewer can act on.
- **Hierarchy is inverted.** Static connection metadata (name, database, "connected since") takes the top slot; the live health people actually come for sits below it.
- **One component, wrong fit in two places.** The same heavyweight `CdcPerformanceSection` is dropped into the add-app wizard's "app created" modal, where the user only needs a light "did my sync start?" reassurance.

## Goals

- Answer "is the sync healthy, and if not what broke?" at a glance.
- Surface errors with their actual content inline — no click required to learn what failed.
- Replace the chart with a batch timeline where duration is honest and each batch is inspectable.
- Right-size the modal to a light first health check.
- Reuse existing patterns and data. No new dependencies.

## Non-goals

- No zoom/brush overview, no batch-count selector (they add tuning burden and, on a timeline, degrade legibility).
- No canvas renderer (see Rendering approach).
- No changes to routing, IA, slugs, or the Overview page's existing `CdcErrorsAlert`.

## Surfaces

| Surface | Role | Change |
|---|---|---|
| Data source tab (`AppDataSource`) | Full monitor | Rebuilt (this spec) |
| App Overview (`AppOverview`) | High-level home | Unchanged; keeps its `CdcErrorsAlert` banner |
| Add-app wizard "App created" modal | Post-create reassurance | Light variant (`CdcSyncMini`) |

## Design

### Data source layout (top to bottom)

1. **Health header** — a status dot + headline (`Syncing` / `Idle` / `Sync error`), a subline (`N errors in the last hour · last write Xm ago · N batches`), and two KPIs pulled right (`Recent writes`, `Errors`). The `Errors` figure turns red when > 0. Replaces the corner status badge and the standalone stat-card row.
2. **Errors panel** (conditional, only when errors exist) — a red-tinted section listing the top errors (step chip · the actual message · document id · timestamp) with `View all N` opening the existing `CdcErrorsSheet`. This is the decisive un-burying.
3. **Live CDC performance** — the batch timeline (below).
4. **Collections** — unchanged (`VirtualDataTable`).
5. **Connection** — demoted from a 3-card grid to a one-line strip (application, source database, connected date, task name).

### Batch timeline (`CdcBatchTimeline`)

The performance section becomes a scrollable, drag-pannable timeline modeled on RavenDB Studio's ongoing-tasks performance graph, right-sized to a single CDC task.

- **True scale (capped).** Each batch is a block whose width is `duration × pixelsPerSecond`, so durations are honest and comparable regardless of how many are in view. Width is clamped to `MAX_BLOCK_PX` so a single very long or long-running batch cannot stretch the track into an endless scroll; the exact duration stays available on hover. Coloured by status: processed (brand), in-progress (striped grey), errored (red).
- **Idle toggle; minimal timestamps.** By default batches sit contiguously (width encodes duration; idle not drawn). An "Idle" header toggle can render idle time between batches as faded grey blocks (proportional to the idle span, capped at `MAX_IDLE_GAP_PX`) with an idle-duration label, for spotting cadence/stalls on demand. Per-batch timing is on hover; the health header's "last write" surfaces staleness. The ruler shows only two anchors — window start (left) and now (right) — plus a timestamp above any errored batch; successful-batch timestamps are omitted as noise. (Revised 2026-07-28 through several Storybook reviews: gap-compression → contiguous → optional idle toggle as faded blocks.)
- **Playhead + auto-follow now.** A playhead marks the current position; it sits at now by default and the view auto-scrolls to follow the live edge. Clicking a batch glides the playhead to it; a `Live` control snaps back to now (and re-enables auto-follow).
- **Navigation.** Native horizontal scroll; grab-to-drag panning via pointer events (mouse only; touch uses native scroll); prev/next arrow buttons that page the view; and a slim custom position bar (the native scrollbar is hidden) whose thumb width shows how much of history is in view and whose position shows where you are, draggable and click-to-jump. A left inset keeps the first bar off the track edge. Any manual navigation (drag, wheel, touch, arrows, or the position bar) disengages auto-follow until Live is pressed.
- **Inspect (progressive disclosure).** Hovering or focusing a batch shows a compact tooltip with the basics (duration, time range, phase durations, read/processed, errors, allocated, stop reason) for a quick glance. Clicking a batch dims the rest and opens the full pinned detail panel with the phase breakdown (read → script → write, widths proportional to their durations, derived from the batch's `Details` operation tree) plus stats and, for a failure, the error note. Detail stays quiet until asked for.
- **Virtualization.** Window the blocks with `@tanstack/react-virtual` (already used by `VirtualDataTable`) when the count is large.
- **Accessibility.** Blocks are real buttons (`tabindex`, `role`, Enter/Space, visible focus ring). All motion (playhead glide, fade, live pulse) collapses under `prefers-reduced-motion`.
- **States.** `connecting` (slim skeleton + "Connecting to the live feed"), `no batches` ("Waiting for the first batch", no empty chart frame), `feed lost` ("Live feed disconnected" + Retry, last strip dimmed).

### Modal light variant (`CdcSyncMini`)

Used by the wizard's `AppCreatedDialog`: a status pill + a throughput sparkline (recharts area, no controls) + processed count + an inline error note only when errors exist + Continue. Shares the `useCdcLivePerformance` feed at lower fidelity.

### Error-count source of truth

Both the header `Errors` KPI and the errors panel derive from the stored `cdcErrors` query, so the number and the list always agree (today the live `errorCount` and the stored list can disagree — the current code notes this).

## Rendering approach (decision record)

- **DOM/SVG, not canvas.** The bounded recent window plus virtualization keeps element counts low (tens to low hundreds visible), so DOM/SVG is comfortable. Canvas would forfeit theming via oklch tokens and dark mode, crisp text, trivial hit-testing, and accessibility (focusable blocks). Studio uses canvas because it renders every index over unbounded history with zoom — a scale regime this view does not hit. Escalate to canvas only if profiling shows a real problem.
- **Not a charting package for the timeline.** recharts is series-oriented and cannot express a gap-compressed Gantt with a playhead and scroll. Keep recharts for genuine charts only (the modal sparkline).
- **Reuse, no new deps.** `@tanstack/react-virtual`, `date-fns`, shadcn tokens, and the existing `CdcErrorsSheet` / `Sheet` / `Badge` / `Card`.
- **Drag-vs-click guard.** Capture the pointer only after ~4px of movement, so a plain click still selects a batch while a press-and-drag pans. Do not `setPointerCapture` on `pointerdown` (it retargets the follow-up `click` and breaks selection).

## Data plumbing

- Extend `use-cdc-live-performance.ts` raw types and shaping to carry the per-batch `Details` operation tree, `CurrentlyAllocated`, and `BatchPullStopReason` (the shaped `CdcLiveBatch` gains `phases`, `allocated`, `stopReason`). The server already produces these (Studio's graph consumes them).
- **Risk / confirm:** verify the WS-only `/api/apps/{slug}/cdc/progress` relay forwards the `Details` tree to Quill. It is described as relayed verbatim, so it likely does; if it trims it, a small server-side addition to the relay is required. This is the one cross-cutting dependency.
- Add a helper to fold the `Details` tree into read/script/write phase durations for the detail panel.

## Testing (Storybook is the delivery target)

- `AppDataSource` stories: `Default` (healthy, active), `WithErrors` (the demo failure scenario), `Empty`, `Connecting`, `FeedLost`.
- Timeline stories: dense (backlog catch-up), sparse-with-compressed-gap, single in-progress.
- Modal story: light health check, healthy and with early errors.
- Interaction test (play function) covering click-to-inspect and the drag-vs-click guard where feasible.
- Update `apps-mocks.ts` `sampleCdcProgressFrame` to include the `Details` tree, allocated, and stop reason so the stories render realistic data.

## File plan

New (`src/Raven.Quill.Web/src/pages/apps/`):
- `cdc-health-header.tsx`
- `cdc-errors-panel.tsx`
- `cdc-batch-timeline.tsx` (+ `cdc-batch-detail.tsx`, and a small `use-timeline-layout.ts` for scale + gap-compression math)
- `cdc-sync-mini.tsx`

Changed:
- `app-data-source.tsx` — compose the new layout + connection strip
- `cdc-performance-section.tsx` — retired or reduced to the timeline wrapper
- `use-cdc-live-performance.ts` — carry `Details` / allocated / stop reason + phase types
- `pages/setup/add-app-wizard/add-app-wizard.tsx` — use `CdcSyncMini` in `AppCreatedDialog`
- `mocks/apps-mocks.ts` — richer sample frame
- `pages/apps/app-data-source.stories.tsx` — add the new stories

Reused as-is: `cdc-errors-sheet.tsx`, `section-card.tsx`. `dashboard-stat-cards.tsx` stays for other dashboards; the health header replaces it on this page.

## Open questions

- Confirm the `/cdc/progress` relay carries the `Details` tree (else a small server addition).
- Final `pixelsPerSecond` default and the idle-gap compression cap (tune during implementation).
