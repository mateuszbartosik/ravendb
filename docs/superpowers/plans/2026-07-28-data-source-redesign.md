# Data source redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Apps → Data source view so sync health reads at a glance, errors are surfaced inline with their content, and the performance chart becomes a scrollable, drag-pannable batch timeline; right-size the "app created" modal to a light health check. Delivered and demoed through Storybook.

**Architecture:** A shared live feed hook (`useCdcLivePerformance`) is extended to carry each batch's phase tree, allocated memory, and stop reason. The view composes four focused presentational components (`CdcHealthHeader`, `CdcErrorsPanel`, `CdcBatchTimeline`, plus a demoted connection strip) fed by that hook and the stored `cdcErrors` query. The timeline is a bespoke DOM/SVG component (no canvas, no chart lib) using true pixels-per-second scale with idle-gap compression, a playhead that auto-follows now, pointer-event drag panning, and a custom position bar. The modal reuses the same feed at low fidelity via `CdcSyncMini`.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind v4 (app tokens in `src/index.css`), shadcn/Radix, `@tanstack/react-query`, `@tanstack/react-virtual` (already shipped), `date-fns`, recharts (sparkline only), Storybook 10 + Vitest + MSW.

## Global Constraints

Copied verbatim from the spec and `src/Raven.Quill.Web/CLAUDE.md`. Every task implicitly includes these.

- **No new dependencies.** Reuse `@tanstack/react-virtual`, `date-fns`, shadcn tokens, existing `CdcErrorsSheet`/`Sheet`/`Badge`/`Card`.
- **Both themes.** Every color via Tailwind tokens (`bg-card`, `text-muted-foreground`, `bg-destructive`, `text-success`, `bg-brand-500`, `border-border`, …). No hardcoded hex/oklch in components. Must work in light and dark.
- **React Compiler is on.** Do not add `useMemo`/`useCallback` for routine render optimization. Avoid `useEffect` unless genuinely needed.
- **Naming:** kebab-case filenames, PascalCase components, `@/*` imports, `SCREAMING_SNAKE_CASE` module constants. Boolean names read as booleans (`is`/`has`/`can`).
- **Copy:** sentence case, active voice, no em-dashes. Errors say what happened.
- **Error-count source of truth:** the header `Errors` KPI and the errors panel both derive from the stored `cdcErrors` query, never from the live `errorCount`.
- **Timeline rendering:** DOM/SVG only, not canvas, not recharts. Drag-vs-click guard: capture the pointer only after ~4px of movement; never `setPointerCapture` on `pointerdown`.
- **Visual reference:** the approved prototype (artifact `fff3ac44-…`, "CDC performance — batch timeline") and the design spec `docs/superpowers/specs/2026-07-28-data-source-redesign-design.md` are the source of truth for exact styling and interaction. Port them; do not reinvent.
- **Accessibility:** timeline blocks are real buttons (`tabIndex`, `role="button"`, Enter/Space, focus ring). All motion collapses under `prefers-reduced-motion`.

---

## File structure

New (`src/Raven.Quill.Web/src/pages/apps/`):
- `use-timeline-layout.ts` — pure layout math (positions, gap compression, ruler anchors). + `use-timeline-layout.test.ts`
- `cdc-phases.ts` — fold a batch `Details` tree into read/script/write durations. + `cdc-phases.test.ts`
- `cdc-health-header.tsx`
- `cdc-errors-panel.tsx`
- `cdc-batch-timeline.tsx`
- `cdc-batch-detail.tsx`
- `cdc-sync-mini.tsx`

Modified:
- `use-cdc-live-performance.ts` — carry `phases`, `allocated`, `stopReason`. + new `use-cdc-live-performance.test.ts`
- `mocks/apps-mocks.ts` — richer `sampleCdcProgressFrame`
- `app-data-source.tsx` — compose new layout + connection strip
- `cdc-performance-section.tsx` — reduced to the timeline section wrapper (or retired)
- `pages/setup/add-app-wizard/add-app-wizard.tsx` — use `CdcSyncMini`
- `pages/apps/app-data-source.stories.tsx` — add stories

