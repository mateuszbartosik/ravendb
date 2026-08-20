// Ported from React Bits (https://reactbits.dev/backgrounds/pixel-blast) to TypeScript. The shader
// is kept as it is upstream — the Bayer-dithered cell noise is the whole look — with one addition:
// an optional stencil that knocks a silhouette out of the field (see the uStencil uniforms).
//
// Two upstream options are not ported, both needing `postprocessing` and
// `three-custom-shader-material`: the `liquid` pointer-distortion variant and the `noiseAmount`
// grain pass. Neither is on by default, and neither is worth two dependencies here.
//
// Plain three.js rather than @react-three/fiber, matching upstream: the component owns a single
// fullscreen quad and its own animation loop, so a reconciler would only be in the way.
import { useEffect, useRef } from "react";

import * as THREE from "three";

type PixelBlastVariant = "square" | "circle" | "triangle" | "diamond";

const SHAPE_MAP: Record<PixelBlastVariant, number> = {
    square: 0,
    circle: 1,
    triangle: 2,
    diamond: 3,
};

/** Ripples in flight at once. Fixed because a GLSL loop needs a bound known at compile time. */
const MAX_CLICKS = 10;

const VERTEX_SHADER = /* glsl */ `
    void main() {
        gl_Position = vec4(position, 1.0);
    }
`;

