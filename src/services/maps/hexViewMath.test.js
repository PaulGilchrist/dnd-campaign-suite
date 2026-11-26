// Pins for the mount auto-fit seam (XF backlog 2026-11-16): the fit math must
// keep a named ~40 px inset between the board extent and every viewport edge,
// show the WHOLE board (inset shrinks the usable viewport, never crops the
// board), and the pan clamp must CENTER — not saturate — when the whole grid
// span fits inside the viewport at the fit zoom.
import { describe, it, expect } from 'vitest';
import {
    HEX_SIZE, GRID_COLS_MULTIPLIER, MIN_ZOOM, MAX_ZOOM,
} from '../../config/outdoorConfig.js';
import {
    hexGridPixelBounds, clampHexPan, centerHexView, fitHexView,
    HEX_FIT_INSET_PX, HEX_FIT_VERSION, VIEW_RESET_ZOOM, isHexPanClampPinned,
} from './hexViewMath.js';

// Owner fixture shape: poi-showcase (gridSize 8 → 16 cols × 8 rows).
const GRID_SIZE = 8;
const HEX_COLS = GRID_SIZE * GRID_COLS_MULTIPLIER;

// Replicate the renderer's mapping: <svg viewBox="panX panY w/zoom h/zoom">
// with the default preserveAspectRatio="meet" scales the viewBox uniformly by
// min(elW/vbW, elH/vbH) and CENTERS it in the element. Screen px of an SVG
// user unit (with the svg element anchored at the window origin):
function toScreenPx(svgX, svgY, { zoom, panX, panY }, elW, elH) {
    const bounds = hexGridPixelBounds(HEX_COLS, GRID_SIZE);
    const vbW = bounds.width / zoom;
    const vbH = bounds.height / zoom;
    const s = Math.min(elW / vbW, elH / vbH);
    return {
        x: (svgX - panX) * s + (elW - vbW * s) / 2,
        y: (svgY - panY) * s + (elH - vbH * s) / 2,
    };
}

describe('HEX_FIT_INSET_PX', () => {
    it('is the deliberate 40 px per-edge inset the mount fit reserves', () => {
        expect(HEX_FIT_INSET_PX).toBe(40);
    });
});

describe('HEX_FIT_VERSION', () => {
    // The stamp is the ONE branch of the mount-fit law (YG backlog 2026-11-16):
    // doc.fitVersion === HEX_FIT_VERSION → mount verbatim; anything else
    // (absent reads as stale-by-shape) → one mount fit + restamp. Bumping this
    // constant re-runs the stamping pass for every doc — the disk fixture
    // (public/campaigns/test-campaign/maps/poi-showcase.json) and the settled
    // hook fixtures must migrate in the same change.
    it('is the version stamped into outdoor map docs by the mount-fit pass', () => {
        expect(HEX_FIT_VERSION).toBe(1);
    });
});