Reused unchanged: `cdc-errors-sheet.tsx`, `section-card.tsx`. `dashboard-stat-cards.tsx` stays for other dashboards.

---

## Task 1: Extend the live feed data model

**Files:**
- Modify: `src/Raven.Quill.Web/src/pages/apps/use-cdc-live-performance.ts`
- Test: `src/Raven.Quill.Web/src/pages/apps/use-cdc-live-performance.test.ts`

**Interfaces:**
- Produces:
  - `type CdcPhase = { name: string; durationInMs: number }`
  - `CdcLiveBatch` gains: `read: number; allocatedBytes: number | null; stopReason: string | null; phases: CdcPhase[]`
  - New raw fields on `CdcLiveRawBatch`: `Details?: CdcLiveRawOperation; CurrentlyAllocated?: { SizeInBytes: number } | null; BatchPullStopReason?: string | null; NumberOfReadMessages` (already present)
  - `type CdcLiveRawOperation = { Name: string; DurationInMs: number; Operations?: CdcLiveRawOperation[] }`
  - The pure `shape(batches, totalBatches, nowMs)` return keeps its shape but each `recentBatches[i]` carries the new fields.

- [ ] **Step 1: Write failing test for the enriched shape**

Create `use-cdc-live-performance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shapeForTest } from "./use-cdc-live-performance";

const raw = {
  Id: 1,
  Started: "2026-07-28T08:00:00.000Z",
  Completed: "2026-07-28T08:00:01.400Z",
  DurationInMs: 1400,
  NumberOfReadMessages: 306,
  NumberOfProcessedMessages: 178,
  ScriptProcessingErrorCount: 0,
  ReadErrorCount: 1,
  CurrentlyAllocated: { SizeInBytes: 3_040_870 },
  BatchPullStopReason: "Read error",
  Details: { Name: "Batch", DurationInMs: 1400, Operations: [
    { Name: "Read", DurationInMs: 1288 },
    { Name: "Script", DurationInMs: 90 },
    { Name: "Write", DurationInMs: 22 },
  ]},
};

it("carries read count, allocated bytes, stop reason and phases", () => {
  const perf = shapeForTest([raw]);
  const b = perf.recentBatches[0];
  expect(b.read).toBe(306);
  expect(b.processed).toBe(178);
  expect(b.allocatedBytes).toBe(3_040_870);
  expect(b.stopReason).toBe("Read error");
  expect(b.phases).toEqual([
    { name: "Read", durationInMs: 1288 },
    { name: "Script", durationInMs: 90 },
    { name: "Write", durationInMs: 22 },
  ]);
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `pnpm --dir src/Raven.Quill.Web exec vitest run src/pages/apps/use-cdc-live-performance.test.ts`
Expected: FAIL (`shapeForTest` not exported; new fields undefined).

- [ ] **Step 3: Implement the enriched types and shaping**

In `use-cdc-live-performance.ts`: add `CdcLiveRawOperation`, extend `CdcLiveRawBatch` and `CdcLiveBatch` and `CdcPhase` per Interfaces. In `shape(...)`, when mapping each raw batch to `CdcLiveBatch`, populate:

```ts
read: raw.NumberOfReadMessages,
allocatedBytes: raw.CurrentlyAllocated?.SizeInBytes ?? null,
stopReason: raw.BatchPullStopReason ?? null,
phases: flattenPhases(raw.Details),
```

Add a small local helper that reads the direct child operations of the root `Details` node (one level; each `{ Name, DurationInMs }`), defaulting to `[]` when absent:

```ts
function flattenPhases(details: CdcLiveRawBatch["Details"]): CdcPhase[] {
  return (details?.Operations ?? []).map((op) => ({ name: op.Name, durationInMs: op.DurationInMs }));
}
```

Export a thin `shapeForTest = (raw: CdcLiveRawBatch[]) => shape(new Map(raw.map((b, i) => [String(i), b])), raw.length, Date.parse(raw.at(-1)!.Started) + 1)` for the unit test (keep `shape` itself unexported-by-default but reachable through this).

- [ ] **Step 4: Run and confirm it passes**

Run: `pnpm --dir src/Raven.Quill.Web exec vitest run src/pages/apps/use-cdc-live-performance.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --dir src/Raven.Quill.Web typecheck
git add src/Raven.Quill.Web/src/pages/apps/use-cdc-live-performance.ts src/Raven.Quill.Web/src/pages/apps/use-cdc-live-performance.test.ts
git commit -m "Carry CDC batch phases, allocated and stop reason in the live feed"
```

---

## Task 2: Phase-folding helper

**Files:**
- Create: `src/Raven.Quill.Web/src/pages/apps/cdc-phases.ts`
- Test: `src/Raven.Quill.Web/src/pages/apps/cdc-phases.test.ts`

**Interfaces:**
- Consumes: `CdcPhase` (Task 1).
- Produces: `type PhaseSegment = { label: string; durationInMs: number; fraction: number }` and `toPhaseSegments(phases: CdcPhase[], totalDurationInMs: number): PhaseSegment[]` — normalizes to fractions summing to ~1, groups unknown names under their own label, returns `[]` for empty input.

- [ ] **Step 1: Write failing test**

```ts
import { expect, it } from "vitest";
import { toPhaseSegments } from "./cdc-phases";