const FRAGMENT_SHADER = /* glsl */ `
    precision highp float;

    uniform vec3  uColor;
    uniform vec2  uResolution;
    uniform float uTime;
    uniform float uPixelSize;
    uniform float uCellPixels;
    uniform float uScale;
    uniform float uDensity;
    uniform float uContrast;
    uniform float uPixelJitter;
    uniform int   uEnableRipples;
    uniform float uRippleSpeed;
    uniform float uRippleThickness;
    uniform float uRippleIntensity;
    uniform float uEdgeFade;

    uniform int   uShapeType;
    const int SHAPE_SQUARE   = 0;
    const int SHAPE_CIRCLE   = 1;
    const int SHAPE_TRIANGLE = 2;
    const int SHAPE_DIAMOND  = 3;

    const int MAX_CLICKS = ${MAX_CLICKS};

    uniform vec2  uClickPos  [MAX_CLICKS];
    uniform float uClickTimes[MAX_CLICKS];

    // The silhouette. STENCIL_FILL pushes the field denser inside it, so the shape picks
    // itself out of the noise; STENCIL_KNOCKOUT cuts it away instead.
    uniform sampler2D uStencil;
    uniform int   uStencilEnabled;
    uniform int   uStencilMode;
    uniform float uStencilStrength;
    uniform vec2  uStencilCentre;
    uniform vec2  uStencilSize;
    const int STENCIL_FILL     = 0;
    const int STENCIL_KNOCKOUT = 1;

    out vec4 fragColor;

    float Bayer2(vec2 a) {
        a = floor(a);
        return fract(a.x / 2. + a.y * a.y * .75);
    }
    #define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
    #define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))

    #define FBM_OCTAVES     5
    #define FBM_LACUNARITY  1.25
    #define FBM_GAIN        1.0

    float hash11(float n){ return fract(sin(n)*43758.5453); }

    float vnoise(vec3 p){
        vec3 ip = floor(p);
        vec3 fp = fract(p);
        float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
        float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
        float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
        float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));
        float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
        float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
        float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
        float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
        vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);
        float x00 = mix(n000, n100, w.x);
        float x10 = mix(n010, n110, w.x);
        float x01 = mix(n001, n101, w.x);
        float x11 = mix(n011, n111, w.x);
        float y0  = mix(x00, x10, w.y);
        float y1  = mix(x01, x11, w.y);
        return mix(y0, y1, w.z) * 2.0 - 1.0;
    }

    float fbm2(vec2 uv, float t){
        vec3 p = vec3(uv * uScale, t);
        float amp = 1.0;
        float freq = 1.0;
        float sum = 1.0;
        for (int i = 0; i < FBM_OCTAVES; ++i){
            sum  += amp * vnoise(p * freq);
            freq *= FBM_LACUNARITY;
            amp  *= FBM_GAIN;
        }
        return sum * 0.5 + 0.5;
    }

    float maskCircle(vec2 p, float cov){
        float r = sqrt(cov) * .25;
        float d = length(p - 0.5) - r;
        float aa = 0.5 * fwidth(d);
        return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
    }

    float maskTriangle(vec2 p, vec2 id, float cov){
        bool flip = mod(id.x + id.y, 2.0) > 0.5;
        if (flip) p.x = 1.0 - p.x;
        float r = sqrt(cov);
        float d  = p.y - r*(1.0 - p.x);
        float aa = fwidth(d);
        return cov * clamp(0.5 - d/aa, 0.0, 1.0);
    }

    float maskDiamond(vec2 p, float cov){
        float r = sqrt(cov) * 0.564;
        return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
    }

    void main(){
        float pixelSize = uPixelSize;
        vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
        float aspectRatio = uResolution.x / uResolution.y;

        vec2 pixelId = floor(fragCoord / pixelSize);
        vec2 pixelUV = fract(fragCoord / pixelSize);

        // Sampled at the pixel's centre rather than this fragment, which keeps the silhouette's edge
        // on the pixel grid: it lands on whole pixels instead of being sliced through the middle of
        // them by a smooth vector edge.
        float stencilHit = 0.0;
        if (uStencilEnabled == 1) {
            vec2 pixelCentre = ((pixelId + 0.5) * pixelSize + uResolution * .5) / uResolution;
            vec2 stencilUV = (pixelCentre - uStencilCentre) / uStencilSize + 0.5;
            if (all(greaterThanEqual(stencilUV, vec2(0.0))) && all(lessThanEqual(stencilUV, vec2(1.0)))) {
                stencilHit = step(0.5, texture(uStencil, stencilUV).a);
            }
        }

        float cellPixelSize = uCellPixels * pixelSize;
        vec2 cellId = floor(fragCoord / cellPixelSize);
        vec2 cellCoord = cellId * cellPixelSize;
        vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);

        float base = fbm2(uv, uTime * 0.05);
        base = base * 0.5 - 0.65;

        float feed = base + (uDensity - 0.5) * 0.3;

        // The dither turns a pixel on when feed + bayer > 0.5, with bayer spanning [-0.5, 0.5], so
        // feed only has reach between 0 and 1 — 0 is an empty field, 1 a solid one. The noise on its
        // own occupies about half of that, which is why the field can look evenly middling. Widening
        // it around the midpoint is what buys the range from a solid core out to scattered dots.
        feed = 0.5 + (feed - 0.5) * uContrast;

        // Before the dither, so the mark's pixels are turned on by the same Bayer threshold as the
        // rest of the field and read as part of it rather than as a pasted-on shape.
        if (uStencilMode == STENCIL_FILL) {
            feed += stencilHit * uStencilStrength;
        }

        float speed     = uRippleSpeed;
        float thickness = uRippleThickness;
        const float dampT     = 1.0;
        const float dampR     = 10.0;

        if (uEnableRipples == 1) {
            for (int i = 0; i < MAX_CLICKS; ++i){
                vec2 pos = uClickPos[i];
                if (pos.x < 0.0) continue;
                float cellPixelSize = uCellPixels * pixelSize;
                vec2 cuv = (((pos - uResolution * .5 - cellPixelSize * .5) / (uResolution))) * vec2(aspectRatio, 1.0);
                float t = max(uTime - uClickTimes[i], 0.0);
                float r = distance(uv, cuv);
                float waveR = speed * t;
                float ring  = exp(-pow((r - waveR) / thickness, 2.0));
                float atten = exp(-dampT * t) * exp(-dampR * r);
                feed = max(feed, ring * atten * uRippleIntensity);
            }
        }

        float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
        float bw = step(0.5, feed + bayer);

        float h = fract(sin(dot(floor(fragCoord / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
        float jitterScale = 1.0 + (h - 0.5) * uPixelJitter;
        float coverage = bw * jitterScale;
        float M;
        if      (uShapeType == SHAPE_CIRCLE)   M = maskCircle (pixelUV, coverage);
        else if (uShapeType == SHAPE_TRIANGLE) M = maskTriangle(pixelUV, pixelId, coverage);
        else if (uShapeType == SHAPE_DIAMOND)  M = maskDiamond(pixelUV, coverage);
        else                                   M = coverage;

        if (uStencilMode == STENCIL_KNOCKOUT) {
            M *= 1.0 - stencilHit;
        }

        if (uEdgeFade > 0.0) {
            vec2 norm = gl_FragCoord.xy / uResolution;
            float edge = min(min(norm.x, norm.y), min(1.0 - norm.x, 1.0 - norm.y));
            float fade = smoothstep(0.0, uEdgeFade, edge);
            M *= fade;
        }

        vec3 color = uColor;

        // sRGB gamma correction - convert linear to sRGB for accurate color output
        vec3 srgbColor = mix(
            color * 12.92,
            1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055,
            step(0.0031308, color)
        );

        fragColor = vec4(srgbColor, M);
    }
`;

