// The Quill mark's outline, kept apart from the components that draw it so the same path data can
// also be rasterised into a stencil for a shader.

/** The mark is authored on the app icon's 256x256 grid, inset from its edges. */
export const QUILL_MARK_VIEWBOX_SIZE = 256;

/** The raven mark. Two subpaths — the bird and the small tongue detail. */
export const QUILL_MARK_PATH =
    "M216.317 182.425C212.125 179.346 207.547 176.787 202.609 174.866C196.819 172.559 190.562 171.123 184.045 170.728C182.788 170.638 181.513 170.593 180.23 170.593C179.26 170.593 178.335 170.593 177.393 170.683C176.989 170.073 176.576 169.471 176.136 168.897C175.984 168.654 175.804 168.412 175.624 168.197C174.664 166.913 173.659 165.674 172.599 164.471C171.567 163.268 170.471 162.11 169.341 161.015C169.341 160.997 169.332 160.988 169.314 160.979C167.33 159.022 165.202 157.2 162.958 155.53C152.607 147.774 142.374 143.151 128.405 143.151C109.329 143.151 92.4615 154.408 81.034 167.909C72.2453 157.433 65.7909 141.984 65.7909 127.997C65.7909 93.6065 93.6645 65.7241 128.073 65.7241C158.999 65.7241 184.655 88.2563 189.512 117.8C190.06 121.121 190.347 124.523 190.347 127.997C190.347 141.427 185.867 153.546 178.605 163.699C178.793 163.914 178.955 164.094 179.099 164.256C179.754 164.992 180.059 165.261 180.759 166.168C191.442 165.863 199.458 168.744 204.97 171.213C205.473 170.315 205.967 169.4 206.443 168.475C212.637 156.383 216.12 142.486 216.12 127.997C216.12 124.55 215.922 121.139 215.527 117.8C210.482 73.9648 173.237 39.9512 128.073 39.9512C79.4539 39.9512 40 79.3512 40 127.997C40 152.137 49.6682 173.987 65.4228 189.876C81.2581 205.855 102.794 215.344 125.308 216.008C134.043 216.268 142.814 215.29 151.288 213.135C157.266 211.609 162.859 208.916 168.191 205.864C173.515 202.812 178.695 200.047 184.287 197.506C196.649 191.905 210.293 193.485 222.951 196.591C226.012 197.345 229.038 198.252 232 199.338C227.879 192.739 222.547 186.994 216.326 182.416L216.317 182.425ZM143.047 182.273H142.544C136.637 181.725 131.862 177.245 130.973 171.392L130.856 170.611L130.533 168.547L153.299 171.796L156.135 172.2C155.031 178.439 149.349 182.802 143.047 182.273Z";

/**
 * The mark's silhouette as a square canvas: opaque where the mark is, transparent everywhere else.
 * Only the alpha channel carries meaning — this is a stencil, not artwork — and it is what a shader
 * samples to decide which of its pixels the mark cuts away.
 *
 * Rasterising the same path string the components draw keeps one copy of the artwork. `Path2D` takes
 * the `d` attribute directly, so there is no SVG to serialise and no image to wait on.
 */
export function createQuillMarkStencilCanvas(sizePx: number) {
    const canvas = document.createElement("canvas");
    canvas.width = sizePx;
    canvas.height = sizePx;

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Could not get a 2D context to rasterise the Quill mark stencil.");
    }

    const scale = sizePx / QUILL_MARK_VIEWBOX_SIZE;
    context.scale(scale, scale);
    context.fillStyle = "#fff";
    context.fill(new Path2D(QUILL_MARK_PATH));

    return canvas;
}