it("returns fractions proportional to phase durations", () => {
  const segs = toPhaseSegments([
    { name: "Read", durationInMs: 1288 },
    { name: "Script", durationInMs: 90 },
    { name: "Write", durationInMs: 22 },
  ], 1400);
  expect(segs.map((s) => s.label)).toEqual(["Read", "Script", "Write"]);
  expect(segs[0].fraction).toBeCloseTo(1288 / 1400, 3);
});

it("returns empty for no phases", () => {
  expect(toPhaseSegments([], 1000)).toEqual([]);
});
```

- [ ] **Step 2: Run, confirm fail** — `pnpm --dir src/Raven.Quill.Web exec vitest run src/pages/apps/cdc-phases.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
import type { CdcPhase } from "@/pages/apps/use-cdc-live-performance";

export type PhaseSegment = { label: string; durationInMs: number; fraction: number };

export function toPhaseSegments(phases: CdcPhase[], totalDurationInMs: number): PhaseSegment[] {
  if (phases.length === 0) return [];
  const total = totalDurationInMs > 0 ? totalDurationInMs : phases.reduce((s, p) => s + p.durationInMs, 0) || 1;
  return phases.map((p) => ({ label: p.name, durationInMs: p.durationInMs, fraction: p.durationInMs / total }));
}
```

- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: Commit** — `git commit -m "Add CDC phase-folding helper"`

---

## Task 3: Timeline layout math (pure)

**Files:**
- Create: `src/Raven.Quill.Web/src/pages/apps/use-timeline-layout.ts`
- Test: `src/Raven.Quill.Web/src/pages/apps/use-timeline-layout.test.ts`

**Interfaces:**
- Consumes: `CdcLiveBatch` (Task 1).
- Produces:
  - `const PX_PER_SECOND = 42` and `const MAX_GAP_PX = 40` and `const NORMAL_GAP_PX = 11` and `const IDLE_GAP_THRESHOLD_MS = 10_000` (module constants; the tunables the spec flagged).
  - `type TimelineBlock = { key: string; leftPx: number; widthPx: number; batch: CdcLiveBatch }`
  - `type TimelineGap = { leftPx: number; widthPx: number; idleMs: number }`
  - `type TimelineLayout = { blocks: TimelineBlock[]; gaps: TimelineGap[]; totalWidthPx: number; nowLeftPx: number }`
  - `computeTimelineLayout(batches: CdcLiveBatch[], nowMs: number): TimelineLayout` — laid left→older, right→newest; true-scale block widths (`min 8px`), normal idle collapses to `NORMAL_GAP_PX`, idle ≥ threshold becomes a `MAX_GAP_PX` gap recorded in `gaps`.

- [ ] **Step 1: Write failing test**

```ts
import { expect, it } from "vitest";
import { computeTimelineLayout, PX_PER_SECOND, MAX_GAP_PX } from "./use-timeline-layout";