type PixelBlastUniforms = {
    uResolution: { value: THREE.Vector2 };
    uTime: { value: number };
    uColor: { value: THREE.Color };
    uClickPos: { value: THREE.Vector2[] };
    uClickTimes: { value: Float32Array };
    uShapeType: { value: number };
    uPixelSize: { value: number };
    uCellPixels: { value: number };
    uScale: { value: number };
    uDensity: { value: number };
    uContrast: { value: number };
    uPixelJitter: { value: number };
    uEnableRipples: { value: number };
    uRippleSpeed: { value: number };
    uRippleThickness: { value: number };
    uRippleIntensity: { value: number };
    uEdgeFade: { value: number };
    uStencil: { value: THREE.Texture | null };
    uStencilEnabled: { value: number };
    uStencilMode: { value: number };
    uStencilStrength: { value: number };
    uStencilCentre: { value: THREE.Vector2 };
    uStencilSize: { value: THREE.Vector2 };
};

export type PixelBlastProps = {
    variant?: PixelBlastVariant;
    /** Edge length of one pixel, in CSS pixels. */
    pixelSize?: number;
    /**
     * How many pixels wide a noise cell is. The noise and the ripples are both evaluated per cell,
     * so this is the resolution of every shape the field makes. Upstream hard-codes 8, which suits a
     * full-viewport canvas; on a small one an 8-pixel cell leaves so few cells across that a ripple
     * can only resolve as a handful of blocks, and lowering it buys back the roundness without
     * shrinking the pixels themselves.
     */
    cellPixels?: number;
    color?: string;
    className?: string;
    antialias?: boolean;
    patternScale?: number;
    patternDensity?: number;
    /**
     * Spread of the field's density around its midpoint. 1 is upstream. Above it the dense parts go
     * solid and the sparse parts empty out, which is what gives the field range rather than an even
     * middling stipple.
     */
    patternContrast?: number;
    pixelSizeJitter?: number;
    enableRipples?: boolean;
    rippleIntensityScale?: number;
    rippleThickness?: number;
    rippleSpeed?: number;
    /** Stop rendering while scrolled out of view. */
    autoPauseOffscreen?: boolean;
    speed?: number;
    /** How far in from the container's edges the field fades out, as a fraction. */
    edgeFade?: number;
    /**
     * Silhouette knocked out of the middle of the field. Only the alpha channel is read, and it is
     * thresholded, so the cut-out is made of whole pixels.
     */
    stencil?: THREE.Texture;
    /** Size of the square stencil box, as a fraction of the container's shorter side. */
    stencilScale?: number;
    /**
     * How the stencil meets the field. "fill" makes the silhouette a denser patch of the same noise,
     * which is the only one that reads on a sparse field; "knockout" cuts the silhouette away, which
     * needs a field solid enough to have negative space.
     */
    stencilMode?: "fill" | "knockout";
    /** How much "fill" adds to the noise inside the silhouette. Ignored by "knockout". */
    stencilStrength?: number;
};

