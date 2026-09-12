// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import useZoomPan from './useZoomPan.js';
import { MIN_ZOOM, MAX_ZOOM } from '../../../config/outdoorConfig.js';

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

const wheelEvent = (deltaY) => ({
    metaKey: true,
    deltaY,
    clientX: 100,
    clientY: 100,
    preventDefault: vi.fn(),
});

describe('useZoomPan', () => {
    describe('gridPixelBounds / svgWidth / svgHeight', () => {
        it('computes the pixel bounds of a 10x10 grid', () => {
            const { result } = setup();
            const bounds = result.current.gridPixelBounds;
            expect(bounds.width).toBeCloseTo(753.4421, 3);
            expect(bounds.height).toBeCloseTo(465, 3);
            expect(bounds.offsetX).toBeCloseTo(-25.9808, 3);
            expect(bounds.offsetY).toBeCloseTo(-30, 3);
            expect(bounds.centerX).toBeCloseTo(350.7403, 3);
            expect(bounds.centerY).toBeCloseTo(202.5, 3);
            expect(result.current.svgWidth).toBeCloseTo(753.4421, 3);
            expect(result.current.svgHeight).toBeCloseTo(465, 3);
        });

        it('handles a single-hex grid', () => {
            const { result } = setup({ hexCols: 1, hexRows: 1 });
            expect(result.current.gridPixelBounds.width).toBeCloseTo(51.9615, 3);
            expect(result.current.gridPixelBounds.height).toBeCloseTo(60, 3);
        });

        it('grows the bounds when the grid has more columns', () => {
            const svgRef = createSvgRef();
            const { result, rerender } = renderHook(({ cols, rows }) => {
                const [zoom, setZoom] = useState(2);
                const [panX, setPanX] = useState(0);
                const [panY, setPanY] = useState(0);
                return useZoomPan({ svgRef, hexCols: cols, hexRows: rows, zoom, setZoom, panX, setPanX, panY, setPanY });
            }, { initialProps: { cols: 10, rows: 10 } });
            expect(result.current.gridPixelBounds.width).toBeCloseTo(753.4421, 3);
            rerender({ cols: 20, rows: 10 });
            expect(result.current.gridPixelBounds.width).toBeCloseTo(1273.0573, 3);
        });

        it('grows the bounds when the grid has more rows', () => {
            const svgRef = createSvgRef();
            const { result, rerender } = renderHook(({ cols, rows }) => {
                const [zoom, setZoom] = useState(2);
                const [panX, setPanX] = useState(0);
                const [panY, setPanY] = useState(0);
                return useZoomPan({ svgRef, hexCols: cols, hexRows: rows, zoom, setZoom, panX, setPanX, panY, setPanY });
            }, { initialProps: { cols: 10, rows: 10 } });
            expect(result.current.gridPixelBounds.height).toBeCloseTo(465, 3);
            rerender({ cols: 10, rows: 20 });
            expect(result.current.gridPixelBounds.height).toBeCloseTo(915, 3);
        });
    });

    describe('clampPan', () => {
        it('returns in-bounds pan values unchanged', () => {
            const { result } = setup({ initialZoom: 8 });
            expect(result.current.clampPan(8, 300, 150)).toEqual({ x: 300, y: 150 });
        });

        it('clamps pan values above the upper bound', () => {
            const { result } = setup({ initialZoom: 8 });
            const clamped = result.current.clampPan(8, 99999, 99999);
            expect(clamped.x).toBeCloseTo(399.4542, 3);
            expect(clamped.y).toBeCloseTo(309.375, 3);
        });

        it('clamps pan values below the lower bound', () => {
            const { result } = setup({ initialZoom: 8 });
            const clamped = result.current.clampPan(8, -99999, -99999);
            expect(clamped.x).toBeCloseTo(207.8461, 3);
            expect(clamped.y).toBeCloseTo(37.5, 3);
        });
    });

    describe('centerView', () => {
        it('returns the pan that centers the grid at the given zoom', () => {
            const { result } = setup();
            const centered = result.current.centerView(4);
            expect(centered.x).toBeCloseTo(256.56, 3);
            expect(centered.y).toBeCloseTo(144.375, 3);
        });

        it('keeps the grid horizontally and vertically centered', () => {
            const { result } = setup();
            const bounds = result.current.gridPixelBounds;
            const centered = result.current.centerView(4);
            expect(centered.x + bounds.width / 4 / 2).toBeCloseTo(bounds.centerX, 3);
            expect(centered.y + bounds.height / 4 / 2).toBeCloseTo(bounds.centerY, 3);
        });
    });

    describe('zoomIn', () => {
        it('zooms in by a factor of 1.25', () => {
            const { result, hostRef } = setup();
            act(() => { result.current.zoomIn(); });
            expect(hostRef.zoom).toBeCloseTo(2.5, 10);
        });

        it('re-centers the view at the new zoom', () => {
            const { result, hostRef } = setup({ initialZoom: 4 });
            act(() => { result.current.zoomIn(); });
            expect(hostRef.zoom).toBeCloseTo(5, 10);
            expect(hostRef.panX).toBeCloseTo(275.3961, 3);
            expect(hostRef.panY).toBeCloseTo(156, 3);
        });

        it('clamps zoom at MAX_ZOOM', () => {
            const { result, hostRef } = setup({ initialZoom: 7 });
            act(() => { result.current.zoomIn(); });
            expect(hostRef.zoom).toBe(MAX_ZOOM);
        });

        it('still re-centers the view when already at MAX_ZOOM', () => {
            const { result, hostRef } = setup({ initialZoom: 8, initialPanX: 100, initialPanY: 100 });
            act(() => { result.current.zoomIn(); });
            expect(hostRef.zoom).toBe(MAX_ZOOM);
            expect(hostRef.panX).toBeCloseTo(303.6502, 3);
            expect(hostRef.panY).toBeCloseTo(173.4375, 3);
        });
    });

    describe('zoomOut', () => {
        it('zooms out by a factor of 0.8', () => {
            const { result, hostRef } = setup({ initialZoom: 3 });
            act(() => { result.current.zoomOut(); });
            expect(hostRef.zoom).toBeCloseTo(2.4, 10);
        });

        it('re-centers the view at the new zoom', () => {
            const { result, hostRef } = setup({ initialZoom: 4 });
            act(() => { result.current.zoomOut(); });
            expect(hostRef.zoom).toBeCloseTo(3.2, 10);
            expect(hostRef.panX).toBeCloseTo(233.015, 3);
            expect(hostRef.panY).toBeCloseTo(129.8438, 3);
        });

        it('clamps zoom at MIN_ZOOM', () => {
            const { result, hostRef } = setup({ initialZoom: MIN_ZOOM });
            act(() => { result.current.zoomOut(); });
            expect(hostRef.zoom).toBe(MIN_ZOOM);
        });
    });

    describe('resetView', () => {
        it('resets zoom to the minimum and re-centers the grid', () => {
            const { result, hostRef } = setup({ initialZoom: 5, initialPanX: 200, initialPanY: 100 });
            act(() => { result.current.resetView(); });
            expect(hostRef.zoom).toBe(MIN_ZOOM);
            expect(hostRef.panX).toBeCloseTo(116.9134, 3);
            expect(hostRef.panY).toBeCloseTo(86.25, 3);
        });
    });

    describe('handlePanStart', () => {
        it('starts panning at the click position converted to SVG coordinates', () => {
            const { result } = setup({ initialPanX: 100, initialPanY: 50 });
            const event = { button: 0, clientX: 150, clientY: 90, preventDefault: vi.fn() };
            act(() => { result.current.handlePanStart(event); });
            expect(event.preventDefault).toHaveBeenCalled();
            expect(result.current.panning).toEqual({
                startX: 150,
                startY: 90,
                startPanX: 100,
                startPanY: 50,
            });
        });

        it('ignores non-left mouse buttons', () => {
            const { result } = setup();
            const event = { button: 1, clientX: 150, clientY: 90, preventDefault: vi.fn() };
            act(() => { result.current.handlePanStart(event); });
            expect(result.current.panning).toBeNull();
            expect(event.preventDefault).not.toHaveBeenCalled();
        });

        it('does nothing when the svg is not attached', () => {
            const { result } = setup({ svgRef: { current: null } });
            act(() => {
                result.current.handlePanStart({ button: 0, clientX: 150, clientY: 90, preventDefault: vi.fn() });
            });
            expect(result.current.panning).toBeNull();
        });
    });

    describe('handlePanMove', () => {
        it('does nothing while not panning', () => {
            const { result, hostRef } = setup();
            act(() => { result.current.handlePanMove({ clientX: 120, clientY: 120, preventDefault: vi.fn() }); });
            expect(hostRef.panX).toBe(0);
            expect(hostRef.panY).toBe(0);
        });

        it('moves the pan by the drag delta', () => {
            const { result, hostRef } = setup({ initialZoom: 8, initialPanX: 300, initialPanY: 150 });
            act(() => {
                result.current.handlePanStart({ button: 0, clientX: 200, clientY: 100, preventDefault: vi.fn() });
            });
            act(() => { result.current.handlePanMove({ clientX: 160, clientY: 80, preventDefault: vi.fn() }); });
            expect(hostRef.panX).toBe(340);
            expect(hostRef.panY).toBe(170);
        });

        it('clamps the pan so the grid cannot be dragged off-screen', () => {
            const { result, hostRef } = setup({ initialZoom: 8, initialPanX: 300, initialPanY: 150 });
            act(() => {
                result.current.handlePanStart({ button: 0, clientX: 200, clientY: 100, preventDefault: vi.fn() });
            });
            act(() => { result.current.handlePanMove({ clientX: 2000, clientY: 2000, preventDefault: vi.fn() }); });
            expect(hostRef.panX).toBeCloseTo(207.8461, 3);
            expect(hostRef.panY).toBeCloseTo(37.5, 3);
        });
    });

    describe('handlePanEnd', () => {
        it('stops panning', () => {
            const { result } = setup();
            act(() => {
                result.current.handlePanStart({ button: 0, clientX: 150, clientY: 90, preventDefault: vi.fn() });
            });
            expect(result.current.panning).not.toBeNull();
            act(() => { result.current.handlePanEnd(); });
            expect(result.current.panning).toBeNull();
        });
    });

    describe('handleWheel', () => {
        it('ignores wheel events without metaKey', () => {
            const { result, hostRef } = setup();
            act(() => {
                result.current.handleWheel({ metaKey: false, deltaY: -100, clientX: 100, clientY: 100, preventDefault: vi.fn() });
            });
            expect(hostRef.zoom).toBe(2);
            expect(hostRef.panX).toBe(0);
            expect(hostRef.panY).toBe(0);
        });

        it('does nothing when the svg is not attached', () => {
            const { result, hostRef } = setup({ svgRef: { current: null } });
            act(() => { result.current.handleWheel(wheelEvent(-100)); });
            expect(hostRef.zoom).toBe(2);
        });

        it('zooms in once the accumulated delta crosses the threshold', () => {
            const { result, hostRef } = setup();
            for (let i = 0; i < 3; i++) {
                act(() => { result.current.handleWheel(wheelEvent(-10)); });
            }
            expect(hostRef.zoom).toBeCloseTo(2.1, 10);
        });

        it('zooms out once the accumulated delta crosses the threshold', () => {
            const { result, hostRef } = setup({ initialZoom: 3 });
            for (let i = 0; i < 3; i++) {
                act(() => { result.current.handleWheel(wheelEvent(10)); });
            }
            expect(hostRef.zoom).toBeCloseTo(2.85, 10);
        });

        it('does not zoom while the accumulated delta is below the threshold', () => {
            const { result, hostRef } = setup({ initialZoom: 3 });
            act(() => { result.current.handleWheel(wheelEvent(19)); });
            expect(hostRef.zoom).toBe(3);
            act(() => { result.current.handleWheel(wheelEvent(2)); });
            expect(hostRef.zoom).toBeCloseTo(2.85, 10);
        });

        it('compounds zoom across consecutive gestures', () => {
            const { result, hostRef } = setup();
            for (let i = 0; i < 3; i++) {
                act(() => { result.current.handleWheel(wheelEvent(-21)); });
            }
            expect(hostRef.zoom).toBeCloseTo(2 * 1.05 ** 3, 10);
        });

        it('clamps zoom at MIN_ZOOM when zooming out', () => {
            const { result, hostRef } = setup({ initialZoom: 2.5 });
            for (let i = 0; i < 5; i++) {
                act(() => { result.current.handleWheel(wheelEvent(500)); });
            }
            expect(hostRef.zoom).toBe(MIN_ZOOM);
        });

        it('clamps zoom at MAX_ZOOM when zooming in', () => {
            const { result, hostRef } = setup({ initialZoom: 7 });
            for (let i = 0; i < 3; i++) {
                act(() => { result.current.handleWheel(wheelEvent(-500)); });
            }
            expect(hostRef.zoom).toBe(MAX_ZOOM);
        });

        it('keeps the point under the cursor anchored while zooming', () => {
            const { result, hostRef } = setup({ initialZoom: 4, initialPanX: 300, initialPanY: 150 });
            const svgX = 200;
            const svgY = 100;
            act(() => {
                result.current.handleWheel({
                    metaKey: true, deltaY: -21, clientX: svgX, clientY: svgY, preventDefault: vi.fn(),
                });
            });
            expect(hostRef.zoom).toBeCloseTo(4.2, 10);
            expect((svgX - hostRef.panX) * hostRef.zoom).toBeCloseTo((svgX - 300) * 4, 5);
            expect((svgY - hostRef.panY) * hostRef.zoom).toBeCloseTo((svgY - 150) * 4, 5);
        });

        it('anchors subsequent gestures to the latest pan', () => {
            const { result, hostRef } = setup({ initialZoom: 4, initialPanX: 300, initialPanY: 150 });
            const event = { metaKey: true, deltaY: -21, clientX: 200, clientY: 100, preventDefault: vi.fn() };
            act(() => { result.current.handleWheel(event); });
            act(() => { result.current.handleWheel(event); });
            expect(hostRef.zoom).toBeCloseTo(4.41, 10);
            expect(hostRef.panX).toBeCloseTo(290.7029, 3);
            expect(hostRef.panY).toBeCloseTo(145.3515, 3);
        });
    });
});