const b = (started: string, durMs: number) => ({
  key: started, started, ended: new Date(Date.parse(started) + durMs).toISOString(),
  durationInMs: durMs, processed: 100, read: 100, errors: 0, phases: [], allocatedBytes: null, stopReason: null,
});

it("scales block width by duration", () => {
  const { blocks } = computeTimelineLayout([b("2026-07-28T08:00:00Z", 1000), b("2026-07-28T08:00:03Z", 2000)], Date.parse("2026-07-28T08:00:06Z"));
  expect(blocks[0].widthPx).toBeCloseTo(1 * PX_PER_SECOND, 1);
  expect(blocks[1].widthPx).toBeCloseTo(2 * PX_PER_SECOND, 1);
});

it("compresses a long idle into a gap marker", () => {
  const { gaps } = computeTimelineLayout([b("2026-07-28T08:00:00Z", 1000), b("2026-07-28T08:05:00Z", 1000)], Date.parse("2026-07-28T08:05:02Z"));
  expect(gaps).toHaveLength(1);
  expect(gaps[0].widthPx).toBe(MAX_GAP_PX);
  expect(gaps[0].idleMs).toBeGreaterThan(200_000);
});
```

- [ ] **Step 2: Run, confirm fail.**

- [ ] **Step 3: Implement** — accumulate `x` left→right; block `widthPx = Math.max(8, durationInMs/1000*PX_PER_SECOND)`; between batch `i` and `i+1` compute `idleMs = start[i+1] - end[i]`; if `idleMs >= IDLE_GAP_THRESHOLD_MS` push a gap of `MAX_GAP_PX` (record `idleMs`), else advance `NORMAL_GAP_PX`; `nowLeftPx = lastBlock.leftPx + lastBlock.widthPx + 6`; `totalWidthPx = nowLeftPx + 70`. Handle in-progress last batch (`ended === null`) using `nowMs` for its width.

- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: Commit** — `git commit -m "Add CDC timeline layout math with gap compression"`

---

## Task 4: Enrich the CDC progress mock

**Files:**
- Modify: `src/Raven.Quill.Web/src/mocks/apps-mocks.ts:107-138` (`sampleCdcProgressFrame`)

**Interfaces:**
- Consumes: raw shape from Task 1.
- Produces: a frame whose batches include `Details` (Read/Script/Write ops summing to `DurationInMs`), `CurrentlyAllocated`, `BatchPullStopReason`, and at least one errored batch (`ReadErrorCount: 1`, lower processed) and one in-progress batch (`Completed: null`).

- [ ] **Step 1:** Extend the generated batch object in `sampleCdcProgressFrame` to add `CurrentlyAllocated: { SizeInBytes: ... }`, `BatchPullStopReason`, and `Details` with three child operations whose durations sum to `durationInMs` (e.g. Read 22%, Script 58%, Write 20%; for the errored batch make Read ~92% and the only op). Keep the existing 51-batch generation and the `index === 2` error / `index === 0` in-progress markers.

- [ ] **Step 2: Verify via existing story** — Run: `pnpm --dir src/Raven.Quill.Web storybook` and open Apps → Data source. Expected: no runtime/type error; existing view still renders (fields are additive).

- [ ] **Step 3: Typecheck + commit** — `pnpm --dir src/Raven.Quill.Web typecheck` then `git commit -m "Enrich CDC progress mock with phase tree, allocated and stop reason"`

---

## Task 5: Batch detail panel

**Files:**
- Create: `src/Raven.Quill.Web/src/pages/apps/cdc-batch-detail.tsx`

**Interfaces:**
- Consumes: `CdcLiveBatch` (Task 1), `toPhaseSegments` (Task 2).
- Produces: `export function CdcBatchDetail({ batch, onClose }: { batch: CdcLiveBatch; onClose: () => void })` — a card with a header (`Batch #id, duration`, timestamp, close button), a phase bar built from `toPhaseSegments`, a two-column stat grid (read, processed, read errors, script errors, allocated via `formatBytes`, stop reason), and a destructive note when `errors > 0` (use the stored error message if wired, else `stopReason`).

