import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useHexHover from './useHexHover.js';
import { pixelToHexSnapped } from '../../../services/maps/hexMapUtils.js';
import { HEX_SIZE } from '../../../config/outdoorConfig.js';

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

const renderWithProps = (initialProps) =>
    renderHook(
        (props) => useHexHover(props.svgRef, props.hexCols, props.hexRows),
        { initialProps }
    );

describe('useHexHover', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        pixelToHexSnapped.mockReturnValue(DEFAULT_HEX);
    });

    describe('setHoveredHex', () => {
        it('stores the hex passed to it', () => {
            const { result } = setup();

            act(() => {
                result.current.setHoveredHex({ q: 3, r: 5 });
            });

            expect(result.current.hoveredHex).toEqual({ q: 3, r: 5 });
        });

        it('clears the hovered hex when called with null', () => {
            const { result } = setup();

            act(() => {
                result.current.setHoveredHex({ q: 2, r: 3 });
            });
            act(() => {
                result.current.setHoveredHex(null);
            });

            expect(result.current.hoveredHex).toBeNull();
        });
    });

    describe('getHexFromEvent', () => {
        it('returns null when the svg is not attached', () => {
            const { result } = setup({ svgRef: { current: null } });

            expect(result.current.getHexFromEvent({ clientX: 100, clientY: 100 })).toBeNull();
        });

        it('returns the hex snapped from the event coordinates', () => {
            pixelToHexSnapped.mockReturnValue({ q: 4, r: 6 });
            const { result } = setup();

            const hex = result.current.getHexFromEvent({ clientX: 120, clientY: 80 });

            expect(pixelToHexSnapped).toHaveBeenCalledWith(120, 80, HEX_SIZE);
            expect(hex).toEqual({ q: 4, r: 6 });
        });

        it('snaps the converted SVG coordinates, not the raw client coordinates', () => {
            const svgRef = createSvgRef({ transform: (x, y) => ({ x: x - 100, y: y - 50 }) });
            const { result } = setup({ svgRef });

            result.current.getHexFromEvent({ clientX: 150, clientY: 100 });

            expect(pixelToHexSnapped).toHaveBeenCalledWith(50, 50, HEX_SIZE);
        });
    });

    describe('handleHexHover', () => {
        it('clears the hovered hex when the svg is not attached', () => {
            const { result } = setup({ svgRef: { current: null } });

            act(() => {
                result.current.setHoveredHex({ q: 2, r: 3 });
            });
            act(() => {
                result.current.handleHexHover({ clientX: 100, clientY: 100 });
            });

            expect(result.current.hoveredHex).toBeNull();
        });

        it('sets hoveredHex when the snapped hex is within grid bounds', () => {
            pixelToHexSnapped.mockReturnValue({ q: 4, r: 6 });
            const { result } = setup();

            act(() => {
                result.current.handleHexHover({ clientX: 100, clientY: 100 });
            });

            expect(result.current.hoveredHex).toEqual({ q: 4, r: 6 });
        });

        it.each([
            ['q below 0', { q: -1, r: 2 }],
            ['r below 0', { q: 2, r: -1 }],
            ['q at the right edge', { q: 10, r: 2 }],
            ['r at the bottom edge', { q: 2, r: 10 }],
        ])('clears hoveredHex when %s is out of bounds', (_label, hex) => {
            pixelToHexSnapped.mockReturnValue(hex);
            const { result } = setup();

            act(() => {
                result.current.handleHexHover({ clientX: 100, clientY: 100 });
            });

            expect(result.current.hoveredHex).toBeNull();
        });

        it('treats the last column and row as in bounds', () => {
            pixelToHexSnapped.mockReturnValue({ q: 9, r: 9 });
            const { result } = setup();

            act(() => {
                result.current.handleHexHover({ clientX: 100, clientY: 100 });
            });

            expect(result.current.hoveredHex).toEqual({ q: 9, r: 9 });
        });

        it('clears hoveredHex when snapping returns no hex', () => {
            pixelToHexSnapped.mockReturnValue(null);
            const { result } = setup();

            act(() => {
                result.current.setHoveredHex({ q: 2, r: 3 });
            });
            act(() => {
                result.current.handleHexHover({ clientX: 100, clientY: 100 });
            });

            expect(result.current.hoveredHex).toBeNull();
        });

        it('clears an active hover when the pointer moves out of bounds', () => {
            const { result } = setup();

            pixelToHexSnapped.mockReturnValue({ q: 4, r: 6 });
            act(() => {
                result.current.handleHexHover({ clientX: 100, clientY: 100 });
            });
            expect(result.current.hoveredHex).toEqual({ q: 4, r: 6 });

            pixelToHexSnapped.mockReturnValue({ q: -3, r: 2 });
            act(() => {
                result.current.handleHexHover({ clientX: -300, clientY: 100 });
            });

            expect(result.current.hoveredHex).toBeNull();
        });
    });

    describe('function identity and prop reactivity', () => {
        it('keeps getHexFromEvent stable while svgRef is unchanged', () => {
            const svgRef = createSvgRef();
            const { result, rerender } = renderWithProps({ svgRef, hexCols: 10, hexRows: 10 });

            const before = result.current.getHexFromEvent;
            rerender({ svgRef, hexCols: 20, hexRows: 20 });

            expect(result.current.getHexFromEvent).toBe(before);
        });

        it('rebuilds handleHexHover when hexCols or hexRows change', () => {
            const svgRef = createSvgRef();
            const { result, rerender } = renderWithProps({ svgRef, hexCols: 10, hexRows: 10 });

            const before = result.current.handleHexHover;
            rerender({ svgRef, hexCols: 20, hexRows: 10 });

            expect(result.current.handleHexHover).not.toBe(before);
        });

        it('honors a larger grid after hexCols grows', () => {
            const svgRef = createSvgRef();
            const { result, rerender } = renderWithProps({ svgRef, hexCols: 5, hexRows: 10 });
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
        });

        it('honors a smaller grid after hexCols shrinks', () => {
            const svgRef = createSvgRef();
            const { result, rerender } = renderWithProps({ svgRef, hexCols: 10, hexRows: 10 });
            pixelToHexSnapped.mockReturnValue({ q: 7, r: 2 });

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
});