describe('fitHexView', () => {
    // A QA-ish viewport WIDER (aspect 1.73) than the board extent (aspect 2.70):
    // width is the constrained axis and the fit lands exactly on usable width.
    const EL_W = 1548;
    const EL_H = 895;

    it('shrinks the VIEWPORT by the inset — width-constrained zoom is exact', () => {
        const fit = fitHexView(HEX_COLS, GRID_SIZE, EL_W, EL_H);
        // At zoom 1 the board spans exactly elW here (width-limited meet), so
        // z = usable/width-at-zoom-1 = (elW − 2·inset) / elW.
        expect(fit.zoom).toBeCloseTo((EL_W - 2 * HEX_FIT_INSET_PX) / EL_W, 10);
        expect(fit.zoom).toBeLessThan(1); // a MIN_ZOOM of 2 could never fit — hence the floor drop
    });

    it('lands every board corner (and thus every POI) inside viewport minus inset', () => {
        const fit = fitHexView(HEX_COLS, GRID_SIZE, EL_W, EL_H);
        const b = hexGridPixelBounds(HEX_COLS, GRID_SIZE);
        for (const [sx, sy] of [
            [b.offsetX, b.offsetY], [b.offsetX + b.width, b.offsetY],
            [b.offsetX, b.offsetY + b.height], [b.offsetX + b.width, b.offsetY + b.height],
        ]) {
            const p = toScreenPx(sx, sy, fit, EL_W, EL_H);
            expect(p.x).toBeGreaterThanOrEqual(HEX_FIT_INSET_PX - 1e-6);
            expect(p.x).toBeLessThanOrEqual(EL_W - HEX_FIT_INSET_PX + 1e-6);
            expect(p.y).toBeGreaterThanOrEqual(HEX_FIT_INSET_PX - 1e-6);
            expect(p.y).toBeLessThanOrEqual(EL_H - HEX_FIT_INSET_PX + 1e-6);
        }
    });

    it('never crops the board on taller viewports either (extents all on-screen)', () => {
        // Height-constrained element (aspect wider than the board): fit on height.
        const elW = 2400, elH = 500;
        const fit = fitHexView(HEX_COLS, GRID_SIZE, elW, elH);
        const b = hexGridPixelBounds(HEX_COLS, GRID_SIZE);
        const s = fit.zoom * Math.min(elW / b.width, elH / b.height);
        const spanW = b.width * s, spanH = b.height * s;
        expect(spanW).toBeLessThanOrEqual(elW - 2 * HEX_FIT_INSET_PX + 1e-6);
        expect(spanH).toBeLessThanOrEqual(elH - 2 * HEX_FIT_INSET_PX + 1e-6);
    });

    it('clamps into [MIN_ZOOM, MAX_ZOOM] for degenerate viewports', () => {
        const tiny = fitHexView(HEX_COLS, GRID_SIZE, 60, 60);
        expect(tiny.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
        expect(tiny.zoom).toBeLessThanOrEqual(MAX_ZOOM);
        const huge = fitHexView(HEX_COLS, GRID_SIZE, 100000, 90000);
        expect(huge.zoom).toBeLessThanOrEqual(MAX_ZOOM);
    });

    it('pans via the same centered expression as centerHexView (bit-identical bytes)', () => {
        const fit = fitHexView(HEX_COLS, GRID_SIZE, EL_W, EL_H);
        const centered = centerHexView(HEX_COLS, GRID_SIZE, fit.zoom);
        expect(fit.panX).toBe(centered.x); // exact float, not closeTo — envelope dirty-compare law
        expect(fit.panY).toBe(centered.y);
    });
});

describe('clampHexPan inverted bracket (whole span fits the viewport)', () => {
    it('centers instead of saturating, byte-identical to centerHexView', () => {
        const fit = fitHexView(HEX_COLS, GRID_SIZE, 1548, 895);
        const b = hexGridPixelBounds(HEX_COLS, GRID_SIZE);
        // Any off-center pan request (leftmost top-row POI lane included) is
        // answered with the CENTERED board — the old min-of-max stuck the view
        // at the right edge and parked left/top POIs off-screen.
        const clamped = clampHexPan(b, GRID_SIZE, fit.zoom, -100000, -100000);
        const centered = centerHexView(HEX_COLS, GRID_SIZE, fit.zoom);
        expect(clamped.x).toBe(centered.x);
        expect(clamped.y).toBe(centered.y);
        const other = clampHexPan(b, GRID_SIZE, fit.zoom, 100000, 100000);
        expect(other.x).toBe(centered.x);
        expect(other.y).toBe(centered.y);
    });

    it('keeps the legacy saturating clamp untouched at interactive zooms', () => {
        const b = hexGridPixelBounds(HEX_COLS, GRID_SIZE);
        // VIEW_RESET_ZOOM (2) on this grid: bracket is non-inverted per axis?
        // Assert the pure min/max law on each axis wherever it is legal.
        const px = 400, py = 120;
        const clamped = clampHexPan(b, GRID_SIZE, VIEW_RESET_ZOOM, px, py);
        const viewW = b.width / VIEW_RESET_ZOOM, viewH = b.height / VIEW_RESET_ZOOM;
        const minPanX = b.offsetX + ((GRID_SIZE - 1) / 2 || 0.5) * Math.sqrt(3) * HEX_SIZE;
        const minPanY = b.offsetY + (GRID_SIZE / 4 - 1 || 0.5) * 1.5 * HEX_SIZE;
        const maxPanX = b.offsetX + b.width - ((GRID_SIZE - 1) / 2 || 0.5) * Math.sqrt(3) * HEX_SIZE - viewW;
        const maxPanY = b.offsetY + b.height - (GRID_SIZE / 4 - 1 || 0.5) * 1.5 * HEX_SIZE - viewH;
        expect(clamped.x).toBe(maxPanX < minPanX ? b.centerX - viewW / 2 : Math.min(maxPanX, Math.max(minPanX, px)));
        expect(clamped.y).toBe(maxPanY < minPanY ? b.centerY - viewH / 2 : Math.min(maxPanY, Math.max(minPanY, py)));
    });
});

// Hex WSAD hint backlog 2026-11-26: the chip dims its pan clause while the
// clamp pins pan. The predicate must agree with the handler's own clamp math:
// pinned ⟺ every pan delta answers with the same centered value.
describe('isHexPanClampPinned', () => {
    const b = hexGridPixelBounds(HEX_COLS, GRID_SIZE);

    it('pinned at fit-regime zoom (whole board fits the viewport)', () => {
        const fit = fitHexView(HEX_COLS, GRID_SIZE, 1548, 895);
        expect(isHexPanClampPinned(b, GRID_SIZE, fit.zoom)).toBe(true);
    });

    it('mobile after zooming in past the fit regime (VIEW_RESET_ZOOM)', () => {
        expect(isHexPanClampPinned(b, GRID_SIZE, VIEW_RESET_ZOOM)).toBe(false);
    });

    it('pinned ⟺ clampHexPan answers extreme pan deltas identically', () => {
        // Two regimes, two grid sizes: whenever the predicate says pinned,
        // opposite huge deltas clamp to byte-identical values (zero feedback
        // for the key press); whenever it says mobile, some axis moves.
        for (const [cols, rows] of [[HEX_COLS, GRID_SIZE], [24, 12]]) {
            const bounds = hexGridPixelBounds(cols, rows);
            for (const zoom of [0.95, 1, 1.2, 1.6, 2, 4]) {
                const pinned = isHexPanClampPinned(bounds, rows, zoom);
                const a = clampHexPan(bounds, rows, zoom, -1e6, -1e6);
                const c = clampHexPan(bounds, rows, zoom, 1e6, 1e6);
                expect(pinned).toBe(a.x === c.x && a.y === c.y);
            }
        }
    });
});