- [ ] **Step 1: Build the component** — port the prototype's detail panel (spec §"Inspect"). Use Tailwind tokens: phase segments `bg-info`/`bg-brand-500`/`bg-success` and `bg-destructive` for a failed read; stat error values `text-destructive` when non-zero. Reuse `formatCompact`/add `formatBytes` in `@/lib/format`. Close button is a shadcn `Button variant="ghost" size="icon"`.

- [ ] **Step 2: Story** — add `CdcBatchDetail.stories.tsx` with `Healthy` and `Failed` stories passing a hand-built `CdcLiveBatch`. Run `pnpm --dir src/Raven.Quill.Web storybook`, confirm both render in light and dark (toolbar theme switch).

- [ ] **Step 3: Commit** — `git commit -m "Add CDC batch detail panel"`

---

## Task 6: Batch timeline component

**Files:**
- Create: `src/Raven.Quill.Web/src/pages/apps/cdc-batch-timeline.tsx`
- Test (story + play): `src/Raven.Quill.Web/src/pages/apps/cdc-batch-timeline.stories.tsx`

**Interfaces:**
- Consumes: `CdcLiveBatch[]` (Task 1), `computeTimelineLayout` + constants (Task 3), `CdcBatchDetail` (Task 5).
- Produces: `export function CdcBatchTimeline({ batches, nowMs }: { batches: CdcLiveBatch[]; nowMs: number })`.

Behavior (port the approved prototype exactly; spec §"Batch timeline"):
- Absolutely-positioned block **buttons** in a horizontally scrollable track; widths/positions from `computeTimelineLayout`. Status classes: processed `bg-brand-500/80`, in-progress striped `bg-muted`, errored `bg-destructive`.
- Playhead div (line + head) at `nowLeftPx`; auto-scroll the container to now on mount and when `batches` grows while in Live mode.
- Grab-to-drag pan via pointer events: on `pointermove` past 4px, set dragging, `setPointerCapture`, and pan `scrollLeft`; a `suppressClick` ref prevents the batch `onClick` from firing after a drag. Guard `pointerType === "mouse"`.
- Hidden native scrollbar (`.no-scrollbar` utility from `index.css` / `scrollbar-width:none`), custom position bar below: thumb width = `clientWidth/scrollWidth`, position = `scrollLeft/(scrollWidth-clientWidth)`, draggable + click-to-jump; updates on the container `scroll` event.
- Selecting a batch dims the rest (`opacity-20`), moves the playhead to it, and renders `CdcBatchDetail` beneath; `Live` clears selection, snaps playhead to now, and re-enables auto-follow.
- Empty batches → render `<p>` "Waiting for the first batch." (no track).
- `prefers-reduced-motion`: drop the playhead/scroll transitions (Tailwind `motion-reduce:` variants).

- [ ] **Step 1: Build the component** following the behavior list and the committed prototype for exact markup/classes (translate inline oklch to Tailwind tokens).

- [ ] **Step 2: Story with interaction test** — `cdc-batch-timeline.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { CdcBatchTimeline } from "./cdc-batch-timeline";
import { makeBatches } from "./cdc-batch-timeline.fixtures";

const meta = { title: "Apps/CDC batch timeline", component: CdcBatchTimeline } satisfies Meta<typeof CdcBatchTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithError: Story = {
  args: { batches: makeBatches({ withError: true }), nowMs: Date.parse("2026-07-28T08:30:00Z") },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const failed = canvas.getByRole("button", { name: /failed/i });
    await userEvent.click(failed);
    await expect(canvas.getByText(/read errors/i)).toBeVisible();
  },
};
```

Create `cdc-batch-timeline.fixtures.ts` exporting `makeBatches({ withError }): CdcLiveBatch[]` (deterministic, no `Math.random`).

