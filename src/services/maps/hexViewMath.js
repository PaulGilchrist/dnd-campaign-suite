// Pure SVG view-port math for the hex board, moved VERBATIM out of
// src/components/hex-map/hooks/useZoomPan.js so the map loader's settle-at-mount
// pass (hex useMapLoader.js) and the interactive pan/zoom lane compute
// bit-identically matching zoom/pan bytes. That identity is the whole point:
// the persistence dirty gate may only skip the mount write when the layout
// view-normalize pass rewrites EXACTLY the bytes the loader already adopted —
// any float drift would re-dirty the envelope and re-PUT the whole document
// (backlog 2026-11-12 VX: zero-edit board open flushed multiple full 1800-cell
// writes because the view-reset leg ran one commit AFTER the baseline seed).
//
// Arithmetic order mirrors the original component code token-for-token so
// results stay bit-identical with previously persisted pan values.
import { HEX_SIZE, MIN_ZOOM, MAX_ZOOM } from '../../config/outdoorConfig.js';

// Zoom level every view-reset pass targets (the old literal `centerView(2)` in
// HexMap's needsResetViewRef layout effect and useZoomPan's resetView). Kept
// as ONE constant so loader and renderer can never drift apart.
export const VIEW_RESET_ZOOM = 2;

// Pixel inset the mount auto-fit keeps between the board extent and EVERY
// viewport edge (XF backlog 2026-11-16: at the old floor the fit could park
// top-row POI hit-rects at/beyond the toolbar edge — ~36 px slivers Playwright
// trusted clicks refuse as "element is outside of the viewport"). 40 px clears
// the full 36 SVG-unit hit-rect plus its label at any realistic fit scale.
// The inset SHRINKS the usable viewport for the fit math; it never crops the
// board.
export const HEX_FIT_INSET_PX = 40;

// Mount-fit stamp version persisted on the outdoor map document (YG backlog
// 2026-11-16, owner Option B: the STORED VIEW IS CANONICAL). One canonical
// shape, one branch: doc.fitVersion === HEX_FIT_VERSION → every mount applies
// the stored zoom/panX/panY verbatim and never fits; a doc whose stamp is
// absent or stale (stale-by-shape — no other leniency) gets exactly ONE
// mount auto-fit whose write persists the fitted view together with this
// constant, so every subsequent mount is byte-neutral. Deliberate pan/zoom
// edits are the only other writer of the view and carry the stamp through the
// hex envelope (useMapLoader.js CARRIED_DOC_KEYS). Bumping this constant
// re-runs the stamping pass for every doc — migrate repo-owned map fixtures
// (public/campaigns/**, test fixtures) in the same change.
export const HEX_FIT_VERSION = 1;

// Pixel bounds of the hexCols×hexRows grid (SVG user units).
export function hexGridPixelBounds(hexCols, hexRows) {
    const xMin = -HEX_SIZE * Math.sqrt(3) / 2;
    const xMax = HEX_SIZE * Math.sqrt(3) * ((hexCols - 1) + (hexRows - 1) / 2 + 0.5);
    const yMin = -HEX_SIZE;
    const yMax = HEX_SIZE * (1.5 * (hexRows - 1) + 1);
    return {
        width: xMax - xMin,
        height: yMax - yMin,
        offsetX: xMin,
        offsetY: yMin,
        centerX: (xMin + xMax) / 2,
        centerY: (yMin + yMax) / 2,
    };
}

// The pan bracket clampHexPan saturates against: the legal pan range per axis
// at a given zoom (margins derived from hexRows exactly as the interactive
// lane computes them). Shared with isHexPanClampPinned so the hint chip's
// dim state and the pan handler read the SAME clamp math — arithmetic order
// is token-identical to the original inline computation, so bytes are unchanged.
function hexPanBrackets(bounds, hexRows, pz) {
    const viewW = bounds.width / pz;
    const viewH = bounds.height / pz;
    const sqrt3 = Math.sqrt(3);
    const hexW = sqrt3 * HEX_SIZE;
    const hexH = 1.5 * HEX_SIZE;
    const marginX = ((hexRows - 1) / 2 || 0.5) * hexW;
    const marginY = (hexRows / 4 - 1 || 0.5) * hexH;

    const gridLeft = bounds.offsetX + marginX;
    const gridRight = bounds.offsetX + bounds.width - marginX;
    const gridTop = bounds.offsetY + marginY;
    const gridBottom = bounds.offsetY + bounds.height - marginY;

    return {
        viewW, viewH,
        minPanX: gridLeft,
        maxPanX: gridRight - viewW,
        minPanY: gridTop,
        maxPanY: gridBottom - viewH,
    };
}

