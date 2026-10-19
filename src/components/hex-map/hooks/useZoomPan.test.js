// @maintained-by-ai
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import useZoomPan from './useZoomPan.js';
import { HEX_SIZE, MIN_ZOOM, MAX_ZOOM } from '../../../config/outdoorConfig.js';

// Zoom contract (product constants, pinned here deliberately — they are the
// behavior under test, not implementation details): toolbar buttons step the
// zoom by x1.25 / x0.8; trackpad wheel zooms +/-5% each time the accumulated
// deltaY crosses +/-20. MIN/MAX come from the real config, never fixtures.
const ZOOM_IN_STEP = 1.25;
const ZOOM_OUT_STEP = 0.8;
const WHEEL_STEP = 1.05;
const WHEEL_ZOOM_OUT_STEP = 0.95;

// Golden values use toBeCloseTo(..., 3) tolerance to absorb float noise;
// everything else is derived from HEX_SIZE / MIN_ZOOM / MAX_ZOOM or from the
// hook's own exposed bounds/centerView/clampPan (cross-checks, not re-clamps).
// Routing of DOM wheel/click events to these handlers is owned by the
// container test (HexMap.test.jsx 'routes wheel, zoom, and reset clicks');
// zoom-% display by HexMapToolbar.test.jsx. This file owns the math/state.

const createSvgRef = (overrides = {}) => ({
    current: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 300 }),
        viewBox: { baseVal: { x: 0, y: 0, width: 600, height: 300 } },
        ...overrides,
    },
});

// Renders the hook with real React state so multi-step sequences (wheel
// gestures, zoom in/out) behave exactly as they do in production, including
// the ref-sync effects. `hostRef` exposes the committed zoom/pan state after
// each act().
const setup = (overrides = {}) => {
    const svgRef = overrides.svgRef ?? createSvgRef();
    const hexCols = overrides.hexCols ?? 10;
    const hexRows = overrides.hexRows ?? 10;
    const initialZoom = overrides.initialZoom ?? 2;
    const initialPanX = overrides.initialPanX ?? 0;
    const initialPanY = overrides.initialPanY ?? 0;
    const hostRef = { zoom: initialZoom, panX: initialPanX, panY: initialPanY };

    const utils = renderHook(() => {
        const [zoom, setZoom] = useState(initialZoom);
        const [panX, setPanX] = useState(initialPanX);
        const [panY, setPanY] = useState(initialPanY);
        hostRef.zoom = zoom;
        hostRef.panX = panX;
        hostRef.panY = panY;
        return useZoomPan({ svgRef, hexCols, hexRows, zoom, setZoom, panX, setPanX, panY, setPanY });
    });

    return { ...utils, svgRef, hostRef };
};

const renderGrid = (cols, rows) =>
    renderHook(({ cols, rows }) => {
        const [zoom, setZoom] = useState(2);
        const [panX, setPanX] = useState(0);
        const [panY, setPanY] = useState(0);
        return useZoomPan({ svgRef: createSvgRef(), hexCols: cols, hexRows: rows, zoom, setZoom, panX, setPanX, panY, setPanY });
    }, { initialProps: { cols, rows } });

const wheelEvent = (deltaY) => ({
    metaKey: true,
    deltaY,
    clientX: 100,
    clientY: 100,
    preventDefault: vi.fn(),
});