- [ ] **Step 3: Run the interaction test** — `pnpm --dir src/Raven.Quill.Web test:storybook` (or watch in the Storybook UI). Expected: PASS (clicking the failed batch reveals its detail).

- [ ] **Step 4: Commit** — `git commit -m "Add scrollable drag-pan CDC batch timeline"`

---

## Task 7: Health header

**Files:**
- Create: `src/Raven.Quill.Web/src/pages/apps/cdc-health-header.tsx`

**Interfaces:**
- Consumes: `CdcLivePerformance` (status, recentWrites) from `use-cdc-live-performance`; `errorCount: number` (from the stored `cdcErrors` query, passed by the parent); `lastWriteLabel: string`.
- Produces: `export function CdcHealthHeader({ status, recentWrites, errorCount, lastWriteLabel, batchCount }: {...})`.

- [ ] **Step 1: Build** — a `Card`-less bordered row: status dot (`bg-success`/`bg-muted`/`bg-destructive`) + headline (`Syncing`/`Idle`/`Sync error`) + subline (`{errorCount} errors · last write {lastWriteLabel} · {batchCount} batches`) + right KPI pair (`Recent writes` via `formatCompact`, `Errors` red when `> 0`). When `status === "error"` tint the row with `bg-destructive/10 border-destructive/30`.

- [ ] **Step 2: Story** — `Syncing`, `Idle`, `Error` stories. Verify in both themes.
- [ ] **Step 3: Commit** — `git commit -m "Add CDC health header"`

---

## Task 8: Inline errors panel

**Files:**
- Create: `src/Raven.Quill.Web/src/pages/apps/cdc-errors-panel.tsx`

**Interfaces:**
- Consumes: `CdcError[]` (from `api.queries.apps.cdcErrors`); reuses `CdcErrorsSheet` for "View all".
- Produces: `export function CdcErrorsPanel({ slug, errors }: { slug: string; errors: CdcError[] })` — renders nothing when `errors.length === 0`; otherwise a red-tinted section titled `Errors` with a `View all {n}` trigger (opens `CdcErrorsSheet`) and the top 3 errors as rows (step chip, message in mono, document id, timestamp via `formatDateTime`).

- [ ] **Step 1: Build** — port the prototype's errors panel; rows use `text-destructive` message, `bg-muted` step chip. "View all" wraps the existing `CdcErrorsSheet` trigger button (`variant="destructive-outline" size="sm"`).
- [ ] **Step 2: Story** — `WithErrors` (3+ errors) and `None` (renders nothing). Verify.
- [ ] **Step 3: Commit** — `git commit -m "Add inline CDC errors panel"`

---

## Task 9: Compose the Data source view

**Files:**
- Modify: `src/Raven.Quill.Web/src/pages/apps/app-data-source.tsx`
- Modify: `src/Raven.Quill.Web/src/pages/apps/cdc-performance-section.tsx` (retire its chart/stat internals; keep a thin `SectionCard` wrapper that renders `CdcBatchTimeline`, or inline into the view and delete)
- Modify: `src/Raven.Quill.Web/src/pages/apps/app-data-source.stories.tsx`

**Interfaces:**
- Consumes: all of Tasks 1, 6, 7, 8.

- [ ] **Step 1: Rebuild `AppDataSource`** — order: `CdcHealthHeader` → `CdcErrorsPanel` → `SectionCard title="Live CDC performance"` wrapping `CdcBatchTimeline` → `CollectionsSection` → connection strip. Drive the header/timeline from `useCdcLivePerformance(slug)` and the errors panel/header `errorCount` from `useQuery(api.queries.apps.cdcErrors(slug))`. Keep the `ApiState` loading/error wrapper around the live section (connecting/feed-lost states). Replace the 3-card `ConnectionCard` with a one-line `ConnectionStrip` (application, `font-mono` database, connected date, `font-mono` task name).
- [ ] **Step 2: Stories** — extend `app-data-source.stories.tsx` with `Default` (healthy), `WithErrors`, `Empty`, `Connecting`, `FeedLost` using MSW mock variants (`appsMocks.cdcProgress(...)`, `appsMocks.cdcErrors([])`, a connecting/never-open socket, an error socket).
- [ ] **Step 3: Interaction test** — in `WithErrors`, a `play` asserts the health header shows `Sync error` and the errors panel lists an error message.
- [ ] **Step 4: Run** — `pnpm --dir src/Raven.Quill.Web test:storybook` → PASS. Typecheck + lint.
- [ ] **Step 5: Commit** — `git commit -m "Rebuild Data source view: health header, inline errors, batch timeline, connection strip"`