/** What the animation loop reads each frame, in one object so the loop has a single source. */
type LiveSettings = { speed: number; stencilScale: number };

function createUniforms(): PixelBlastUniforms {
    return {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uColor: { value: new THREE.Color() },
        // A negative x marks a free slot, which is what the shader tests for.
        uClickPos: { value: Array.from({ length: MAX_CLICKS }, () => new THREE.Vector2(-1, -1)) },
        uClickTimes: { value: new Float32Array(MAX_CLICKS) },
        uShapeType: { value: 0 },
        uPixelSize: { value: 1 },
        uCellPixels: { value: 8 },
        uScale: { value: 1 },
        uDensity: { value: 1 },
        uContrast: { value: 1 },
        uPixelJitter: { value: 0 },
        uEnableRipples: { value: 1 },
        uRippleSpeed: { value: 0.3 },
        uRippleThickness: { value: 0.1 },
        uRippleIntensity: { value: 1 },
        uEdgeFade: { value: 0 },
        uStencil: { value: null },
        uStencilEnabled: { value: 0 },
        uStencilMode: { value: 0 },
        uStencilStrength: { value: 0 },
        uStencilCentre: { value: new THREE.Vector2(0.5, 0.5) },
        uStencilSize: { value: new THREE.Vector2(1, 1) },
    };
}

