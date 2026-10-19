// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useHexHover from './useHexHover.js';
import { pixelToHexSnapped } from '../../../services/maps/hexMapUtils.js';
import { HEX_SIZE } from '../../../config/outdoorConfig.js';

// Geometry (axial snapping) is owned by services/maps/hexMapUtils and tested
// there; this suite mocks it and pins the exact args the hook passes once.
// Pointer-move ROUTING to these callbacks is owned by HexMap container tests.
vi.mock('../../../services/maps/hexMapUtils.js', () => ({
    pixelToHexSnapped: vi.fn(),
}));

const DEFAULT_HEX = { q: 1, r: 2 };

// Builds a fake <svg> element whose createSVGPoint() simulates the real
// matrixTransform pipeline. `transform` maps client coords to SVG coords
// (identity by default), so tests can verify the hook converts coordinates
// before snapping.
const createSvgRef = ({ transform = (x, y) => ({ x, y }) } = {}) => ({
    current: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 300 }),
        viewBox: { baseVal: { x: 0, y: 0, width: 600, height: 300 } },
        getScreenCTM: () => ({ inverse: () => null }),
        createSVGPoint: () => {
            const pt = { x: 0, y: 0 };
            pt.matrixTransform = () => transform(pt.x, pt.y);
            return pt;
        },
    },
});

const setup = (overrides = {}) => {
    const svgRef = overrides.svgRef ?? createSvgRef();
    const hexCols = overrides.hexCols ?? 10;
    const hexRows = overrides.hexRows ?? 10;
    return renderHook(() => useHexHover(svgRef, hexCols, hexRows));
};

describe('useHexHover', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        pixelToHexSnapped.mockReturnValue(DEFAULT_HEX);
    });

    it('setHoveredHex sets and clears the hovered hex', () => {
        const { result } = setup();

        act(() => {
            result.current.setHoveredHex({ q: 3, r: 5 });
        });
        expect(result.current.hoveredHex).toEqual({ q: 3, r: 5 });

        act(() => {
            result.current.setHoveredHex(null);
        });
        expect(result.current.hoveredHex).toBeNull();
    });

    describe('getHexFromEvent', () => {
        it('returns null when the svg is not attached', () => {
            const { result } = setup({ svgRef: { current: null } });

            expect(result.current.getHexFromEvent({ clientX: 100, clientY: 100 })).toBeNull();
            expect(pixelToHexSnapped).not.toHaveBeenCalled();
        });

        it('snaps the transformed SVG coordinates once and returns the snapped hex', () => {
            pixelToHexSnapped.mockReturnValue({ q: 4, r: 6 });
            // Non-identity transform proves the hook snaps converted SVG
            // coords (50, 50), not the raw client coords (150, 100).
            const svgRef = createSvgRef({ transform: (x, y) => ({ x: x - 100, y: y - 50 }) });
            const { result } = setup({ svgRef });

            const hex = result.current.getHexFromEvent({ clientX: 150, clientY: 100 });

            expect(pixelToHexSnapped).toHaveBeenCalledTimes(1);
            expect(pixelToHexSnapped).toHaveBeenCalledWith(50, 50, HEX_SIZE);
            expect(hex).toEqual({ q: 4, r: 6 });
        });
    });

    describe('handleHexHover', () => {
        it('sets hoveredHex for hexes within bounds, including the last column and row', () => {
            const { result } = setup();

            pixelToHexSnapped.mockReturnValue({ q: 4, r: 6 });
            act(() => {
                result.current.handleHexHover({ clientX: 100, clientY: 100 });
            });
            expect(result.current.hoveredHex).toEqual({ q: 4, r: 6 });

            pixelToHexSnapped.mockReturnValue({ q: 9, r: 9 });
            act(() => {
                result.current.handleHexHover({ clientX: 100, clientY: 100 });
            });
            expect(result.current.hoveredHex).toEqual({ q: 9, r: 9 });
        });

        it('clears an active hover for any out-of-bounds hex, a missing snap result, or a detached svg', () => {
            const svgRef = createSvgRef();
            const { result } = setup({ svgRef });

            pixelToHexSnapped.mockReturnValue({ q: 4, r: 6 });
            act(() => {
                result.current.handleHexHover({ clientX: 100, clientY: 100 });
            });
            expect(result.current.hoveredHex).toEqual({ q: 4, r: 6 });

            const outOfBounds = [
                { q: -1, r: 2 },
                { q: 2, r: -1 },
                { q: 10, r: 2 },
                { q: 2, r: 10 },
                null,
            ];
            for (const hex of outOfBounds) {
                pixelToHexSnapped.mockReturnValue(hex);
                act(() => {
                    result.current.handleHexHover({ clientX: 100, clientY: 100 });
                });
                expect(result.current.hoveredHex).toBeNull();
            }

            svgRef.current = null;
            act(() => {
                result.current.handleHexHover({ clientX: 100, clientY: 100 });
            });
            expect(result.current.hoveredHex).toBeNull();
        });
    });

    it('tracks grid bounds as hexCols changes', () => {
        const svgRef = createSvgRef();
        const { result, rerender } = renderHook(
            (props) => useHexHover(props.svgRef, props.hexCols, props.hexRows),
            { initialProps: { svgRef, hexCols: 5, hexRows: 10 } }
        );
        pixelToHexSnapped.mockReturnValue({ q: 7, r: 2 });

        act(() => {
            result.current.handleHexHover({ clientX: 100, clientY: 100 });
        });
        expect(result.current.hoveredHex).toBeNull();

        rerender({ svgRef, hexCols: 10, hexRows: 10 });
        act(() => {
            result.current.handleHexHover({ clientX: 100, clientY: 100 });
        });
        expect(result.current.hoveredHex).toEqual({ q: 7, r: 2 });

        rerender({ svgRef, hexCols: 5, hexRows: 10 });
        act(() => {
            result.current.handleHexHover({ clientX: 100, clientY: 100 });
        });
        expect(result.current.hoveredHex).toBeNull();
    });
});