---

## Task 10: Light modal variant

**Files:**
- Create: `src/Raven.Quill.Web/src/pages/apps/cdc-sync-mini.tsx`
- Modify: `src/Raven.Quill.Web/src/pages/setup/add-app-wizard/add-app-wizard.tsx:101-106`

**Interfaces:**
- Consumes: `useCdcLivePerformance(slug)`, stored `cdcErrors` query, recharts `Area` (sparkline).
- Produces: `export function CdcSyncMini({ slug }: { slug: string })`.

- [ ] **Step 1: Build `CdcSyncMini`** — status pill + a small throughput sparkline (recharts `AreaChart`, no axes/controls, `isAnimationActive={false}`) + processed count + an inline error note (`{n} mapping errors so far — view`, opening `CdcErrorsSheet`) only when `errorCount > 0`.
- [ ] **Step 2: Swap into the modal** — in `AppCreatedDialog`, replace `<CdcPerformanceSection title="Sync progress" ... />` with `<CdcSyncMini slug={app.slug} />`.
- [ ] **Step 3: Story** — extend `add-app-wizard.stories.tsx` (or add one) showing the created-dialog with healthy and with-errors mocks. Verify.
- [ ] **Step 4: Run + commit** — `pnpm --dir src/Raven.Quill.Web test:storybook`, typecheck, lint. `git commit -m "Add light CDC sync health check to the app-created modal"`

---

## Task 11: Cleanup pass

**Files:** as touched.

- [ ] **Step 1:** Remove now-dead code (old `ConnectionCard`, unused `DashboardStatCards`/chart imports in `cdc-performance-section.tsx`, `CHART_LIMIT_OPTIONS`, the old bar chart). Confirm no remaining references (`grep`).
- [ ] **Step 2:** Run full checks: `pnpm --dir src/Raven.Quill.Web typecheck && pnpm --dir src/Raven.Quill.Web lint && pnpm --dir src/Raven.Quill.Web test:storybook`. All green.
- [ ] **Step 3:** Commit — `git commit -m "Remove superseded Data source chart and stat internals"`

---

## Deferred (not in this plan; flagged in the spec)

- **Live server relay:** confirm the WS `/api/apps/{slug}/cdc/progress` route forwards the `Details` operation tree, `CurrentlyAllocated`, and `BatchPullStopReason` to Quill. Storybook uses mocks, so this does not block the migration; it blocks the *live* timeline detail in production. Track separately.
- **Tuning:** revisit `PX_PER_SECOND` and `IDLE_GAP_THRESHOLD_MS` against real feeds.

## Self-review notes

- Spec coverage: health header (T7), inline errors + source-of-truth (T8, T9 wiring), timeline true-scale/gap-compression/playhead/drag/position-bar (T3, T6), phases-on-click (T5, T6), connection strip (T9), modal (T10), states (T6 empty, T9 connecting/feed-lost), rendering decision + drag guard (Global Constraints + T6). Data plumbing (T1). Mocks + stories (T4, all component tasks). Covered.
- Type consistency: `CdcLiveBatch` fields (`read`, `allocatedBytes`, `stopReason`, `phases`) defined in T1 and consumed by T5/T6; `PhaseSegment`/`toPhaseSegments` T2→T5; layout types T3→T6; `errorCount` sourced from stored `cdcErrors` in T7/T8/T9 per constraint.
- No placeholders in pure-logic tasks (full code). Component tasks reference the committed prototype + spec for exact markup by explicit instruction (the engineer has the running prototype), with concrete token/class guidance and complete story/test code.