export default function PixelBlast({
    variant = "square",
    pixelSize = 3,
    cellPixels = 8,
    color = "#B497CF",
    className,
    antialias = true,
    patternScale = 2,
    patternDensity = 1,
    patternContrast = 1,
    pixelSizeJitter = 0,
    enableRipples = true,
    rippleIntensityScale = 1,
    rippleThickness = 0.1,
    rippleSpeed = 0.3,
    autoPauseOffscreen = true,
    speed = 0.5,
    edgeFade = 0,
    stencil,
    stencilScale = 0.9,
    stencilMode = "fill",
    stencilStrength = 0.5,
}: PixelBlastProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const uniformsRef = useRef<PixelBlastUniforms | null>(null);
    // Written by the sync effect below and read by the animation loop, which is outside React.
    const liveRef = useRef<LiveSettings>({ speed, stencilScale });

    // Owns the WebGL context and the animation loop, neither of which React can express. Every
    // uniform starts neutral and is filled in by the sync effect, so none of the tunable props are
    // dependencies here — retuning one must not tear the context down and build it again.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        const uniforms = createUniforms();
        uniformsRef.current = uniforms;

        const renderer = new THREE.WebGLRenderer({
            canvas: document.createElement("canvas"),
            antialias,
            alpha: true,
            powerPreference: "high-performance",
        });
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearAlpha(0);
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const material = new THREE.ShaderMaterial({
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            uniforms,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            glslVersion: THREE.GLSL3,
        });
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(quad);

        const setSize = () => {
            renderer.setSize(container.clientWidth || 1, container.clientHeight || 1, false);
            uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height);
        };
        setSize();
        const resizeObserver = new ResizeObserver(setSize);
        resizeObserver.observe(container);

        let isVisible = true;
        const intersectionObserver = autoPauseOffscreen
            ? new IntersectionObserver((entries) => {
                  // The last entry, not the first: a callback carries a time-ordered queue, and
                  // pinning the panel crosses the threshold twice in quick succession (the shell
                  // clips the column while its width transitions). Reading entries[0] took the
                  // stale "gone" and dropped the "back", leaving the loop paused for good.
                  isVisible = entries[entries.length - 1].isIntersecting;
              })
            : null;
        intersectionObserver?.observe(container);

        let clickIndex = 0;
        const handlePointerDown = (event: PointerEvent) => {
            const bounds = renderer.domElement.getBoundingClientRect();
            const scaleX = renderer.domElement.width / bounds.width;
            const scaleY = renderer.domElement.height / bounds.height;
            uniforms.uClickPos.value[clickIndex].set(
                (event.clientX - bounds.left) * scaleX,
                // The shader works in gl_FragCoord space, which runs bottom-up.
                (bounds.height - (event.clientY - bounds.top)) * scaleY,
            );
            uniforms.uClickTimes.value[clickIndex] = uniforms.uTime.value;
            clickIndex = (clickIndex + 1) % MAX_CLICKS;
        };
        renderer.domElement.addEventListener("pointerdown", handlePointerDown, { passive: true });

        // Starting at a random point in the noise keeps two instances on one page out of lockstep.
        const timeOffset = Math.random() * 1000;
        const clock = new THREE.Clock();
        let animationFrame = 0;
        const animate = () => {
            animationFrame = requestAnimationFrame(animate);
            if (!isVisible) {
                return;
            }

            const live = liveRef.current;
            uniforms.uTime.value = timeOffset + clock.getElapsedTime() * live.speed;
            // Derived from the live resolution so the knockout keeps its size and its squareness
            // across a resize, without the resize observer needing to know about it.
            const { x: width, y: height } = uniforms.uResolution.value;
            const boxPx = Math.min(width, height) * live.stencilScale;
            uniforms.uStencilSize.value.set(boxPx / width, boxPx / height);

            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
            intersectionObserver?.disconnect();
            renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
            quad.geometry.dispose();
            material.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
            uniformsRef.current = null;
        };
    }, [antialias, autoPauseOffscreen]);

    // Pushes the tunable props onto the live uniforms, so retuning one recolours or reshapes the
    // running shader rather than rebuilding it.
    useEffect(() => {
        liveRef.current = { speed, stencilScale };

        const uniforms = uniformsRef.current;
        if (!uniforms) {
            return;
        }

        uniforms.uShapeType.value = SHAPE_MAP[variant];
        // Upstream scales by the pixel ratio, so a pixel is a CSS pixel rather than a device one.
        uniforms.uPixelSize.value = pixelSize * Math.min(window.devicePixelRatio || 1, 2);
        uniforms.uCellPixels.value = cellPixels;
        uniforms.uColor.value.set(color);
        uniforms.uScale.value = patternScale;
        uniforms.uDensity.value = patternDensity;
        uniforms.uContrast.value = patternContrast;
        uniforms.uPixelJitter.value = pixelSizeJitter;
        uniforms.uEnableRipples.value = enableRipples ? 1 : 0;
        uniforms.uRippleIntensity.value = rippleIntensityScale;
        uniforms.uRippleThickness.value = rippleThickness;
        uniforms.uRippleSpeed.value = rippleSpeed;
        uniforms.uEdgeFade.value = edgeFade;
        uniforms.uStencil.value = stencil ?? null;
        uniforms.uStencilEnabled.value = stencil ? 1 : 0;
        uniforms.uStencilMode.value = stencilMode === "knockout" ? 1 : 0;
        uniforms.uStencilStrength.value = stencilStrength;
    }, [
        variant,
        pixelSize,
        cellPixels,
        color,
        patternScale,
        patternDensity,
        patternContrast,
        pixelSizeJitter,
        enableRipples,
        rippleIntensityScale,
        rippleThickness,
        rippleSpeed,
        edgeFade,
        speed,
        stencil,
        stencilScale,
        stencilMode,
        stencilStrength,
    ]);

    return <div ref={containerRef} className={className} aria-hidden="true" />;
}