// True when pan is clamp-PINNED at this zoom: BOTH brackets are inverted
// (max < min — the whole grid span fits inside the viewport), so every pan
// delta answers with the same centered value and the WASD/arrow keys honestly
// move nothing. This is the fit-zoom regime; zooming in frees the axes and
// the predicate flips back to false. Pure, so the hint chip can dim the pan
// clause from the same math the pan handler uses (hex WSAD hint backlog
// 2026-11-26).
export function isHexPanClampPinned(bounds, hexRows, zoom) {
    const { minPanX, maxPanX, minPanY, maxPanY } = hexPanBrackets(bounds, hexRows, zoom);
    return maxPanX < minPanX && maxPanY < minPanY;
}

// Clamp a pan origin so the viewport keeps grid coverage (margins derived from
// hexRows exactly as the interactive lane computes them).
export function clampHexPan(bounds, hexRows, pz, px, py) {
    const { viewW, viewH, minPanX, maxPanX, minPanY, maxPanY } = hexPanBrackets(bounds, hexRows, pz);

    // Inverted bracket (max < min): the whole grid span already fits inside the
    // viewport (the mount auto-fit's zoom lives here — XF backlog 2026-11-16).
    // No saturated pan exists, so the old min-of-max used to STICK the view at
    // the right/bottom edge and park left/top-row POIs off-screen. Center the
    // board instead, via the exact `centerHexView` expression (centerX − view/2)
    // so loader-settle and layout-fit bytes stay bit-identical.
    return {
        x: maxPanX < minPanX ? bounds.centerX - viewW / 2 : Math.min(maxPanX, Math.max(minPanX, px)),
        y: maxPanY < minPanY ? bounds.centerY - viewH / 2 : Math.min(maxPanY, Math.max(minPanY, py)),
    };
}

// Centered pan for a target zoom (grid center minus half the viewport, clamped).
export function centerHexView(hexCols, hexRows, targetZoom) {
    const bounds = hexGridPixelBounds(hexCols, hexRows);
    const vw = bounds.width / targetZoom;
    const vh = bounds.height / targetZoom;
    const cx = bounds.centerX - vw / 2;
    const cy = bounds.centerY - vh / 2;
    return clampHexPan(bounds, hexRows, targetZoom, cx, cy);
}

// Whole-board auto-fit for a viewport of `viewportWidth × viewportHeight` CSS
// px (the mounted <svg>'s bounding rect), keeping `insetPx` free on every edge
// so no POI hit-rect is ever parked at the viewport/toolbar boundary.
//
// Geometry: the renderer's viewBox is `bounds/zoom` with the default
// preserveAspectRatio=meet, so at zoom z the board occupies exactly
// `z × boardWidthAtZoom1` px on each axis, where boardWidthAtZoom1 is the
// board extent projected into the viewport at zoom 1 (the constrained axis
// touches the edge, the other letterboxes). Solving
// z × widthAtZoom1 ≤ usable on BOTH axes gives the largest fit zoom; the pan
// then centers the board in the viewport (the inset only shrinks the usable
// viewport — the board itself is never cropped).
export function fitHexView(hexCols, hexRows, viewportWidth, viewportHeight, insetPx = HEX_FIT_INSET_PX) {
    const bounds = hexGridPixelBounds(hexCols, hexRows);
    const usableW = Math.max(1, viewportWidth - 2 * insetPx);
    const usableH = Math.max(1, viewportHeight - 2 * insetPx);
    const boardWidthAtZoom1 = Math.min(viewportWidth, bounds.width * viewportHeight / bounds.height);
    const boardHeightAtZoom1 = Math.min(viewportHeight, bounds.height * viewportWidth / bounds.width);
    const fitZoom = Math.min(usableW / boardWidthAtZoom1, usableH / boardHeightAtZoom1);
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitZoom));
    const pan = centerHexView(hexCols, hexRows, zoom);
    return { zoom, panX: pan.x, panY: pan.y };
}