describe('useZoomPan', () => {
    it('sizes grid bounds from hex pitch: single hex, per-column and per-row growth, centering', () => {
        const hexW = Math.sqrt(3) * HEX_SIZE;
        const { result, rerender } = renderGrid(1, 1);

        // A 1x1 grid bounds exactly one pointy-top hex centered on the origin.
        let b = result.current.gridPixelBounds;
        expect(b.width).toBeCloseTo(hexW, 6);
        expect(b.height).toBeCloseTo(2 * HEX_SIZE, 6);
        expect(b.offsetX).toBeCloseTo(-hexW / 2, 6);
        expect(b.offsetY).toBeCloseTo(-HEX_SIZE, 6);

        rerender({ cols: 10, rows: 10 });
        b = result.current.gridPixelBounds;
        expect(result.current.svgWidth).toBe(b.width);
        expect(result.current.svgHeight).toBe(b.height);
        expect(b.centerX).toBeCloseTo(b.offsetX + b.width / 2, 6);
        expect(b.centerY).toBeCloseTo(b.offsetY + b.height / 2, 6);
        // 10 full column pitches + half-hex overhangs on each side;
        // 9 row pitches (1.5 x radius) + one hex height (2 x radius).
        expect(b.width).toBeCloseTo(14.5 * hexW, 6);
        expect(b.height).toBeCloseTo((2 + 1.5 * 9) * HEX_SIZE, 6);

        // One more column adds exactly one hex width, no height change.
        rerender({ cols: 11, rows: 10 });
        const colStep = result.current.gridPixelBounds;
        expect(colStep.width).toBeCloseTo(b.width + hexW, 6);
        expect(colStep.height).toBeCloseTo(b.height, 6);

        // One more row adds one row pitch of height and half a column of stagger.
        rerender({ cols: 11, rows: 11 });
        expect(result.current.gridPixelBounds.height).toBeCloseTo(colStep.height + 1.5 * HEX_SIZE, 6);
        expect(result.current.gridPixelBounds.width).toBeCloseTo(colStep.width + hexW / 2, 6);
    });

    describe('clampPan', () => {
        it('passes pans between the edges through untouched and saturates beyond them', () => {
            const { result } = setup({ initialZoom: 8 });
            const min = result.current.clampPan(8, -1e6, -1e6);
            const max = result.current.clampPan(8, 1e6, 1e6);
            expect(min.x).toBeLessThan(max.x);
            expect(min.y).toBeLessThan(max.y);
            // Golden: right edge of the 10x10 grid at zoom 8 minus the pan margin.
            expect(max.x).toBeCloseTo(399.4542, 3);
            // Saturating: pushing further out never moves further — edges are stable.
            expect(result.current.clampPan(8, 1e6 + 1, 1e6 + 1)).toEqual(max);
            expect(result.current.clampPan(8, -1e6 - 1, -1e6 - 1)).toEqual(min);
            // Idempotent at the edges, exact passthrough between them.
            expect(result.current.clampPan(8, max.x, max.y)).toEqual(max);
            const mid = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 };
            expect(result.current.clampPan(8, mid.x, mid.y)).toEqual(mid);
        });
    });

    describe('centerView', () => {
        it('centers the grid in the viewport at the given zoom', () => {
            const { result } = setup();
            const b = result.current.gridPixelBounds;
            const zoom = 4;
            const c = result.current.centerView(zoom);
            expect(c.x + b.width / zoom / 2).toBeCloseTo(b.centerX, 6);
            expect(c.y + b.height / zoom / 2).toBeCloseTo(b.centerY, 6);
        });
    });

    it('steps zoom, re-centers every transition, clamps at MAX/MIN, and resets to default', () => {
        const { result, hostRef } = setup({ initialZoom: 4, initialPanX: 300, initialPanY: 150 });

        act(() => { result.current.zoomIn(); });
        expect(hostRef.zoom).toBeCloseTo(4 * ZOOM_IN_STEP, 10);
        let c = result.current.centerView(hostRef.zoom);
        expect(hostRef.panX).toBeCloseTo(c.x, 6);
        expect(hostRef.panY).toBeCloseTo(c.y, 6);

        act(() => { result.current.zoomOut(); });
        expect(hostRef.zoom).toBeCloseTo(5 * ZOOM_OUT_STEP, 10);
        c = result.current.centerView(hostRef.zoom);
        expect(hostRef.panX).toBeCloseTo(c.x, 6);
        expect(hostRef.panY).toBeCloseTo(c.y, 6);

        // Clamps at MAX_ZOOM (config) and still re-centers while held at the cap.
        act(() => { for (let i = 0; i < 10; i++) result.current.zoomIn(); });
        expect(hostRef.zoom).toBe(MAX_ZOOM);
        c = result.current.centerView(MAX_ZOOM);
        expect(hostRef.panX).toBeCloseTo(c.x, 6);
        expect(hostRef.panY).toBeCloseTo(c.y, 6);

        // Steps down from the cap and clamps at MIN_ZOOM (config).
        act(() => { result.current.zoomOut(); });
        expect(hostRef.zoom).toBeCloseTo(MAX_ZOOM * ZOOM_OUT_STEP, 10);
        act(() => { for (let i = 0; i < 25; i++) result.current.zoomOut(); });
        expect(hostRef.zoom).toBe(MIN_ZOOM);

        // resetView returns to the default zoom, grid centered.
        // Golden: clamped centered pan for a 10x10 grid at the default zoom —
        // at MIN_ZOOM the horizontal center saturates at the right edge.
        act(() => { result.current.resetView(); });
        expect(hostRef.zoom).toBe(MIN_ZOOM);
        expect(hostRef.panX).toBeCloseTo(116.9134, 3);
        expect(hostRef.panY).toBeCloseTo(86.25, 3);
    });

    it('pans on left-drag with viewBox-scaled deltas, clamps, ends, and detaches safely', () => {
        // viewBox differs from the client rect (x2 scale) so the
        // client->SVG coordinate conversion is genuinely exercised.
        const svgRef = createSvgRef({ viewBox: { baseVal: { x: 0, y: 0, width: 1200, height: 600 } } });
        const { result, hostRef } = setup({ svgRef, initialZoom: 8, initialPanX: 300, initialPanY: 150 });

        // Non-left buttons are ignored, event not swallowed.
        const rightClick = { button: 2, clientX: 200, clientY: 100, preventDefault: vi.fn() };
        act(() => { result.current.handlePanStart(rightClick); });
        expect(result.current.panning).toBeNull();
        expect(rightClick.preventDefault).not.toHaveBeenCalled();

        // Left-press captures the click in SVG coords plus the current pan.
        const start = { button: 0, clientX: 200, clientY: 100, preventDefault: vi.fn() };
        act(() => { result.current.handlePanStart(start); });
        expect(start.preventDefault).toHaveBeenCalled();
        expect(result.current.panning).toEqual({ startX: 400, startY: 200, startPanX: 300, startPanY: 150 });

        // Drag moves the map opposite the pointer by the SVG-scaled delta.
        act(() => { result.current.handlePanMove({ clientX: 160, clientY: 80, preventDefault: vi.fn() }); });
        expect(hostRef.panX).toBe(380);
        expect(hostRef.panY).toBe(190);

        // A massive drag saturates exactly where clampPan says it must.
        const edge = result.current.clampPan(8, -1e6, -1e6);
        act(() => { result.current.handlePanMove({ clientX: 2000, clientY: 2000, preventDefault: vi.fn() }); });
        expect(hostRef.panX).toBeCloseTo(edge.x, 6);
        expect(hostRef.panY).toBeCloseTo(edge.y, 6);
        const pinned = { x: hostRef.panX, y: hostRef.panY };

        // Release stops panning; a subsequent move is inert.
        act(() => { result.current.handlePanEnd(); });
        expect(result.current.panning).toBeNull();
        act(() => { result.current.handlePanMove({ clientX: 10, clientY: 10, preventDefault: vi.fn() }); });
        expect(hostRef.panX).toBe(pinned.x);
        expect(hostRef.panY).toBe(pinned.y);

        // With the svg detached, a fresh press cannot start a pan.
        svgRef.current = null;
        act(() => { result.current.handlePanStart({ button: 0, clientX: 10, clientY: 10, preventDefault: vi.fn() }); });
        expect(result.current.panning).toBeNull();
    });

    describe('wheel zoom', () => {
        it('requires metaKey, steps +/-5% only when the accumulator crosses +/-20, clamps at MIN_ZOOM', () => {
            const { result, hostRef } = setup({ initialZoom: 3 });

            // No metaKey: fully ignored, browser keeps its native scroll.
            const plain = { metaKey: false, deltaY: -500, clientX: 100, clientY: 100, preventDefault: vi.fn() };
            act(() => { result.current.handleWheel(plain); });
            expect(plain.preventDefault).not.toHaveBeenCalled();
            expect(hostRef.zoom).toBe(3);
            expect(hostRef.panX).toBe(0);
            expect(hostRef.panY).toBe(0);

            // Accumulating to exactly -20 does not fire; crossing it fires one +5% step.
            act(() => {
                result.current.handleWheel(wheelEvent(-10));
                result.current.handleWheel(wheelEvent(-10));
            });
            expect(hostRef.zoom).toBe(3);
            act(() => { result.current.handleWheel(wheelEvent(-1)); });
            expect(hostRef.zoom).toBeCloseTo(3 * WHEEL_STEP, 10);

            // Accumulator resets on firing, so further gestures compound steps.
            // (Each firing gesture gets its own act() so the hook's zoom-ref
            // sync effect commits the new zoom before the next gesture reads it.)
            for (let i = 0; i < 2; i++) {
                act(() => { result.current.handleWheel(wheelEvent(-21)); });
            }
            expect(hostRef.zoom).toBeCloseTo(3 * WHEEL_STEP ** 3, 10);

            // Sign flips: positive deltas below threshold idle, crossing zooms out one step.
            act(() => { result.current.handleWheel(wheelEvent(10)); });
            expect(hostRef.zoom).toBeCloseTo(3 * WHEEL_STEP ** 3, 10);
            act(() => { result.current.handleWheel(wheelEvent(15)); });
            expect(hostRef.zoom).toBeCloseTo(3 * WHEEL_STEP ** 3 * WHEEL_ZOOM_OUT_STEP, 10);

            // Repeated large out-gestures saturate at MIN_ZOOM (real config value).
            for (let i = 0; i < 15; i++) {
                act(() => { result.current.handleWheel(wheelEvent(500)); });
            }
            expect(hostRef.zoom).toBe(MIN_ZOOM);
        });

        it('anchors the point under the cursor across gestures and clamps at MAX_ZOOM', () => {
            const { result, hostRef } = setup({ initialZoom: 4, initialPanX: 300, initialPanY: 150 });
            const svgX = 200;
            const svgY = 100;
            const event = { metaKey: true, deltaY: -21, clientX: svgX, clientY: svgY, preventDefault: vi.fn() };

            // After each gesture, the world point under the cursor is unmoved:
            // (cursor - pan) * zoom stays constant across the zoom change.
            act(() => { result.current.handleWheel(event); });
            expect(hostRef.zoom).toBeCloseTo(4 * WHEEL_STEP, 10);
            expect((svgX - hostRef.panX) * hostRef.zoom).toBeCloseTo((svgX - 300) * 4, 5);
            expect((svgY - hostRef.panY) * hostRef.zoom).toBeCloseTo((svgY - 150) * 4, 5);

            // The next gesture anchors against the latest pan, not the original.
            act(() => { result.current.handleWheel(event); });
            expect(hostRef.zoom).toBeCloseTo(4 * WHEEL_STEP ** 2, 10);
            expect((svgX - hostRef.panX) * hostRef.zoom).toBeCloseTo((svgX - 300) * 4, 5);
            expect((svgY - hostRef.panY) * hostRef.zoom).toBeCloseTo((svgY - 150) * 4, 5);

            // Repeated large in-gestures saturate at MAX_ZOOM (real config value).
            for (let i = 0; i < 20; i++) {
                act(() => { result.current.handleWheel(wheelEvent(-500)); });
            }
            expect(hostRef.zoom).toBe(MAX_ZOOM);
        });
    });
});
