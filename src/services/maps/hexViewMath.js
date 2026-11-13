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
import { HEX_SIZE } from '../../config/outdoorConfig.js';

// Zoom level every view-reset pass targets (the old literal `centerView(2)` in
// HexMap's needsResetViewRef layout effect and useZoomPan's resetView). Kept
// as ONE constant so loader and renderer can never drift apart.
export const VIEW_RESET_ZOOM = 2;

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

// Clamp a pan origin so the viewport keeps grid coverage (margins derived from
// hexRows exactly as the interactive lane computes them).
export function clampHexPan(bounds, hexRows, pz, px, py) {
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

    const minPanX = gridLeft;
    const maxPanX = gridRight - viewW;
    const minPanY = gridTop;
    const maxPanY = gridBottom - viewH;

    return {
        x: Math.min(maxPanX, Math.max(minPanX, px)),
        y: Math.min(maxPanY, Math.max(minPanY, py)),
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
