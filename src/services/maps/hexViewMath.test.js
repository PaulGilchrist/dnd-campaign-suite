// @maintained-by-ai 2026-11-26
// Pins for the mount auto-fit seam (XF backlog 2026-11-16): the fit math must
// keep a named ~40 px inset between the board extent and every viewport edge,
// show the WHOLE board (inset shrinks the usable viewport, never crops the
// board), and the pan clamp must CENTER — not saturate — when the whole grid
// span fits inside the viewport at the fit zoom. The saturating branch of
// clampHexPan at interactive zooms is pinned by the sibling lane test
// (src/components/hex-map/hooks/useZoomPan.test.js 'clampPan'), which runs
// this exact function through the hook — not duplicated here.
import { describe, it, expect } from 'vitest';
import {
    MIN_ZOOM, MAX_ZOOM, GRID_COLS_MULTIPLIER,
} from '../../config/outdoorConfig.js';
import {
    hexGridPixelBounds, clampHexPan, centerHexView, fitHexView, resolveHexResetView,
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

describe('golden fit constants', () => {
    // HEX_FIT_INSET_PX: the deliberate 40 px per-edge inset the mount fit
    // reserves (clears the 36 SVG-unit POI hit-rect plus label).
    // HEX_FIT_VERSION: the stamp the ONE branch of the mount-fit law reads
    // (YG backlog 2026-11-16): doc.fitVersion === HEX_FIT_VERSION → mount
    // verbatim; anything else → one mount fit + restamp. Bumping this constant
    // re-runs the stamping pass for every doc — the disk fixture
    // (public/campaigns/test-campaign/maps/poi-showcase.json) and the settled
    // hook fixtures must migrate in the same change.
    it('pins the 40 px inset and fit-stamp version the mount-fit law and disk fixtures rely on', () => {
        expect(HEX_FIT_INSET_PX).toBe(40);
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
        expect(fit.zoom).toBeLessThan(1); // a MIN_ZOOM of 1 could never fit — hence the floor drop
    });

    it('lands every board corner (and thus every POI) inside viewport minus inset, on both constrained axes', () => {
        const b = hexGridPixelBounds(HEX_COLS, GRID_SIZE);
        // Width-constrained (1.73) and height-constrained (4.8, so the fit
        // lands on usable height and the board letterboxes horizontally).
        // Corner containment also proves the board is never cropped.
        for (const [elW, elH] of [[EL_W, EL_H], [2400, 500]]) {
            const fit = fitHexView(HEX_COLS, GRID_SIZE, elW, elH);
            for (const [sx, sy] of [
                [b.offsetX, b.offsetY], [b.offsetX + b.width, b.offsetY],
                [b.offsetX, b.offsetY + b.height], [b.offsetX + b.width, b.offsetY + b.height],
            ]) {
                const p = toScreenPx(sx, sy, fit, elW, elH);
                expect(p.x).toBeGreaterThanOrEqual(HEX_FIT_INSET_PX - 1e-6);
                expect(p.x).toBeLessThanOrEqual(elW - HEX_FIT_INSET_PX + 1e-6);
                expect(p.y).toBeGreaterThanOrEqual(HEX_FIT_INSET_PX - 1e-6);
                expect(p.y).toBeLessThanOrEqual(elH - HEX_FIT_INSET_PX + 1e-6);
            }
        }
    });

    it('clamps at MIN_ZOOM when the viewport swallows the inset, and still reserves the inset on a giant viewport', () => {
        // 60×60 leaves usable = max(1, 60 − 2·inset) = 1 → raw fit far below
        // MIN_ZOOM; the clamp floor must answer exactly.
        expect(fitHexView(HEX_COLS, GRID_SIZE, 60, 60).zoom).toBe(MIN_ZOOM);
        // Giant viewport is width-constrained: fit still lands on usable
        // width — never above it, nowhere near MAX_ZOOM.
        const hugeW = 100000;
        expect(fitHexView(HEX_COLS, GRID_SIZE, hugeW, 90000).zoom)
            .toBeCloseTo((hugeW - 2 * HEX_FIT_INSET_PX) / hugeW, 10);
        // In-band sanity for the ceiling constant itself at these extremes.
        expect(fitHexView(HEX_COLS, GRID_SIZE, 60, 60).zoom).toBeLessThanOrEqual(MAX_ZOOM);
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
        const centered = centerHexView(HEX_COLS, GRID_SIZE, fit.zoom);
        for (const [px, py] of [[-100000, -100000], [100000, 100000]]) {
            const clamped = clampHexPan(b, GRID_SIZE, fit.zoom, px, py);
            expect(clamped.x).toBe(centered.x);
            expect(clamped.y).toBe(centered.y);
        }
    });
});

// Hex WSAD hint backlog 2026-11-26: the chip dims its pan clause while the
// clamp pins pan. The predicate must agree with the handler's own clamp math:
// pinned ⟺ every pan delta answers with the same centered value.
describe('isHexPanClampPinned', () => {
    const b = hexGridPixelBounds(HEX_COLS, GRID_SIZE);

    it('pinned in the fit regime, mobile after zooming in past it', () => {
        const fit = fitHexView(HEX_COLS, GRID_SIZE, 1548, 895);
        expect(isHexPanClampPinned(b, GRID_SIZE, fit.zoom)).toBe(true);
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

// Unified hex R law (owner decision 2026-11-26, mirrors the indoor contract):
// R / toolbar Reset restores the map doc's stored (mount-adopted) view bytes,
// NOT the VIEW_RESET_ZOOM center. The legacy reset geometry survives ONLY as
// the no-stored-view fallback (fresh create / rejected render, before the
// needsResetViewRef settle claims any view).
describe('resolveHexResetView (R = restore the stored view)', () => {
    it('stored view present → those exact bytes win, verbatim (never legacy geometry)', () => {
        // poi-showcase's real stored (mount-fit adopted) bytes, plus an
        // arbitrary non-legacy view: whichever is stored is what R restores.
        // Both differ from the VIEW_RESET_ZOOM-centered geometry, so verbatim
        // equality also proves the legacy jump is retired.
        for (const stored of [
            { zoom: 0.9483204134366925, panX: -53.589746375870845, panY: -40.21798365122615 },
            { zoom: 3.5, panX: 210.25, panY: 44.125 },
        ]) {
            expect(resolveHexResetView(stored, HEX_COLS, GRID_SIZE)).toEqual(stored);
        }
    });

    it('no stored view (fresh doc) → the legacy centered VIEW_RESET_ZOOM fallback', () => {
        const centered = centerHexView(HEX_COLS, GRID_SIZE, VIEW_RESET_ZOOM);
        for (const none of [null, undefined]) {
            expect(resolveHexResetView(none, HEX_COLS, GRID_SIZE)).toEqual({
                zoom: VIEW_RESET_ZOOM, panX: centered.x, panY: centered.y,
            });
        }
    });
});
