import { lazy, Suspense } from "react";

import * as THREE from "three";
import {
    QUILL_MARK_PATH,
    QUILL_MARK_VIEWBOX_SIZE,
    createQuillMarkStencilCanvas,
} from "@/components/brand/quill-mark-stencil";
import { useResolvedTheme } from "@/components/shadcn/theme-provider";
import { REDUCED_MOTION_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query";

// three.js and the shader are worth nothing to a reader of the transcript, so they load only once
// an empty conversation is actually on screen.
const PixelBlast = lazy(() => import("@/components/backgrounds/pixel-blast"));

/**
 * The brand ramp, written out because a shader takes a colour value rather than a custom property.
 *
 * Dark gets `--brand-500`, the brand colour itself and the same hex as the app icon. Light gets
 * `--brand-600`, the deeper step index.css keeps "for the cases the brand colour cannot serve":
 * against the near-white light surface, brand-500 dots are too faint to make out the shape they are
 * cut into, which is the whole point of the knockout.
 */
const FIELD_COLOR = { dark: "#ff775f", light: "#c6432e" } as const;

/**
 * The stencil is a silhouette thresholded onto a grid of a few dozen pixels, so the mark's own 256px
 * grid is already more detail than the shader can use.
 */
const STENCIL_SIZE_PX = 256;

/** Built on first use and shared: it never changes, and a texture per mount would be wasteful. */
let stencilTexture: THREE.CanvasTexture | null = null;

function getStencilTexture() {
    stencilTexture ??= new THREE.CanvasTexture(createQuillMarkStencilCanvas(STENCIL_SIZE_PX));
    return stencilTexture;
}

/** What is left of the effect when animation is unwelcome: the mark, sitting still. */
const StaticMark = () => (
    <svg
        viewBox={`0 0 ${QUILL_MARK_VIEWBOX_SIZE} ${QUILL_MARK_VIEWBOX_SIZE}`}
        className="size-full text-primary"
        aria-hidden="true"
    >
        <path d={QUILL_MARK_PATH} fill="currentColor" />
    </svg>
);

/**
 * The upper half of the empty conversation: a full-bleed field of animated pixels in brand coral,
 * with the Quill mark knocked out of the middle of it, so the mark reads as the panel behind.
 * Clicking sends a ripple out through the pixels.
 */
export function AssistantEmptyStateReveal() {
    const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_MEDIA_QUERY);
    const resolvedTheme = useResolvedTheme();

    // Decorative: the empty state already says what the panel is in the text below this.
    if (prefersReducedMotion) {
        return (
            <div className="flex min-h-0 flex-1 items-center justify-center" aria-hidden="true">
                <div className="aspect-square h-full max-h-40 min-w-0">
                    <StaticMark />
                </div>
            </div>
        );
    }

    return (
        // The negative margins cancel the transcript's own p-3 so the field runs to the panel's
        // edges instead of floating inside a gutter. Cancelling padding exactly cannot overflow the
        // scroll container, because the element's edges land on its padding box.
        <div className="-mx-3 -mt-3 min-h-0 flex-1 border-y border-primary" aria-hidden="true">
            <Suspense fallback={null}>
                <PixelBlast
                    variant="circle"
                    color={FIELD_COLOR[resolvedTheme]}
                    pixelSize={5}
                    // Upstream evaluates the noise and the ripples per 8-pixel cell, which assumes a
                    // full-viewport canvas. In a panel this size that leaves about five cells top to
                    // bottom, so a ripple can only resolve as a handful of blocks; four keeps the
                    // dots big while giving the field and the ripples a roundness they cannot
                    // otherwise have here.
                    cellPixels={4}
                    // Large enough features to read as shapes rather than even static, small enough
                    // that the whole field does not dim at once and take the cutout with it: below
                    // about 2 the noise has so few features that they cover the panel together, and
                    // the field swings between crowded and nearly empty as they drift.
                    patternScale={2.75}
                    // Denser than the upstream default: a cutout only reads against a field solid
                    // enough to have negative space, and at the default the mark is lost among the
                    // gaps. Past roughly 3 the noise flattens into a plain dot grid.
                    patternDensity={2.5}
                    // The noise alone occupies only the middle of the range the dither can express,
                    // which reads as an evenly middling stipple. Spreading it gives the field a
                    // gradient from near-solid down to scattered dots, the way upstream's demo does.
                    // It trades against the cutout, which is only visible where the field is dense
                    // enough to have negative space, so this stops well short of upstream's sweep.
                    patternContrast={1.25}
                    // Varies each pixel's size a little, so the field is a mix of sizes rather than
                    // one dot repeated. Upstream's own knob, off by default.
                    pixelSizeJitter={0.75}
                    speed={0.625}
                    // Enough fade that the field dissolves into the panel on all four sides
                    // instead of ending on a visible rectangle.
                    edgeFade={0}
                    rippleThickness={0.125}
                    rippleSpeed={0.25}
                    // Above the upstream default of 1, because upstream folds a ripple in with
                    // `max(feed, ring)` and then damps it by exp(-10 * radius): against a field
                    // dense enough to cut a shape out of, the default ring loses that max almost
                    // everywhere. A click still reads as a bloom that spreads and fades rather than
                    // a hard travelling ring, which is upstream's behaviour too.
                    rippleIntensityScale={6}
                    stencil={getStencilTexture()}
                    stencilScale={0.875}
                    stencilMode="knockout"
                    className="size-full"
                />
            </Suspense>
        </div>
    );
}
